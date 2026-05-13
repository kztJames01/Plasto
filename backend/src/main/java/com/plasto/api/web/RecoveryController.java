package com.plasto.api.web;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users/{pubkey}/recover")
public class RecoveryController {

	@PostMapping
	public ResponseEntity<Map<String, Object>> recoverUser(@PathVariable String pubkey) {
		// placeholder - returns empty merkle root for now
		// in production: query events table for last merkle root
		return ResponseEntity.ok(Map.of(
			"pubkey", pubkey,
			"merkle_root", "",
			"event_count", 0,
			"last_event_at", ""
		));
	}
}
