package com.plasto.api.event;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "events")
public class EventRecord {

	@Id
	@Column(name = "event_id", nullable = false)
	private UUID eventId;

	@Column(nullable = false)
	private String eventType;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String payloadJson;

	@Column(columnDefinition = "TEXT")
	private String customerPubkey;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String operatorPubkey;

	@Column(columnDefinition = "TEXT")
	private String customerSig;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String operatorSig;

	@Column(columnDefinition = "TEXT")
	private String photoHashes;

	@Column(columnDefinition = "TEXT")
	private String previousHash;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String eventHash;

	private Long createdAtLocal;
	private Instant receivedAt;

	public EventRecord() {
		this.receivedAt = Instant.now();
	}

	public UUID getEventId() { return eventId; }
	public void setEventId(UUID eventId) { this.eventId = eventId; }
	public String getEventType() { return eventType; }
	public void setEventType(String eventType) { this.eventType = eventType; }
	public String getPayloadJson() { return payloadJson; }
	public void setPayloadJson(String payloadJson) { this.payloadJson = payloadJson; }
	public String getCustomerPubkey() { return customerPubkey; }
	public void setCustomerPubkey(String customerPubkey) { this.customerPubkey = customerPubkey; }
	public String getOperatorPubkey() { return operatorPubkey; }
	public void setOperatorPubkey(String operatorPubkey) { this.operatorPubkey = operatorPubkey; }
	public String getCustomerSig() { return customerSig; }
	public void setCustomerSig(String customerSig) { this.customerSig = customerSig; }
	public String getOperatorSig() { return operatorSig; }
	public void setOperatorSig(String operatorSig) { this.operatorSig = operatorSig; }
	public String getPhotoHashes() { return photoHashes; }
	public void setPhotoHashes(String photoHashes) { this.photoHashes = photoHashes; }
	public String getPreviousHash() { return previousHash; }
	public void setPreviousHash(String previousHash) { this.previousHash = previousHash; }
	public String getEventHash() { return eventHash; }
	public void setEventHash(String eventHash) { this.eventHash = eventHash; }
	public Long getCreatedAtLocal() { return createdAtLocal; }
	public void setCreatedAtLocal(Long createdAtLocal) { this.createdAtLocal = createdAtLocal; }
	public Instant getReceivedAt() { return receivedAt; }
	public void setReceivedAt(Instant receivedAt) { this.receivedAt = receivedAt; }
}
