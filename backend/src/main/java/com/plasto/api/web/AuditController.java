package com.plasto.api.web;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.plasto.api.audit.MerkleProofResponse;
import com.plasto.api.audit.MerkleRoot;
import com.plasto.api.audit.MerkleTreeService;

@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {

	private final MerkleTreeService merkleTreeService;

	public AuditController(MerkleTreeService merkleTreeService) {
		this.merkleTreeService = merkleTreeService;
	}

	/**
	 * Builds (or rebuilds) the daily Merkle root for a plant and seals it.
	 * Polygon PoS publish is optional P2 — this stores a local anchor marker.
	 */
	@PostMapping("/anchor")
	public ResponseEntity<Map<String, Object>> anchor(
		@RequestParam("plantId") String plantId,
		@RequestParam(name = "day", required = false)
		@DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate day
	) {
		LocalDate dayUtc = day == null ? LocalDate.now(java.time.ZoneOffset.UTC) : day;
		MerkleRoot root = merkleTreeService.anchor(plantId, dayUtc);
		return ResponseEntity.ok(Map.of(
			"plantId", root.getPlantId(),
			"dayUtc", root.getDayUtc().toString(),
			"rootHash", root.getRootHash(),
			"eventCount", root.getEventCount(),
			"anchoredAt", root.getAnchoredAt() == null ? "" : root.getAnchoredAt().toString(),
			"chainTx", root.getChainTx() == null ? "" : root.getChainTx()
		));
	}

	@GetMapping("/proof")
	public ResponseEntity<MerkleProofResponse> proof(@RequestParam("event_id") UUID eventId) {
		return ResponseEntity.ok(merkleTreeService.proofForEvent(eventId));
	}
}
