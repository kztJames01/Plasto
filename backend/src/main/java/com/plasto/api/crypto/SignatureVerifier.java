package com.plasto.api.crypto;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Arrays;
import java.util.Base64;

import org.springframework.stereotype.Component;

@Component
public class SignatureVerifier {

	private static final byte[] ED25519_X509_PREFIX = hexToBytes("302a300506032b6570032100");
	private static final String BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

	public boolean verify(String publicKeyText, String signatureText, String message) {
		try {
			byte[] publicKeyBytes = decodeFlexible(publicKeyText);
			byte[] signatureBytes = decodeFlexible(signatureText);
			if (publicKeyBytes.length == 32) {
				publicKeyBytes = wrapRawEd25519PublicKey(publicKeyBytes);
			}
			if (signatureBytes.length != 64) {
				return false;
			}

			KeyFactory keyFactory = KeyFactory.getInstance("Ed25519");
			PublicKey publicKey = keyFactory.generatePublic(new X509EncodedKeySpec(publicKeyBytes));
			Signature verifier = Signature.getInstance("Ed25519");
			verifier.initVerify(publicKey);
			verifier.update(message.getBytes(StandardCharsets.UTF_8));
			return verifier.verify(signatureBytes);
		} catch (Exception ex) {
			System.err.println("Sig verify exception: " + ex.getClass().getName() + ": " + ex.getMessage());
			return false;
		}
	}

	/**
	 * Decode a public key or signature. Prefixed forms are preferred:
	 * {@code base64:}, {@code base64url:}, {@code hex:}, {@code base58:}.
	 * Unprefixed values are also accepted for mobile clients that store raw
	 * base58 pubkeys and raw base64 signatures locally and sign over those
	 * exact strings — the wire values must match the signed payload.
	 */
	private static byte[] decodeFlexible(String value) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException("empty encoded value");
		}
		String text = value.trim();
		String lower = text.toLowerCase();
		if (lower.startsWith("base64:")) {
			return Base64.getDecoder().decode(text.substring(7));
		}
		if (lower.startsWith("base64url:")) {
			return Base64.getUrlDecoder().decode(text.substring(10));
		}
		if (lower.startsWith("hex:")) {
			return hexToBytes(text.substring(4));
		}
		if (lower.startsWith("base58:")) {
			return decodeBase58(text.substring(7));
		}
		if (text.matches("[0-9a-fA-F]+") && text.length() >= 2 && text.length() % 2 == 0) {
			return hexToBytes(text);
		}

		// Unprefixed mobile wire format: try base64 first (signatures are 64
		// bytes / ~88 chars), then base58 (pubkeys are 32 bytes).
		if (text.matches("^[A-Za-z0-9+/]+={0,2}$") && text.length() % 4 == 0) {
			try {
				byte[] decoded = Base64.getDecoder().decode(text);
				if (decoded.length == 32 || decoded.length == 64) {
					return decoded;
				}
			} catch (IllegalArgumentException ignored) {
				// fall through to base58
			}
		}
		if (isBase58(text)) {
			byte[] decoded = decodeBase58(text);
			if (decoded.length == 32 || decoded.length == 64) {
				return decoded;
			}
		}
		throw new IllegalArgumentException("unsupported key/signature encoding; use base64:, base64url:, hex:, or base58:");
	}

	private static boolean isBase58(String text) {
		if (text.isEmpty()) {
			return false;
		}
		for (int i = 0; i < text.length(); i++) {
			if (BASE58_ALPHABET.indexOf(text.charAt(i)) < 0) {
				return false;
			}
		}
		return true;
	}

	private static byte[] wrapRawEd25519PublicKey(byte[] rawKey) {
		byte[] wrapped = new byte[ED25519_X509_PREFIX.length + rawKey.length];
		System.arraycopy(ED25519_X509_PREFIX, 0, wrapped, 0, ED25519_X509_PREFIX.length);
		System.arraycopy(rawKey, 0, wrapped, ED25519_X509_PREFIX.length, rawKey.length);
		return wrapped;
	}

	private static byte[] hexToBytes(String text) {
		String normalized = text.trim();
		if (normalized.length() % 2 != 0 || !normalized.matches("[0-9a-fA-F]+")) {
			throw new IllegalArgumentException("invalid hex");
		}
		byte[] out = new byte[normalized.length() / 2];
		for (int i = 0; i < out.length; i++) {
			int idx = i * 2;
			out[i] = (byte) Integer.parseInt(normalized.substring(idx, idx + 2), 16);
		}
		return out;
	}

	private static byte[] decodeBase58(String text) {
		BigInteger num = BigInteger.ZERO;
		for (char ch : text.toCharArray()) {
			int digit = BASE58_ALPHABET.indexOf(ch);
			if (digit < 0) {
				throw new IllegalArgumentException("invalid base58");
			}
			num = num.multiply(BigInteger.valueOf(58)).add(BigInteger.valueOf(digit));
		}
		byte[] bytes = num.toByteArray();
		if (bytes.length > 0 && bytes[0] == 0) {
			bytes = Arrays.copyOfRange(bytes, 1, bytes.length);
		}
		int leadingZeros = 0;
		while (leadingZeros < text.length() && text.charAt(leadingZeros) == '1') {
			leadingZeros++;
		}
		byte[] out = new byte[leadingZeros + bytes.length];
		System.arraycopy(bytes, 0, out, leadingZeros, bytes.length);
		return out;
	}

}
