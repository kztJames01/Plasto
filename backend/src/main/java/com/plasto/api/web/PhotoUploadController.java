package com.plasto.api.web;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.plasto.api.photo.PhotoStorageService;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/local-photo-upload")
public class PhotoUploadController {

	private final PhotoStorageService storageService;

	public PhotoUploadController(PhotoStorageService storageService) {
		this.storageService = storageService;
	}

	/**
	 * Dev-only handler for the locally-issued presigned upload URL. Real
	 * production deployments point the presigned URL at S3/GCS/Azure Blob and
	 * this controller is not registered. We verify the HMAC before accepting
	 * any bytes so an attacker cannot upload to arbitrary object keys.
	 */
	@PostMapping("/**")
	public ResponseEntity<Map<String, Object>> upload(
		HttpServletRequest request,
		@RequestParam("expires") long expires,
		@RequestParam("ct") String contentType,
		@RequestParam("sig") String signature
	) {
		String objectKey = extractObjectKey(request);
		if (objectKey == null || objectKey.isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "missing object key");
		}
		if (!storageService.verifySignature(objectKey, contentType, expires, signature)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "invalid or expired upload URL");
		}
		// In production: stream the request body to the object store. We just
		// accept the upload metadata here so the rest of the flow is testable.
		return ResponseEntity.ok(Map.of(
			"objectKey", objectKey,
			"received", true
		));
	}

	private static String extractObjectKey(HttpServletRequest request) {
		String path = request.getRequestURI();
		String prefix = "/local-photo-upload/";
		if (!path.startsWith(prefix)) {
			return null;
		}
		return path.substring(prefix.length());
	}
}
