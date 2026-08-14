package com.plasto.api.web;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.plasto.api.crypto.SignatureVerifier;
import com.plasto.api.event.EventRepository;
import com.plasto.api.event.SyncEventResponse;

@RestController
@RequestMapping("/api/v1/users")
public class UserEventsController {

	private final EventRepository eventRepository;
	private final SignatureVerifier signatureVerifier;

	public UserEventsController(EventRepository eventRepository, SignatureVerifier signatureVerifier) {
		this.eventRepository = eventRepository;
		this.signatureVerifier = signatureVerifier;
	}

	@GetMapping("/events")
	public List<SyncEventResponse> listEvents(
		@RequestParam("pubkey") String pubkey,
		@RequestParam(name = "after", defaultValue = "0") long after,
		@RequestParam(name = "afterEventId", defaultValue = "00000000-0000-0000-0000-000000000000") UUID afterEventId,
		@RequestHeader(name = "X-Plasto-Pubkey") String proofPubkey,
		@RequestHeader(name = "X-Plasto-Proof") String proofSig
	) {
		if (!pubkeyEquals(pubkey, proofPubkey)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "pubkey proof mismatch");
		}
		String message = "PLASTO_PULL|" + pubkey + "|" + after + "|" + afterEventId;
		if (!signatureVerifier.verify(proofPubkey, proofSig, message)) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid pull proof");
		}
		return eventRepository
			.findCustomerEventsAfterCursor(pubkey, after, afterEventId)
			.stream()
			.map(SyncEventResponse::from)
			.toList();
	}

	private static boolean pubkeyEquals(String pathKey, String headerKey) {
		if (pathKey.equals(headerKey)) {
			return true;
		}
		return strip(pathKey).equals(strip(headerKey));
	}

	private static String strip(String value) {
		String lower = value.toLowerCase();
		for (String prefix : List.of("base58:", "base64:", "base64url:", "hex:")) {
			if (lower.startsWith(prefix)) {
				return value.substring(prefix.length());
			}
		}
		return value;
	}
}
