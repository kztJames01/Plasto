package com.plasto.api.photo;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record PhotoPresignRequest(
	@NotBlank @Pattern(regexp = "^[A-Fa-f0-9]{64}$", message = "hash must be a SHA-256 hex digest") String hash,
	@NotBlank String contentType,
	UUID eventId
) {
}
