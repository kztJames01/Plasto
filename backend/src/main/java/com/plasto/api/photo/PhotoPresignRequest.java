package com.plasto.api.photo;

import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PhotoPresignRequest(
	@NotBlank @Pattern(regexp = "^[A-Fa-f0-9]{64}$", message = "hash must be a SHA-256 hex digest") String hash,
	@NotBlank @Size(max = 64) @Pattern(regexp = "^image/(jpeg|png|webp|heic)$", message = "contentType must be an image MIME type") String contentType,
	UUID eventId
) {
}
