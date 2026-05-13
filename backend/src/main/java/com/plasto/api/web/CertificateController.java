package com.plasto.api.web;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.plasto.api.certificate.CertificateService;
import com.plasto.api.certificate.IssueCertificateRequest;
import com.plasto.api.certificate.OperatorCertificate;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/admin/certificates")
public class CertificateController {

	private final CertificateService service;

	public CertificateController(CertificateService service) {
		this.service = service;
	}

	@PostMapping
	public ResponseEntity<Map<String, Object>> issueCertificate(
			@Valid @RequestBody IssueCertificateRequest req) {
		OperatorCertificate cert = service.issueCertificate(
				req.operatorPubkey(),
				req.plantId(),
				req.floatCap(),
				req.adminPubkey(),
				req.adminSig());

		return ResponseEntity.ok(Map.of(
				"certificateId", cert.getCertificateId(),
				"operatorPubkey", cert.getOperatorPubkey(),
				"plantId", cert.getPlantId(),
				"floatCap", cert.getFloatCap(),
				"issuedAt", cert.getIssuedAt().toString(),
				"expiresAt", cert.getExpiresAt() != null ? cert.getExpiresAt().toString() : null));
	}

	@GetMapping("/{operatorPubkey}")
	public ResponseEntity<?> getCertificate(@PathVariable String operatorPubkey) {
		return service.getActiveCertificate(operatorPubkey)
				.map(cert -> ResponseEntity.ok(Map.of(
						"certificateId", cert.getCertificateId(),
						"operatorPubkey", cert.getOperatorPubkey(),
						"plantId", cert.getPlantId(),
						"floatCap", cert.getFloatCap(),
						"expiresAt", cert.getExpiresAt() != null ? cert.getExpiresAt().toString() : null,
						"isActive", cert.isActive())))
				.orElse(ResponseEntity.notFound().build());
	}
}
