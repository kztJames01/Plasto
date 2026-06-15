package com.plasto.api.event;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

import org.springframework.stereotype.Component;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

@Component
public class EventHashService {

	public String computeEventHash(SyncEventRequest event) {
		String previous = event.previousHash() == null ? "" : event.previousHash();
		String canonicalPayload = canonicalizePayloadJson(event.payloadJson());
		String input = event.eventId().toString()
			+ "|" + event.eventType()
			+ "|" + canonicalPayload
			+ "|" + previous
			+ "|" + event.createdAtLocal();
		return sha256Hex(input);
	}

	public String canonicalizePayloadJson(String payloadJson) {
		if (payloadJson == null) {
			return "";
		}
		try {
			return CanonicalJson.canonicalize(payloadJson);
		} catch (Exception ex) {
			// Fall back to raw input if it is not JSON; the caller will reject the
			// event as a malformed payload further upstream.
			return payloadJson;
		}
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

final class CanonicalJson {
	private static final ObjectMapper MAPPER = new ObjectMapper();

	private CanonicalJson() {}

	static String canonicalize(String json) throws Exception {
		JsonNode node = MAPPER.readTree(json);
		java.io.StringWriter writer = new java.io.StringWriter();
		try (JsonGenerator gen = MAPPER.getFactory().createGenerator(writer)) {
			writeCanonical(gen, node);
		}
		return writer.toString();
	}

	private static void writeCanonical(JsonGenerator gen, JsonNode node) throws Exception {
		if (node == null || node.isNull()) {
			gen.writeNull();
		} else if (node.isObject()) {
			ObjectNode obj = (ObjectNode) node;
			gen.writeStartObject();
			java.util.TreeMap<String, JsonNode> sorted = new java.util.TreeMap<>();
			obj.fields().forEachRemaining(e -> sorted.put(e.getKey(), e.getValue()));
			for (java.util.Map.Entry<String, JsonNode> e : sorted.entrySet()) {
				gen.writeFieldName(e.getKey());
				writeCanonical(gen, e.getValue());
			}
			gen.writeEndObject();
		} else if (node.isArray()) {
			ArrayNode arr = (ArrayNode) node;
			gen.writeStartArray();
			for (JsonNode child : arr) {
				writeCanonical(gen, child);
			}
			gen.writeEndArray();
		} else if (node.isTextual()) {
			gen.writeString(node.textValue());
		} else if (node.isBoolean()) {
			gen.writeBoolean(node.booleanValue());
		} else if (node.isNumber()) {
			// Write numbers as a string to avoid Jackson formatting differences.
			gen.writeNumber(node.decimalValue().toPlainString());
		} else {
			gen.writeString(node.asText());
		}
	}
}
