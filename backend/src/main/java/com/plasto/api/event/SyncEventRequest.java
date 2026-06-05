package com.plasto.api.event;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SyncEventRequest(
	@NotNull UUID eventId,
	@NotBlank String eventType,
	@NotBlank String payloadJson,
	String customerPubkey,
	@NotBlank String operatorPubkey,
	String customerSig,
	@NotBlank String operatorSig,
	String photoHashes,
	String previousHash,
	@NotBlank String eventHash,
	@NotNull Long createdAtLocal
) {
}
