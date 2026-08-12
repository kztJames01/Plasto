package com.plasto.api.web;

import java.util.Locale;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.plasto.api.photo.PhotoPresignRequest;
import com.plasto.api.photo.PhotoPresignResponse;
import com.plasto.api.photo.PhotoStorageService;
import com.plasto.api.photo.PhotoUpload;
import com.plasto.api.photo.PhotoUploadCompleteRequest;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/photos")
public class PhotoController {

	private final PhotoStorageService service;

	public PhotoController(PhotoStorageService service) {
		this.service = service;
	}

	@PostMapping("/presigned")
	public ResponseEntity<PhotoPresignResponse> presigned(@Valid @RequestBody PhotoPresignRequest request) {
		return ResponseEntity.ok(service.createPresignedUpload(request));
	}

	/**
	 * Client calls this after PUTing bytes to the presigned URL. Requires the
	 * completeToken from presign and verifies bytes landed on disk.
	 */
	@PostMapping("/complete")
	public ResponseEntity<Map<String, Object>> complete(@Valid @RequestBody PhotoUploadCompleteRequest req) {
		PhotoUpload upload = service.completeUpload(
			req.hash().toLowerCase(Locale.ROOT),
			req.completeToken(),
			req.bytes()
		);
		return ResponseEntity.ok(Map.of(
			"hash", upload.getPhotoHash(),
			"uploaded", true,
			"bytes", upload.getReceivedBytes(),
			"objectKey", upload.getObjectKey()
		));
	}
}
