package com.plasto.api.certificate;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CertificateService {

	private final OperatorCertificateRepository repository;

	public CertificateService(OperatorCertificateRepository repository) {
		this.repository = repository;
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

		return repository.save(cert);
	}

	public Optional<OperatorCertificate> getActiveCertificate(String operatorPubkey) {
		return repository.findByOperatorPubkeyAndIsActiveTrue(operatorPubkey);
	}

	public boolean validateCertificate(String operatorPubkey) {
		return repository.findByOperatorPubkeyAndIsActiveTrue(operatorPubkey)
			.map(cert -> cert.getExpiresAt() == null || cert.getExpiresAt().isAfter(Instant.now()))
			.orElse(false);
	}
}
