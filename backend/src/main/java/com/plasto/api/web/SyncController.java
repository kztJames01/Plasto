package com.plasto.api.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.plasto.api.event.EventSyncService;
import com.plasto.api.event.SyncBatchRequest;
import com.plasto.api.event.SyncBatchResponse;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/sync")
public class SyncController {

	private final EventSyncService service;

	public SyncController(EventSyncService service) {
		this.service = service;
	}

	@PostMapping("/batch")
	public ResponseEntity<SyncBatchResponse> syncBatch(@Valid @RequestBody SyncBatchRequest request) {
		return ResponseEntity.ok(service.sync(request));
	}
}
