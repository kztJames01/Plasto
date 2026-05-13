package com.plasto.api.certificate;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface OperatorCertificateRepository extends JpaRepository<OperatorCertificate, String> {
	Optional<OperatorCertificate> findByOperatorPubkeyAndIsActiveTrue(String operatorPubkey);
}
