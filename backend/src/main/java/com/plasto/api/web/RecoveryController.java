package com.plasto.api.web;

import java.util.HashMap;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.plasto.api.audit.MerkleTreeService;
import com.plasto.api.event.EventRepository;

@RestController
@RequestMapping("/api/v1/users")
public class RecoveryController {

	private final EventRepository eventRepository;
	private final MerkleTreeService merkleTreeService;

	public RecoveryController(EventRepository eventRepository, MerkleTreeService merkleTreeService) {
		this.eventRepository = eventRepository;
		this.merkleTreeService = merkleTreeService;
	}

	/** Preferred: query param avoids '/' in base64 path segments. */
	@PostMapping("/recover")
	public ResponseEntity<Map<String, Object>> recoverUserQuery(@RequestParam("pubkey") String pubkey) {
		return recover(pubkey);
	}

	/** Legacy path form for base58 pubkeys (no '/'). */
	@PostMapping("/{pubkey}/recover")
	public ResponseEntity<Map<String, Object>> recoverUserPath(@PathVariable String pubkey) {
		return recover(pubkey);
	}

	private ResponseEntity<Map<String, Object>> recover(String pubkey) {
		long count = eventRepository.countByCustomerPubkey(pubkey);
		Map<String, Object> body = new HashMap<>();
		body.put("event_count", count);
		body.put("merkle_root", merkleTreeService.latestRootHash().orElse(""));
		return ResponseEntity.ok(body);
	}
}
