package com.plasto.api.certificate;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record IssueCertificateRequest(
	@NotBlank @Size(max = 256) String operatorPubkey,
	@NotBlank @Size(max = 64) @Pattern(regexp = "^[A-Za-z0-9_-]+$", message = "plantId must be alphanumeric") String plantId,
	@Positive @Max(1_000_000_000_000L) long floatCap,
	@NotBlank @Size(max = 256) String adminPubkey,
	@NotBlank @Size(max = 4096) String adminSig
) {
}
