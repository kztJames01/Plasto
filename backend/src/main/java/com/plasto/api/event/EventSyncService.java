package com.plasto.api.event;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.plasto.api.certificate.CertificateService;
import com.plasto.api.certificate.OperatorCertificate;
import com.plasto.api.crypto.SignatureVerifier;
import com.plasto.api.floatcap.FloatService;

@Service
public class EventSyncService {

	private static final TypeReference<List<String>> PHOTO_HASH_LIST = new TypeReference<>() {};

	private final EventRepository eventRepository;
	private final CertificateService certificateService;
	private final FloatService floatService;
	private final EventHashService hashService;
	private final SignatureVerifier signatureVerifier;
	private final ObjectMapper objectMapper;

	public EventSyncService(
		EventRepository eventRepository,
		CertificateService certificateService,
		FloatService floatService,
		EventHashService hashService,
		SignatureVerifier signatureVerifier,
		ObjectMapper objectMapper
	) {
		this.eventRepository = eventRepository;
		this.certificateService = certificateService;
		this.floatService = floatService;
		this.hashService = hashService;
		this.signatureVerifier = signatureVerifier;
		this.objectMapper = objectMapper;
	}

	@Transactional
	public SyncBatchResponse sync(SyncBatchRequest request) {
		List<String> acknowledged = new ArrayList<>();
		List<String> duplicates = new ArrayList<>();
		Map<String, String> latestHashByOperator = new HashMap<>();
		Map<String, Long> creditsByOperator = new HashMap<>();
		Map<String, String> plantByOperator = new HashMap<>();
		Set<String> photoHashesInBatch = new HashSet<>();

		for (SyncEventRequest event : request.events()) {
			validateEventHash(event);

			var existing = eventRepository.findById(event.eventId());
			if (existing.isPresent()) {
				if (!existing.get().getEventHash().equalsIgnoreCase(event.eventHash())) {
					throw new ResponseStatusException(HttpStatus.CONFLICT, "event_id already exists with different hash");
				}
				acknowledged.add(event.eventId().toString());
				duplicates.add(event.eventId().toString());
				continue;
			}

			OperatorCertificate certificate = certificateService.requireValidCertificate(event.operatorPubkey());
			validateSignatures(event);
			validatePhotoHashes(event, photoHashesInBatch);
			validateHashChain(event, latestHashByOperator);

			long credits = creditsIssued(event);
			if (credits > 0) {
				creditsByOperator.merge(event.operatorPubkey(), credits, Long::sum);
				plantByOperator.put(event.operatorPubkey(), certificate.getPlantId());
			}

			eventRepository.save(toRecord(event));
			latestHashByOperator.put(event.operatorPubkey(), event.eventHash());
			acknowledged.add(event.eventId().toString());
		}

		creditsByOperator.forEach((operatorPubkey, credits) ->
			floatService.consume(operatorPubkey, plantByOperator.get(operatorPubkey), credits));

		return new SyncBatchResponse(acknowledged, duplicates, acknowledged.size() - duplicates.size(), duplicates.size());
	}

	private void validateEventHash(SyncEventRequest event) {
		String expected = hashService.computeEventHash(event);
		if (!expected.equalsIgnoreCase(event.eventHash())) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "event_hash does not match event contents");
		}
	}

	private void validateSignatures(SyncEventRequest event) {
		String payload = hashService.signingPayload(event);
		if (!signatureVerifier.verify(event.operatorPubkey(), event.operatorSig(), payload)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid operator signature");
		}
		if (event.customerPubkey() != null && !event.customerPubkey().isBlank()) {
			if (event.customerSig() == null || event.customerSig().isBlank()) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "missing customer signature");
			}
			if (!signatureVerifier.verify(event.customerPubkey(), event.customerSig(), payload)) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid customer signature");
			}
		}
	}

	private void validatePhotoHashes(SyncEventRequest event, Set<String> photoHashesInBatch) {
		for (String hash : parsePhotoHashes(event.photoHashes())) {
			if (!photoHashesInBatch.add(hash)) {
				throw new ResponseStatusException(HttpStatus.CONFLICT, "duplicate photo hash in batch");
			}
			if (eventRepository.existsByPhotoHashesContaining(hash)) {
				throw new ResponseStatusException(HttpStatus.CONFLICT, "photo hash already exists");
			}
		}
	}

	private void validateHashChain(SyncEventRequest event, Map<String, String> latestHashByOperator) {
		String expectedPrevious = latestHashByOperator.computeIfAbsent(event.operatorPubkey(), op ->
			eventRepository.findFirstByOperatorPubkeyOrderByCreatedAtLocalDescReceivedAtDesc(op)
				.map(EventRecord::getEventHash)
				.orElse(""));
		String actualPrevious = event.previousHash() == null ? "" : event.previousHash();
		if (!expectedPrevious.equals(actualPrevious)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "operator hash chain break");
		}
	}

	private List<String> parsePhotoHashes(String photoHashes) {
		if (photoHashes == null || photoHashes.isBlank()) {
			return List.of();
		}
		try {
			List<String> hashes = objectMapper.readValue(photoHashes, PHOTO_HASH_LIST);
			return hashes.stream().filter(h -> h != null && !h.isBlank()).toList();
		} catch (Exception ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "photo_hashes must be a JSON string array");
		}
	}

	private long creditsIssued(SyncEventRequest event) {
		if (!"DEPOSIT".equalsIgnoreCase(event.eventType()) && !"ADJUST".equalsIgnoreCase(event.eventType())) {
			return 0;
		}
		try {
			JsonNode json = objectMapper.readTree(event.payloadJson());
			long credits = firstLong(json, "credits", "creditAmount", "credit_amount", "amount_credits");
			return Math.max(credits, 0);
		} catch (Exception ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "payload_json must be valid JSON");
		}
	}

	private long firstLong(JsonNode json, String... fields) {
		for (String field : fields) {
			JsonNode node = json.get(field);
			if (node != null && node.canConvertToLong()) {
				return node.longValue();
			}
		}
		return 0;
	}

	private EventRecord toRecord(SyncEventRequest event) {
		EventRecord record = new EventRecord();
		record.setEventId(event.eventId());
		record.setEventType(event.eventType());
		record.setPayloadJson(event.payloadJson());
		record.setCustomerPubkey(event.customerPubkey());
		record.setOperatorPubkey(event.operatorPubkey());
		record.setCustomerSig(event.customerSig());
		record.setOperatorSig(event.operatorSig());
		record.setPhotoHashes(event.photoHashes());
		record.setPreviousHash(event.previousHash());
		record.setEventHash(event.eventHash());
		record.setCreatedAtLocal(event.createdAtLocal());
		record.setReceivedAt(Instant.now());
		return record;
	}
}
