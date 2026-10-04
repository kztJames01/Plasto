package com.plasto.api.certificate;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "operator_certificates")
public class OperatorCertificate {

	@Id
	private String certificateId;

	private String operatorPubkey;
	private String plantId;
	private long floatCap;
	private String adminPubkey;
	private String adminSig;
	private Instant issuedAt;
	private Instant expiresAt;
	private boolean isActive;

	public OperatorCertificate() {
		this.certificateId = UUID.randomUUID().toString();
		this.issuedAt = Instant.now();
		this.isActive = true;
	}

	public String getCertificateId() {
		return certificateId;
	}

	public void setCertificateId(String certificateId) {
		this.certificateId = certificateId;
	}

	public String getOperatorPubkey() {
		return operatorPubkey;
	}

	public void setOperatorPubkey(String operatorPubkey) {
		this.operatorPubkey = operatorPubkey;
	}

	public String getPlantId() {
		return plantId;
	}

	public void setPlantId(String plantId) {
		this.plantId = plantId;
	}

	public long getFloatCap() {
		return floatCap;
	}

	public void setFloatCap(long floatCap) {
		this.floatCap = floatCap;
	}

	public String getAdminPubkey() {
		return adminPubkey;
	}

	public void setAdminPubkey(String adminPubkey) {
		this.adminPubkey = adminPubkey;
	}

	public String getAdminSig() {
		return adminSig;
	}

	public void setAdminSig(String adminSig) {
		this.adminSig = adminSig;
	}

	public Instant getIssuedAt() {
		return issuedAt;
	}

	public void setIssuedAt(Instant issuedAt) {
		this.issuedAt = issuedAt;
	}

	public Instant getExpiresAt() {
		return expiresAt;
	}

	public void setExpiresAt(Instant expiresAt) {
		this.expiresAt = expiresAt;
	}

	public boolean isActive() {
		return isActive;
	}

	public void setActive(boolean active) {
		isActive = active;
	}
}
