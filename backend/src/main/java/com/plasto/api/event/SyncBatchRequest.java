package com.plasto.api.event;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

public record SyncBatchRequest(
	@NotEmpty @Size(max = 50) List<@Valid SyncEventRequest> events
) {
}
