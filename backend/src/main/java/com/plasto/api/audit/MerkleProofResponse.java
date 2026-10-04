package com.plasto.api.audit;

import java.util.List;
import java.util.UUID;

public record MerkleProofResponse(
	UUID eventId,
	String plantId,
	String dayUtc,
	String rootHash,
	String leafHash,
	int leafIndex,
	List<String> proofPath
) {
}
