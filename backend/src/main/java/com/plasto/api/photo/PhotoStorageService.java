package com.plasto.api.photo;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

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
	private final Path localStore;

	public PhotoStorageService(
		PhotoUploadRepository repository,
		@Value("${plasto.photos.upload-base-url:http://localhost:8080/local-photo-upload}") String uploadBaseUrl,
		@Value("${plasto.photos.signing-key:dev-only-do-not-use-in-prod}") String signingKey,
		@Value("${plasto.photos.local-store:./data/photo-uploads}") String localStore
	) {
		this.repository = repository;
		this.uploadBaseUrl = uploadBaseUrl.replaceAll("/+$", "");
		this.signingKey = signingKey.getBytes(StandardCharsets.UTF_8);
		if (this.signingKey.length < 32) {
			throw new IllegalStateException("plasto.photos.signing-key must be at least 32 bytes");
		}
		this.localStore = Path.of(localStore).toAbsolutePath().normalize();
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
		String completeToken = signCompleteToken(hash, objectKey, expiresAt);
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
		upload.setCompleteToken(completeToken);
		upload.setUploaded(false);
		upload.setReceivedBytes(0);
		repository.save(upload);

		return new PhotoPresignResponse(hash, objectKey, uploadUrl, expiresAt, completeToken);
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

	@Transactional
	public long storeLocalUpload(String objectKey, byte[] body) {
		if (body == null || body.length == 0) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "empty upload body");
		}
		if (body.length > 15_000_000) {
			throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "photo too large");
		}
		PhotoUpload upload = repository.findByObjectKey(objectKey)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "presigned upload not found"));
		if (Instant.now().isAfter(upload.getExpiresAt())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "upload URL expired");
		}
		try {
			Path target = localStore.resolve(upload.getPhotoHash() + ".bin").normalize();
			if (!target.startsWith(localStore)) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bad object path");
			}
			Files.createDirectories(localStore);
			Files.write(target, body);
		} catch (ResponseStatusException ex) {
			throw ex;
		} catch (Exception ex) {
			throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to store photo");
		}
		upload.setReceivedBytes(body.length);
		repository.save(upload);
		return body.length;
	}

	@Transactional
	public PhotoUpload completeUpload(String hash, String completeToken, long claimedBytes) {
		String normalized = hash.toLowerCase(Locale.ROOT);
		PhotoUpload upload = repository.findById(normalized)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "presigned upload not found"));
		if (upload.getCompleteToken() == null || !constantTimeEquals(upload.getCompleteToken(), completeToken)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "invalid complete token");
		}
		if (Instant.now().isAfter(upload.getExpiresAt())) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "upload expired");
		}
		if (upload.getReceivedBytes() <= 0) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "photo bytes were not received");
		}
		if (claimedBytes > 0 && claimedBytes != upload.getReceivedBytes()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "byte count mismatch");
		}
		Path stored = localStore.resolve(upload.getPhotoHash() + ".bin");
		if (!Files.isRegularFile(stored)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "photo file missing on server");
		}
		upload.setUploaded(true);
		repository.save(upload);
		return upload;
	}

	private String signCompleteToken(String hash, String objectKey, Instant expiresAt) {
		return sign("complete|" + hash + "|" + objectKey, "token", expiresAt);
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
