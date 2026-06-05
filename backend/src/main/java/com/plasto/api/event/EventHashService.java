package com.plasto.api.event;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import org.springframework.stereotype.Component;

@Component
public class EventHashService {

	public String computeEventHash(SyncEventRequest event) {
		String previous = event.previousHash() == null ? "" : event.previousHash();
		String input = event.eventType() + event.payloadJson() + previous + event.createdAtLocal();
		return sha256Hex(input);
	}

	public String signingPayload(SyncEventRequest event) {
		return String.join("|",
			event.eventId().toString(),
			event.eventType(),
			event.payloadJson(),
			nullToEmpty(event.customerPubkey()),
			event.operatorPubkey(),
			nullToEmpty(event.photoHashes()),
			nullToEmpty(event.previousHash()),
			event.eventHash(),
			String.valueOf(event.createdAtLocal())
		);
	}

	private static String sha256Hex(String input) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
			StringBuilder out = new StringBuilder(hash.length * 2);
			for (byte b : hash) {
				out.append(String.format("%02x", b));
			}
			return out.toString();
		} catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException("SHA-256 not available", ex);
		}
	}

	private static String nullToEmpty(String value) {
		return value == null ? "" : value;
	}
}
