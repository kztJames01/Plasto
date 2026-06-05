package com.plasto.api.certificate;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.plasto.api.floatcap.FloatService;
//issue certificate for operator
@Service
public class CertificateService {

	private final OperatorCertificateRepository repository;
	private final FloatService floatService;

	public CertificateService(OperatorCertificateRepository repository, FloatService floatService) {
		this.repository = repository;
		this.floatService = floatService;
	}

	@Transactional
	public OperatorCertificate issueCertificate(
		String operatorPubkey,
		String plantId,
		long floatCap,
		String adminPubkey,
		String adminSig
	) {
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
