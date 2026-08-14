package com.plasto.api.audit;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "merkle_roots")
public class MerkleRoot {

	@Id
	private UUID id;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String plantId;

	@Column(nullable = false)
	private LocalDate dayUtc;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String rootHash;

	@Column(nullable = false)
	private int eventCount;

	@Column(nullable = false, columnDefinition = "TEXT")
	private String leafHashes;

	@Column(nullable = false)
	private Instant createdAt;

	private Instant anchoredAt;

	@Column(columnDefinition = "TEXT")
	private String chainTx;

	public MerkleRoot() {
		this.id = UUID.randomUUID();
		this.createdAt = Instant.now();
	}

	public UUID getId() { return id; }
	public void setId(UUID id) { this.id = id; }
	public String getPlantId() { return plantId; }
	public void setPlantId(String plantId) { this.plantId = plantId; }
	public LocalDate getDayUtc() { return dayUtc; }
	public void setDayUtc(LocalDate dayUtc) { this.dayUtc = dayUtc; }
	public String getRootHash() { return rootHash; }
	public void setRootHash(String rootHash) { this.rootHash = rootHash; }
	public int getEventCount() { return eventCount; }
	public void setEventCount(int eventCount) { this.eventCount = eventCount; }
	public String getLeafHashes() { return leafHashes; }
	public void setLeafHashes(String leafHashes) { this.leafHashes = leafHashes; }
	public Instant getCreatedAt() { return createdAt; }
	public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
	public Instant getAnchoredAt() { return anchoredAt; }
	public void setAnchoredAt(Instant anchoredAt) { this.anchoredAt = anchoredAt; }
	public String getChainTx() { return chainTx; }
	public void setChainTx(String chainTx) { this.chainTx = chainTx; }
}
