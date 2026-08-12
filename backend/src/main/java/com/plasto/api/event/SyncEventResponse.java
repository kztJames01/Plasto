package com.plasto.api.event;

import java.util.UUID;

public record SyncEventResponse(
	UUID eventId,
	String eventType,
	String payloadJson,
	String customerPubkey,
	String operatorPubkey,
	String customerSig,
	String operatorSig,
	String photoHashes,
	String previousHash,
	String eventHash,
	Long createdAtLocal
) {
	public static SyncEventResponse from(EventRecord record) {
		return new SyncEventResponse(
			record.getEventId(),
			record.getEventType(),
			record.getPayloadJson(),
			record.getCustomerPubkey(),
			record.getOperatorPubkey(),
			record.getCustomerSig(),
			record.getOperatorSig(),
			record.getPhotoHashes(),
			record.getPreviousHash(),
			record.getEventHash(),
			record.getCreatedAtLocal()
		);
	}
}
