package com.plasto.api.event;

import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SyncEventRequest(
	@NotNull UUID eventId,
	@NotBlank @Size(max = 32) @Pattern(regexp = "^[A-Z0-9_]+$", message = "eventType must be uppercase identifier") String eventType,
	@NotBlank @Size(max = 65_536) String payloadJson,
	@Size(max = 256) String customerPubkey,
	@NotBlank @Size(max = 256) String operatorPubkey,
	@Size(max = 4096) String customerSig,
	@NotBlank @Size(max = 4096) String operatorSig,
	@Size(max = 8192) String photoHashes,
	@Size(max = 128) String previousHash,
	@NotBlank @Size(max = 128) @Pattern(regexp = "^[A-Fa-f0-9]{64}$", message = "eventHash must be 64-char hex SHA-256") String eventHash,
	@NotNull @Min(0) @Max(9_999_999_999_999_999L) Long createdAtLocal
) {
}
