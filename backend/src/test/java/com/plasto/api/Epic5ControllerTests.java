package com.plasto.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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

import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Epic5ControllerTests {

	@Autowired MockMvc mvc;
	@Autowired ObjectMapper objectMapper;

	private static final String PLANT_ID = "plant-a";
	private static final KeyPair ADMIN_KEYPAIR = adminKeyPair();
	private static final String ADMIN_PUBKEY = "base64:" + adminRawPublicKey();

	@Test
	void healthEndpointReturnsOk() throws Exception {
		mvc.perform(get("/api/v1/health"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.status").value("ok"));
	}

	@Test
	void userEventsEndpointReturnsCustomerEventsAfterTimestamp() throws Exception {
		KeyPair operator = keyPair();
		KeyPair customer = keyPair();
		String operatorPubkey = rawPublicKey(operator);
		String customerPubkey = rawPublicKey(customer);
		issueCertificate(operatorPubkey, 10_000);

		Map<String, Object> event = signedEvent(
			operator,
			customer,
			operatorPubkey,
			customerPubkey,
			UUID.randomUUID(),
			"",
			120,
			1_700_000_010_000L,
			"[]"
		);
		mvc.perform(post("/api/v1/sync/batch")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsBytes(Map.of("events", java.util.List.of(event)))))
			.andExpect(status().isOk());

		mvc.perform(get("/api/v1/users/{pubkey}/events", "base64:" + customerPubkey)
				.param("after", "0"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$[0].customerPubkey").value("base64:" + customerPubkey))
			.andExpect(jsonPath("$[0].payloadJson").exists());

		mvc.perform(get("/api/v1/users/{pubkey}/events", "base64:" + customerPubkey)
				.param("after", "17000000100000"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.length()").value(0));
	}

	@Test
	void floatEndpointReturnsRemainingCredits() throws Exception {
		KeyPair operator = keyPair();
		String operatorPubkey = rawPublicKey(operator);
		issueCertificate(operatorPubkey, 500);

		mvc.perform(get("/api/v1/operators/{pubkey}/float", "base64:" + operatorPubkey))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.cap").value(500))
			.andExpect(jsonPath("$.remaining").value(500));
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
		String photoHashes
	) throws Exception {
		String eventType = "DEPOSIT";
		String payloadJson = "{\"credits\":%d}".formatted(credits);
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
}
