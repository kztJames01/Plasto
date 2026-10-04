package com.plasto.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.Signature;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
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
class WalletTests {

	@Autowired MockMvc mvc;
	@Autowired ObjectMapper objectMapper;

	private static final String PLANT_ID = "plant-wallet";
	private static final KeyPair ADMIN_KEYPAIR = adminKeyPair();
	private static final String ADMIN_PUBKEY = "base64:" + adminRawPublicKey();

	@Test
	void photoGetReturnsUploadedBytes() throws Exception {
		byte[] jpegish = new byte[] { (byte) 0xFF, (byte) 0xD8, (byte) 0xEE, 0x07 };
		String hash = uploadPhoto(jpegish);
		mvc.perform(get("/api/v1/photos/" + hash))
			.andExpect(status().isOk());
	}

	@Test
	void redeemRejectedWhenCustomerHasNoBalance() throws Exception {
		KeyPair operator = keyPair();
		KeyPair customer = keyPair();
		String operatorPubkey = rawPublicKey(operator);
		String customerPubkey = rawPublicKey(customer);
		issueCertificate(operatorPubkey, 5_000);

		Map<String, Object> redeem = signedEvent(
			operator, customer, operatorPubkey, customerPubkey,
			UUID.randomUUID(), "", 40, 1_710_000_000_000L, "[]", "REDEEM", "{\"credits\":40}"
		);
		mvc.perform(post("/api/v1/sync/batch")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of("events", List.of(redeem)))))
			.andExpect(status().isConflict());
	}

	@Test
	void redeemAcceptedAfterMatchingDeposit() throws Exception {
		KeyPair operator = keyPair();
		KeyPair customer = keyPair();
		String operatorPubkey = rawPublicKey(operator);
		String customerPubkey = rawPublicKey(customer);
		issueCertificate(operatorPubkey, 5_000);

		byte[][] photos = uniqueJpegs(3);
		List<String> hashes = new ArrayList<>();
		for (byte[] p : photos) {
			hashes.add(uploadPhoto(p));
		}
		String photoJson = objectMapper.writeValueAsString(hashes);

		UUID depositId = UUID.randomUUID();
		long created = 1_710_000_100_000L;
		Map<String, Object> deposit = signedEvent(
			operator, customer, operatorPubkey, customerPubkey,
			depositId, "", 80, created, photoJson, "DEPOSIT", "{\"credits\":80}"
		);
		mvc.perform(post("/api/v1/sync/batch")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of("events", List.of(deposit)))))
			.andExpect(status().isOk());

		String prev = (String) deposit.get("eventHash");
		Map<String, Object> redeem = signedEvent(
			operator, customer, operatorPubkey, customerPubkey,
			UUID.randomUUID(), prev, 25, created + 1, "[]", "REDEEM", "{\"credits\":25}"
		);
		mvc.perform(post("/api/v1/sync/batch")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of("events", List.of(redeem)))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.acceptedCount").value(1));
	}

	private String uploadPhoto(byte[] body) throws Exception {
		String hash = sha256Bytes(body);
		String presignJson = mvc.perform(post("/api/v1/photos/presigned")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of(
					"hash", hash,
					"contentType", "image/jpeg"))))
			.andExpect(status().isOk())
			.andReturn().getResponse().getContentAsString();
		JsonNode presign = objectMapper.readTree(presignJson);
		java.net.URI uri = java.net.URI.create(presign.get("uploadUrl").asText());
		Map<String, String> params = new java.util.HashMap<>();
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
					"completeToken", presign.get("completeToken").asText(),
					"bytes", body.length))))
			.andExpect(status().isOk());
		return hash;
	}

	private void issueCertificate(String operatorPubkey, long floatCap) throws Exception {
		String wireOpPubkey = "base64:" + operatorPubkey;
		String adminSig = sign(
			ADMIN_KEYPAIR,
			"PLASTO_ISSUE_CERT|" + wireOpPubkey + "|" + PLANT_ID + "|" + floatCap + "|" + ADMIN_PUBKEY
		);
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
		String photoHashes,
		String eventType,
		String payloadJson
	) throws Exception {
		String eventHash = sha256(eventId.toString() + "|" + eventType + "|" + payloadJson + "|" + previousHash + "|" + createdAt);
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

	private static byte[][] uniqueJpegs(int n) {
		byte[][] out = new byte[n][];
		for (int i = 0; i < n; i++) {
			UUID id = UUID.randomUUID();
			out[i] = new byte[] {
				(byte) 0xFF, (byte) 0xD8, (byte) 0xAA, (byte) i,
				(byte) id.getMostSignificantBits(), (byte) (id.getMostSignificantBits() >> 8),
				(byte) id.getLeastSignificantBits(), (byte) (id.getLeastSignificantBits() >> 8)
			};
		}
		return out;
	}

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

	private static String sha256Bytes(byte[] input) throws Exception {
		byte[] hash = MessageDigest.getInstance("SHA-256").digest(input);
		StringBuilder out = new StringBuilder(hash.length * 2);
		for (byte b : hash) {
			out.append(String.format("%02x", b));
		}
		return out.toString();
	}
}
