package com.plasto.api.sync;

import org.springframework.stereotype.Component;

import com.plasto.api.certificate.CertificateService;

@Component
public class SyncValidator {

	private final CertificateService certificateService;

	public SyncValidator(CertificateService certificateService) {
		this.certificateService = certificateService;
	}

	public void assertOperatorAllowedToSync(String operatorPubkey) {
		boolean ok = certificateService.validateCertificate(operatorPubkey);
		if (!ok) {
			throw new IllegalArgumentException("Invalid or missing operator certificate");
		}
	}
}
