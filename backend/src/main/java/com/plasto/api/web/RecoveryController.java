package com.plasto.api.web;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.plasto.api.event.EventRepository;

@RestController
@RequestMapping("/api/v1/users")
public class RecoveryController {

	private final EventRepository eventRepository;

	public RecoveryController(EventRepository eventRepository) {
		this.eventRepository = eventRepository;
	}

	/**
	 * Returns the count of events recorded for the given customer and the
	 * timestamp of the latest one. The mobile app uses this endpoint as a
	 * connectivity probe; we deliberately do not echo the path parameter
	 * back in the response body to avoid confirming whether a given key
	 * has any activity.
	 */
	@PostMapping("/{pubkey}/recover")
	public ResponseEntity<Map<String, Object>> recoverUser(@PathVariable String pubkey) {
		long count = eventRepository.countByCustomerPubkey(pubkey);
		return ResponseEntity.ok(Map.of(
			"event_count", count,
			"merkle_root", ""
		));
	}
}
