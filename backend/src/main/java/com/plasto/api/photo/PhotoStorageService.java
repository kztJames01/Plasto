package com.plasto.api.photo;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PhotoStorageService {

	private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
		"image/jpeg", "image/png", "image/webp", "image/heic"
	);
	private static final HexFormat HEX = HexFormat.of();

	private final PhotoUploadRepository repository;
	private final String uploadBaseUrl;
	private final byte[] signingKey;

	public PhotoStorageService(
		PhotoUploadRepository repository,
		@Value("${plasto.photos.upload-base-url:http://localhost:8080/local-photo-upload}") String uploadBaseUrl,
		@Value("${plasto.photos.signing-key:dev-only-do-not-use-in-prod}") String signingKey
	) {
		this.repository = repository;
		this.uploadBaseUrl = uploadBaseUrl.replaceAll("/+$", "");
		this.signingKey = signingKey.getBytes(StandardCharsets.UTF_8);
		if (this.signingKey.length < 32) {
			throw new IllegalStateException("plasto.photos.signing-key must be at least 32 bytes");
		}
	}

	@Transactional
	public PhotoPresignResponse createPresignedUpload(PhotoPresignRequest request) {
		String hash = request.hash().toLowerCase(Locale.ROOT);
		if (!isValidSha256Hex(hash)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "hash must be a SHA-256 hex digest");
		}
		String contentType = request.contentType().toLowerCase(Locale.ROOT);
		if (!ALLOWED_CONTENT_TYPES.contains(contentType)) {
			throw new ResponseStatusException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "contentType not allowed");
		}
		Instant expiresAt = Instant.now().plus(15, ChronoUnit.MINUTES);
		String objectKey = "photos/" + hash.substring(0, 2) + "/" + hash + ".jpg";
		String signature = sign(objectKey, contentType, expiresAt);
		String uploadUrl = "%s/%s?expires=%d&ct=%s&sig=%s".formatted(
			uploadBaseUrl, objectKey, expiresAt.getEpochSecond(),
			java.net.URLEncoder.encode(contentType, StandardCharsets.UTF_8),
			signature);

		PhotoUpload upload = repository.findById(hash).orElseGet(PhotoUpload::new);
		upload.setPhotoHash(hash);
		upload.setEventId(request.eventId());
		upload.setContentType(contentType);
		upload.setObjectKey(objectKey);
		upload.setUploadUrl(uploadUrl);
		upload.setExpiresAt(expiresAt);
		repository.save(upload);

		return new PhotoPresignResponse(hash, objectKey, uploadUrl, expiresAt);
	}

	public boolean verifySignature(String objectKey, String contentType, long expiresEpochSecond, String signatureHex) {
		if (signatureHex == null || signatureHex.isBlank()) {
			return false;
		}
		Instant expires = Instant.ofEpochSecond(expiresEpochSecond);
		if (Instant.now().isAfter(expires)) {
			return false;
		}
		String expected = sign(objectKey, contentType, expires);
		return constantTimeEquals(expected, signatureHex.toLowerCase(Locale.ROOT));
	}

	private String sign(String objectKey, String contentType, Instant expiresAt) {
		try {
			String macInput = objectKey + "|" + contentType + "|" + expiresAt.getEpochSecond();
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(signingKey, "HmacSHA256"));
			byte[] sig = mac.doFinal(macInput.getBytes(StandardCharsets.UTF_8));
			return HEX.formatHex(sig);
		} catch (Exception ex) {
			throw new IllegalStateException("HMAC-SHA256 unavailable", ex);
		}
	}

	private static boolean isValidSha256Hex(String value) {
		return value.length() == 64 && value.matches("[0-9a-f]+");
	}

	private static boolean constantTimeEquals(String a, String b) {
		byte[] aa = a.getBytes(StandardCharsets.UTF_8);
		byte[] bb = b.getBytes(StandardCharsets.UTF_8);
		return MessageDigest.isEqual(aa, bb);
	}
}
