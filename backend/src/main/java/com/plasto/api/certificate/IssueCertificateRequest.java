package com.plasto.api.certificate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

public record IssueCertificateRequest(
	@NotBlank String operatorPubkey,
	@NotBlank String plantId,
	@Positive long floatCap,
	@NotBlank String adminPubkey,
	@NotBlank String adminSig
) {
}
