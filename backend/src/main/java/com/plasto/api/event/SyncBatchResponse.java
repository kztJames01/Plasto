package com.plasto.api.event;

import java.util.List;

public record SyncBatchResponse(
	List<String> acknowledgedEventIds,
	List<String> duplicateEventIds,
	long acceptedCount,
	long duplicateCount
) {
}
