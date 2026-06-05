package com.plasto.api.photo;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PhotoStorageService {

	private final PhotoUploadRepository repository;
	private final String uploadBaseUrl;

	public PhotoStorageService(
		PhotoUploadRepository repository,
		@Value("${plasto.photos.upload-base-url:http://localhost:8080/local-photo-upload}") String uploadBaseUrl
	) {
		this.repository = repository;
		this.uploadBaseUrl = uploadBaseUrl.replaceAll("/+$", "");
	}

	@Transactional
	public PhotoPresignResponse createPresignedUpload(PhotoPresignRequest request) {
		String hash = request.hash().toLowerCase(Locale.ROOT);
		Instant expiresAt = Instant.now().plus(15, ChronoUnit.MINUTES);
		String objectKey = "photos/%s/%s.jpg".formatted(hash.substring(0, 2), hash);
		String uploadUrl = "%s/%s?expires=%d".formatted(uploadBaseUrl, objectKey, expiresAt.getEpochSecond());

		PhotoUpload upload = repository.findById(hash).orElseGet(PhotoUpload::new);
		upload.setPhotoHash(hash);
		upload.setEventId(request.eventId());
		upload.setContentType(request.contentType());
		upload.setObjectKey(objectKey);
		upload.setUploadUrl(uploadUrl);
		upload.setExpiresAt(expiresAt);
		repository.save(upload);

		return new PhotoPresignResponse(hash, objectKey, uploadUrl, expiresAt);
	}
}
