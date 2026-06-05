package com.plasto.api.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.plasto.api.photo.PhotoPresignRequest;
import com.plasto.api.photo.PhotoPresignResponse;
import com.plasto.api.photo.PhotoStorageService;

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
}
