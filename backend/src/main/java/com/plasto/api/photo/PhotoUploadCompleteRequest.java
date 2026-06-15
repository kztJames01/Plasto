package com.plasto.api.photo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Confirmation that a presigned photo upload finished. The client POSTs this
 * after the bytes have been PUT to {@link PhotoPresignResponse#uploadUrl()}.
 */
public record PhotoUploadCompleteRequest(
	@NotBlank @Pattern(regexp = "^[A-Fa-f0-9]{64}$", message = "hash must be a SHA-256 hex digest") String hash,
	long bytes
) {
}
