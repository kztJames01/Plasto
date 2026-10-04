package com.plasto.api.floatcap;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "operator_floats")
public class OperatorFloat {

	@Id
	@Column(columnDefinition = "TEXT")
	private String operatorPubkey;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String plantId;

	@Column(nullable = false)
	private long cap;

	@Column(nullable = false)
	private long consumed;

	@Column(nullable = false)
	private Instant lastSync;

	public OperatorFloat() {
		this.lastSync = Instant.now();
	}

	public String getOperatorPubkey() { return operatorPubkey; }
	public void setOperatorPubkey(String operatorPubkey) { this.operatorPubkey = operatorPubkey; }
	public String getPlantId() { return plantId; }
	public void setPlantId(String plantId) { this.plantId = plantId; }
	public long getCap() { return cap; }
	public void setCap(long cap) { this.cap = cap; }
	public long getConsumed() { return consumed; }
	public void setConsumed(long consumed) { this.consumed = consumed; }
	public Instant getLastSync() { return lastSync; }
	public void setLastSync(Instant lastSync) { this.lastSync = lastSync; }
}
