package com.plasto.api.photo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

/**
 * Confirmation that a presigned photo upload finished. Requires the
 * completeToken issued at presign time so clients cannot mark arbitrary
 * hashes as uploaded without holding a valid upload URL.
 */
public record PhotoUploadCompleteRequest(
	@NotBlank @Pattern(regexp = "^[A-Fa-f0-9]{64}$", message = "hash must be a SHA-256 hex digest") String hash,
	@NotBlank String completeToken,
	@PositiveOrZero long bytes
) {
}
