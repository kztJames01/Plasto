package com.plasto.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Signature;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SyncBatchControllerTests {

	@Autowired MockMvc mvc;
	@Autowired ObjectMapper objectMapper;

	private static final byte[][] PHOTO_BODIES = {
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x01 },
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x02 },
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x03 },
	};
	private static final byte[][] ALT_PHOTO_BODIES = {
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x04 },
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x05 },
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x06 },
	};
	private static final byte[][] CHAIN_FIRST_PHOTOS = {
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x07 },
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x08 },
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x09 },
	};
	private static final byte[][] CHAIN_FORK_PHOTOS = {
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x0A },
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x0B },
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x0C },
	};
	private static final byte[][] OPERATOR_ONLY_PHOTOS = {
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x0D },
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x0E },
		new byte[] { (byte) 0xFF, (byte) 0xD8, 0x0F },
	};

	@Test
	void syncBatchAcceptsValidEventAndIsIdempotent() throws Exception {
		uploadBodies(PHOTO_BODIES);
		KeyPair operator = keyPair();
		KeyPair customer = keyPair();
		String operatorPubkey = rawPublicKey(operator);
		String customerPubkey = rawPublicKey(customer);

		issueCertificate(operatorPubkey, 1_000);

		Map<String, Object> event = signedEvent(operator, customer, operatorPubkey, customerPubkey,
			UUID.randomUUID(), "", 100, 1_700_000_000_000L, defaultPhotoHashes());
		Map<String, Object> request = Map.of("events", java.util.List.of(event));

		mvc.perform(post("/api/v1/sync/batch")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(request)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.acceptedCount").value(1));

		mvc.perform(post("/api/v1/sync/batch")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(request)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.duplicateCount").value(1));
	}

	@Test
	void syncBatchRejectsOverFloatEvent() throws Exception {
		uploadBodies(ALT_PHOTO_BODIES);
		KeyPair operator = keyPair();
		KeyPair customer = keyPair();
		String operatorPubkey = rawPublicKey(operator);
		String customerPubkey = rawPublicKey(customer);

		issueCertificate(operatorPubkey, 50);

		Map<String, Object> event = signedEvent(operator, customer, operatorPubkey, customerPubkey,
			UUID.randomUUID(), "", 100, 1_700_000_000_001L, photoHashesFor(ALT_PHOTO_BODIES));
		Map<String, Object> request = Map.of("events", java.util.List.of(event));

		mvc.perform(post("/api/v1/sync/batch")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(request)))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("HTTP_ERROR"));
	}

	@Test
	void syncBatchRejectsHashChainBreak() throws Exception {
		uploadBodies(CHAIN_FIRST_PHOTOS);
		uploadBodies(CHAIN_FORK_PHOTOS);
		// Second event claims a previousHash that does not match the operator's
		// latest persisted event. The server must reject the entire batch.
		KeyPair operator = keyPair();
		KeyPair customer = keyPair();
		String operatorPubkey = rawPublicKey(operator);
		String customerPubkey = rawPublicKey(customer);

		issueCertificate(operatorPubkey, 1_000);

		Map<String, Object> first = signedEvent(operator, customer, operatorPubkey, customerPubkey,
			UUID.randomUUID(), "", 10, 1_700_000_000_010L, photoHashesFor(CHAIN_FIRST_PHOTOS));
		mvc.perform(post("/api/v1/sync/batch")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of("events", java.util.List.of(first)))))
			.andExpect(status().isOk());

		Map<String, Object> forked = signedEvent(operator, customer, operatorPubkey, customerPubkey,
			UUID.randomUUID(), "0".repeat(64), 10, 1_700_000_000_011L, photoHashesFor(CHAIN_FORK_PHOTOS));
		mvc.perform(post("/api/v1/sync/batch")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of("events", java.util.List.of(forked)))))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.message").value("operator hash chain break"));
	}

	@Test
	void syncBatchRejectsOperatorOnlyDeposit() throws Exception {
		uploadBodies(OPERATOR_ONLY_PHOTOS);
		KeyPair operator = keyPair();
		String operatorPubkey = rawPublicKey(operator);
		issueCertificate(operatorPubkey, 1_000);

		String eventType = "DEPOSIT";
		String payloadJson = "{\"credits\":10}";
		UUID eventId = UUID.randomUUID();
		long createdAt = 1_700_000_000_020L;
		String eventHash = sha256(eventId.toString() + "|" + eventType + "|" + payloadJson + "|" + createdAt);
		String photos = photoHashesFor(OPERATOR_ONLY_PHOTOS);
		String payload = String.join("|",
			eventId.toString(), eventType, payloadJson,
			"", "base64:" + operatorPubkey,
			photos, "", eventHash, String.valueOf(createdAt));
		Map<String, Object> event = new LinkedHashMap<>();
		event.put("eventId", eventId.toString());
		event.put("eventType", eventType);
		event.put("payloadJson", payloadJson);
		event.put("customerPubkey", "");
		event.put("operatorPubkey", "base64:" + operatorPubkey);
		event.put("customerSig", "");
		event.put("operatorSig", sign(operator, payload));
		event.put("photoHashes", photos);
		event.put("previousHash", "");
		event.put("eventHash", eventHash);
		event.put("createdAtLocal", createdAt);

		mvc.perform(post("/api/v1/sync/batch")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of("events", java.util.List.of(event)))))
			.andExpect(status().isBadRequest());
	}

	@Test
	void photoUploadRejectsBadSignature() throws Exception {
		// First presign a real URL, then submit the upload with a tampered
		// signature. The endpoint must reject with 403.
		String hash = "c".repeat(64);
		String presignJson = mvc.perform(post("/api/v1/photos/presigned")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of(
					"hash", hash,
					"contentType", "image/jpeg"))))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		String uploadUrl = objectMapper.readTree(presignJson).get("uploadUrl").asText();

		// Tamper with the signature.
		String tampered = uploadUrl.replaceAll("sig=[0-9a-f]+", "sig=" + "0".repeat(64));

		mvc.perform(post(tampered.replace("http://localhost:8080", ""))
				.contentType(MediaType.APPLICATION_OCTET_STREAM)
				.content(new byte[] { 0x01, 0x02, 0x03 }))
			.andExpect(status().isForbidden());
	}

	@Test
	void photoPresignRejectsDisallowedContentType() throws Exception {
		// @Pattern fires first with 400; the service-level allowlist would return
		// 415 if the pattern were loosened. Either is acceptable as long as it is 4xx.
		mvc.perform(post("/api/v1/photos/presigned")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of(
					"hash", "d".repeat(64),
					"contentType", "application/zip"))))
			.andExpect(status().is4xxClientError());
	}

	@Test
	void photoPresignCreatesUploadRecord() throws Exception {
		mvc.perform(post("/api/v1/photos/presigned")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of(
					"hash", "b".repeat(64),
					"contentType", "image/jpeg"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.objectKey").value("photos/bb/%s.jpg".formatted("b".repeat(64))));
	}

	private static final String PLANT_ID = "plant-a";
	private static final KeyPair ADMIN_KEYPAIR = adminKeyPair();
	private static final String ADMIN_PUBKEY = "base64:" + adminRawPublicKey();

	private static KeyPair adminKeyPair() {
		try {
			return KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
		} catch (Exception ex) {
			throw new IllegalStateException(ex);
		}
	}

	private static String adminRawPublicKey() {
		byte[] encoded = ADMIN_KEYPAIR.getPublic().getEncoded();
		byte[] raw = java.util.Arrays.copyOfRange(encoded, encoded.length - 32, encoded.length);
		return Base64.getEncoder().encodeToString(raw);
	}

	private String defaultPhotoHashes() throws Exception {
		return photoHashesFor(PHOTO_BODIES);
	}

	private String photoHashesFor(byte[][] bodies) throws Exception {
		java.util.List<String> hashes = new java.util.ArrayList<>();
		for (byte[] body : bodies) {
			hashes.add(sha256Bytes(body));
		}
		return objectMapper.writeValueAsString(hashes);
	}

	private void uploadBodies(byte[][] bodies) throws Exception {
		for (byte[] body : bodies) {
			uploadPhoto(sha256Bytes(body), body);
		}
	}

	private void uploadPhoto(String hash, byte[] body) throws Exception {
		String presignJson = mvc.perform(post("/api/v1/photos/presigned")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of(
					"hash", hash,
					"contentType", "image/jpeg"))))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		JsonNode presign = objectMapper.readTree(presignJson);
		String fullUploadUrl = presign.get("uploadUrl").asText();
		String completeToken = presign.get("completeToken").asText();
		java.net.URI uri = java.net.URI.create(fullUploadUrl);
		java.util.Map<String, String> params = new java.util.HashMap<>();
		for (String part : uri.getQuery().split("&")) {
			String[] kv = part.split("=", 2);
			params.put(kv[0], java.net.URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
		}
		mvc.perform(put(uri.getPath())
				.param("expires", params.get("expires"))
				.param("ct", params.get("ct"))
				.param("sig", params.get("sig"))
				.contentType(MediaType.IMAGE_JPEG)
				.content(body))
			.andExpect(status().isOk());
		mvc.perform(post("/api/v1/photos/complete")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of(
					"hash", hash,
					"completeToken", completeToken,
					"bytes", body.length))))
			.andExpect(status().isOk());
	}

	private static String sha256Bytes(byte[] input) throws Exception {
		byte[] hash = MessageDigest.getInstance("SHA-256").digest(input);
		StringBuilder out = new StringBuilder(hash.length * 2);
		for (byte b : hash) {
			out.append(String.format("%02x", b));
		}
		return out.toString();
	}

	private void issueCertificate(String operatorPubkey, long floatCap) throws Exception {
		String wireOpPubkey = "base64:" + operatorPubkey;
		String adminSig = sign(ADMIN_KEYPAIR, "PLASTO_ISSUE_CERT|" + wireOpPubkey + "|" + PLANT_ID + "|" + floatCap + "|" + ADMIN_PUBKEY);
		mvc.perform(post("/api/v1/admin/certificates")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of(
					"operatorPubkey", wireOpPubkey,
					"plantId", PLANT_ID,
					"floatCap", floatCap,
					"adminPubkey", ADMIN_PUBKEY,
					"adminSig", adminSig))))
			.andExpect(status().isOk());
	}

	private Map<String, Object> signedEvent(
		KeyPair operator,
		KeyPair customer,
		String operatorPubkey,
		String customerPubkey,
		UUID eventId,
		String previousHash,
		long credits,
		long createdAt,
		String photoHashes
	) throws Exception {
		String eventType = "DEPOSIT";
		String payloadJson = "{\"credits\":%d}".formatted(credits);
		// Server now includes eventId and pipes between fields; match exactly.
		String eventHash = sha256(eventId.toString() + "|" + eventType + "|" + payloadJson + "|" + previousHash + "|" + createdAt);
		// The server reconstructs the signing payload from the wire fields
		// verbatim, so the test must use the same wire-encoded strings here
		// (operatorPubkey/customerPubkey are sent with the "base64:" prefix).
		String payload = String.join("|",
			eventId.toString(), eventType, payloadJson,
			"base64:" + customerPubkey, "base64:" + operatorPubkey,
			photoHashes, previousHash, eventHash, String.valueOf(createdAt));
		Map<String, Object> event = new LinkedHashMap<>();
		event.put("eventId", eventId.toString());
		event.put("eventType", eventType);
		event.put("payloadJson", payloadJson);
		event.put("customerPubkey", "base64:" + customerPubkey);
		event.put("operatorPubkey", "base64:" + operatorPubkey);
		event.put("customerSig", sign(customer, payload));
		event.put("operatorSig", sign(operator, payload));
		event.put("photoHashes", photoHashes);
		event.put("previousHash", previousHash);
		event.put("eventHash", eventHash);
		event.put("createdAtLocal", createdAt);
		return event;
	}

	private static KeyPair keyPair() throws Exception {
		return KeyPairGenerator.getInstance("Ed25519").generateKeyPair();
	}

	private static String rawPublicKey(KeyPair keyPair) {
		byte[] encoded = keyPair.getPublic().getEncoded();
		byte[] raw = java.util.Arrays.copyOfRange(encoded, encoded.length - 32, encoded.length);
		return Base64.getEncoder().encodeToString(raw);
	}

	private static String sign(KeyPair keyPair, String payload) throws Exception {
		Signature signature = Signature.getInstance("Ed25519");
		signature.initSign(keyPair.getPrivate());
		signature.update(payload.getBytes(StandardCharsets.UTF_8));
		// Prefix with base64: so the server's strict SignatureVerifier can
		// decode it without ambiguity.
		return "base64:" + Base64.getEncoder().encodeToString(signature.sign());
	}

	private static String sha256(String input) throws Exception {
		byte[] hash = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
		StringBuilder out = new StringBuilder(hash.length * 2);
		for (byte b : hash) {
			out.append(String.format("%02x", b));
		}
		return out.toString();
	}
}
