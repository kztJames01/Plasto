package com.plasto.api.certificate;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.plasto.api.crypto.SignatureVerifier;
import com.plasto.api.floatcap.FloatService;
//issue certificate for operator
@Service
public class CertificateService {

	private final OperatorCertificateRepository repository;
	private final FloatService floatService;
	private final SignatureVerifier signatureVerifier;

	public CertificateService(
		OperatorCertificateRepository repository,
		FloatService floatService,
		SignatureVerifier signatureVerifier
	) {
		this.repository = repository;
		this.floatService = floatService;
		this.signatureVerifier = signatureVerifier;
	}

	@Transactional
	public OperatorCertificate issueCertificate(
		String operatorPubkey,
		String plantId,
		long floatCap,
		String adminPubkey,
		String adminSig
	) {
		verifyAdminSignature(operatorPubkey, plantId, floatCap, adminPubkey, adminSig);

		// Deactivate any existing certificate for this operator
		repository.findByOperatorPubkeyAndIsActiveTrue(operatorPubkey)
			.ifPresent(existing -> {
				existing.setActive(false);
				repository.save(existing);
			});

		OperatorCertificate cert = new OperatorCertificate();
		cert.setOperatorPubkey(operatorPubkey);
		cert.setPlantId(plantId);
		cert.setFloatCap(floatCap);
		cert.setAdminPubkey(adminPubkey);
		cert.setAdminSig(adminSig);
		cert.setExpiresAt(Instant.now().plus(90, ChronoUnit.DAYS));

		OperatorCertificate saved = repository.save(cert);
		floatService.resetFloatLimit(operatorPubkey, plantId, floatCap);
		return saved;
	}

	private void verifyAdminSignature(
		String operatorPubkey,
		String plantId,
		long floatCap,
		String adminPubkey,
		String adminSig
	) {
		// Canonical, deterministic payload — must match the admin client's exact format.
		String payload = String.join("|",
			"PLASTO_ISSUE_CERT",
			safe(operatorPubkey),
			safe(plantId),
			String.valueOf(floatCap),
			safe(adminPubkey)
		);
		if (!signatureVerifier.verify(adminPubkey, adminSig, payload)) {
			throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "invalid admin signature");
		}
	}

	private static String safe(String value) {
		return value == null ? "" : value;
	}

	public Optional<OperatorCertificate> getActiveCertificate(String operatorPubkey) {
		return repository.findByOperatorPubkeyAndIsActiveTrue(operatorPubkey);
	}

	public boolean validateCertificate(String operatorPubkey) {
		return getActiveCertificate(operatorPubkey)
			.map(this::isValid)
			.orElse(false);
	}

	public OperatorCertificate requireValidCertificate(String operatorPubkey) {
		return getActiveCertificate(operatorPubkey)
			.filter(this::isValid)
			.orElseThrow(() -> new IllegalArgumentException("Invalid or missing operator certificate"));
	}

	private boolean isValid(OperatorCertificate cert) {
		return cert.getExpiresAt() == null || cert.getExpiresAt().isAfter(Instant.now());
	}
}
