package com.plasto.api.web;

import java.io.IOException;
import java.util.Map;

import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.plasto.api.photo.PhotoStorageService;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/local-photo-upload")
@Profile("!prod")
public class PhotoUploadController {

	private final PhotoStorageService storageService;

	public PhotoUploadController(PhotoStorageService storageService) {
		this.storageService = storageService;
	}

	/**
	 * Dev-only handler for the locally-issued presigned upload URL. Real
	 * production deployments point the URL at GCS/S3/Azure. Accepts PUT
	 * (roadmap) and POST (older clients). HMAC must verify before bytes land.
	 */
	@PutMapping("/**")
	public ResponseEntity<Map<String, Object>> uploadPut(
		HttpServletRequest request,
		@RequestParam("expires") long expires,
		@RequestParam("ct") String contentType,
		@RequestParam("sig") String signature
	) throws IOException {
		return receive(request, expires, contentType, signature);
	}

	@PostMapping("/**")
	public ResponseEntity<Map<String, Object>> uploadPost(
		HttpServletRequest request,
		@RequestParam("expires") long expires,
		@RequestParam("ct") String contentType,
		@RequestParam("sig") String signature
	) throws IOException {
		return receive(request, expires, contentType, signature);
	}

	private ResponseEntity<Map<String, Object>> receive(
		HttpServletRequest request,
		long expires,
		String contentType,
		String signature
	) throws IOException {
		String objectKey = extractObjectKey(request);
		if (objectKey == null || objectKey.isBlank()) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "missing object key");
		}
		if (!storageService.verifySignature(objectKey, contentType, expires, signature)) {
			throw new ResponseStatusException(HttpStatus.FORBIDDEN, "invalid or expired upload URL");
		}
		byte[] body = request.getInputStream().readAllBytes();
		long stored = storageService.storeLocalUpload(objectKey, body);
		return ResponseEntity.ok(Map.of(
			"objectKey", objectKey,
			"received", true,
			"bytes", stored
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
