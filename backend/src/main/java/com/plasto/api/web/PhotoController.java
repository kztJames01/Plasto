package com.plasto.api.web;

import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.plasto.api.photo.PhotoPresignRequest;
import com.plasto.api.photo.PhotoPresignResponse;
import com.plasto.api.photo.PhotoStorageService;
import com.plasto.api.photo.PhotoUpload;
import com.plasto.api.photo.PhotoUploadCompleteRequest;
import com.plasto.api.photo.PhotoUploadRepository;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/photos")
public class PhotoController {

	private final PhotoStorageService service;
	private final PhotoUploadRepository repository;

	public PhotoController(PhotoStorageService service, PhotoUploadRepository repository) {
		this.service = service;
		this.repository = repository;
	}

	@PostMapping("/presigned")
	public ResponseEntity<PhotoPresignResponse> presigned(@Valid @RequestBody PhotoPresignRequest request) {
		return ResponseEntity.ok(service.createPresignedUpload(request));
	}

	/**
	 * Client calls this after PUTing bytes to the presigned URL. The server
	 * flips the upload record to uploaded=true so downstream readers (e.g. the
	 * sync flow) can rely on the photo existing at the object key.
	 */
	@PostMapping("/complete")
	public ResponseEntity<Map<String, Object>> complete(@Valid @RequestBody PhotoUploadCompleteRequest req) {
		String hash = req.hash().toLowerCase(Locale.ROOT);
		PhotoUpload upload = repository.findById(hash)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "presigned upload not found"));
		upload.setUploaded(true);
		repository.save(upload);
		return ResponseEntity.ok(Map.of(
			"hash", upload.getPhotoHash(),
			"uploaded", true,
			"bytes", req.bytes()
		));
	}
}
