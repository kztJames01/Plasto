package com.plasto.api.audit;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plasto.api.event.EventRecord;
import com.plasto.api.event.EventRepository;
import com.plasto.api.floatcap.OperatorFloat;
import com.plasto.api.floatcap.OperatorFloatRepository;

@Service
public class MerkleTreeService {

	private static final HexFormat HEX = HexFormat.of();
	private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};

	private final EventRepository eventRepository;
	private final OperatorFloatRepository floatRepository;
	private final MerkleRootRepository merkleRootRepository;
	private final ObjectMapper objectMapper;

	public MerkleTreeService(
		EventRepository eventRepository,
		OperatorFloatRepository floatRepository,
		MerkleRootRepository merkleRootRepository,
		ObjectMapper objectMapper
	) {
		this.eventRepository = eventRepository;
		this.floatRepository = floatRepository;
		this.merkleRootRepository = merkleRootRepository;
		this.objectMapper = objectMapper;
	}

	@Transactional
	public MerkleRoot buildDailyRoot(String plantId, LocalDate dayUtc) {
		if (plantId == null || plantId.isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "plantId is required");
		}
		Instant start = dayUtc.atStartOfDay().toInstant(ZoneOffset.UTC);
		Instant end = dayUtc.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);
		long startMs = start.toEpochMilli();
		long endMs = end.toEpochMilli();
		List<EventRecord> dayEvents = eventRepository.findByCreatedAtLocalGreaterThanEqualAndCreatedAtLocalLessThanOrderByEventHashAsc(
			startMs, endMs
		);
		List<String> leaves = dayEvents.stream()
			.filter(event -> plantId.equals(resolvePlantId(event)))
			.map(EventRecord::getEventHash)
			.map(h -> h.toLowerCase(Locale.ROOT))
			.sorted()
			.distinct()
			.toList();

		String rootHash = computeRoot(leaves);
		MerkleRoot root = merkleRootRepository.findByPlantIdAndDayUtc(plantId, dayUtc)
			.orElseGet(MerkleRoot::new);
		root.setPlantId(plantId);
		root.setDayUtc(dayUtc);
		root.setRootHash(rootHash);
		root.setEventCount(leaves.size());
		root.setLeafHashes(writeLeaves(leaves));
		root.setCreatedAt(Instant.now());
		return merkleRootRepository.save(root);
	}

	@Transactional
	public MerkleRoot anchor(String plantId, LocalDate dayUtc) {
		MerkleRoot root = merkleRootRepository.findByPlantIdAndDayUtc(plantId, dayUtc)
			.orElseGet(() -> buildDailyRoot(plantId, dayUtc));
		// Polygon PoS publish is optional P2 — mark anchored locally with a
		// deterministic placeholder so auditors can see the root was sealed.
		if (root.getAnchoredAt() == null) {
			root.setAnchoredAt(Instant.now());
			root.setChainTx("local-anchor:" + root.getRootHash().substring(0, 16));
			root = merkleRootRepository.save(root);
		}
		return root;
	}

	@Transactional(readOnly = true)
	public MerkleProofResponse proofForEvent(UUID eventId) {
		EventRecord event = eventRepository.findById(eventId)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "event not found"));
		String plantId = resolvePlantId(event);
		if (plantId == null || plantId.isBlank()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "event has no plant id");
		}
		LocalDate day = Instant.ofEpochMilli(event.getCreatedAtLocal()).atZone(ZoneOffset.UTC).toLocalDate();
		MerkleRoot root = merkleRootRepository.findByPlantIdAndDayUtc(plantId, day)
			.orElseThrow(() -> new ResponseStatusException(
				HttpStatus.NOT_FOUND,
				"merkle root not built for plant/day; call POST /api/v1/audit/anchor first"
			));
		List<String> leaves = readLeaves(root.getLeafHashes());
		String leaf = event.getEventHash().toLowerCase(Locale.ROOT);
		int index = leaves.indexOf(leaf);
		if (index < 0) {
			throw new ResponseStatusException(HttpStatus.NOT_FOUND, "event hash not in merkle leaves");
		}
		List<String> path = buildProofPath(leaves, index);
		return new MerkleProofResponse(
			eventId,
			plantId,
			day.toString(),
			root.getRootHash(),
			leaf,
			index,
			path
		);
	}

	public Optional<String> latestRootHash() {
		return merkleRootRepository.findFirstByOrderByCreatedAtDesc().map(MerkleRoot::getRootHash);
	}

	static String computeRoot(List<String> leaves) {
		if (leaves.isEmpty()) {
			return sha256Hex("empty");
		}
		List<String> level = new ArrayList<>(leaves);
		while (level.size() > 1) {
			List<String> next = new ArrayList<>();
			for (int i = 0; i < level.size(); i += 2) {
				String left = level.get(i);
				String right = (i + 1 < level.size()) ? level.get(i + 1) : left;
				next.add(sha256Hex(left + right));
			}
			level = next;
		}
		return level.get(0);
	}

	static List<String> buildProofPath(List<String> leaves, int index) {
		List<String> path = new ArrayList<>();
		List<String> level = new ArrayList<>(leaves);
		int idx = index;
		while (level.size() > 1) {
			List<String> next = new ArrayList<>();
			for (int i = 0; i < level.size(); i += 2) {
				String left = level.get(i);
				String right = (i + 1 < level.size()) ? level.get(i + 1) : left;
				if (i == idx || i + 1 == idx) {
					path.add(i == idx ? right : left);
					idx = next.size();
				}
				next.add(sha256Hex(left + right));
			}
			level = next;
		}
		return path;
	}

	private String resolvePlantId(EventRecord event) {
		try {
			JsonNode json = objectMapper.readTree(event.getPayloadJson());
			JsonNode plant = json.get("plantId");
			if (plant != null && plant.isTextual() && !plant.asText().isBlank()) {
				return plant.asText();
			}
		} catch (Exception ignored) {
			// fall through to float table
		}
		return floatRepository.findById(event.getOperatorPubkey())
			.map(OperatorFloat::getPlantId)
			.orElse("");
	}

	private String writeLeaves(List<String> leaves) {
		try {
			return objectMapper.writeValueAsString(leaves);
		} catch (Exception ex) {
			throw new IllegalStateException("failed to serialize merkle leaves", ex);
		}
	}

	private List<String> readLeaves(String json) {
		try {
			return objectMapper.readValue(json, STRING_LIST);
		} catch (Exception ex) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "corrupt merkle leaf list");
		}
	}

	private static String sha256Hex(String input) {
		try {
			byte[] digest = MessageDigest.getInstance("SHA-256")
				.digest(input.getBytes(StandardCharsets.UTF_8));
			return HEX.formatHex(digest);
		} catch (Exception ex) {
			throw new IllegalStateException("SHA-256 unavailable", ex);
		}
	}
}
