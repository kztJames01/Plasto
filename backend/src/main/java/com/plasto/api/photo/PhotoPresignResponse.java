package com.plasto.api.photo;

import java.time.Instant;

public record PhotoPresignResponse(
	String hash,
	String objectKey,
	String uploadUrl,
	Instant expiresAt,
	String completeToken
) {
}
