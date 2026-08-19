package com.plasto.api.config;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;

@Component
@Profile("prod")
public class ProductionSecurityValidator {

	private static final String DEFAULT_SIGNING_KEY = "dev-only-signing-key-replace-in-prod-32b";

	@Value("${plasto.photos.signing-key:}")
	private String signingKey;

	@Value("${plasto.photos.upload-base-url:}")
	private String uploadBaseUrl;

	@EventListener(ApplicationReadyEvent.class)
	public void validate() {
		if (signingKey == null || signingKey.isBlank()) {
			throw new IllegalStateException("PHOTO_SIGNING_KEY is required in prod");
		}
		if (DEFAULT_SIGNING_KEY.equals(signingKey)) {
			throw new IllegalStateException("Refusing to start: PHOTO_SIGNING_KEY is still the dev default");
		}
		if (signingKey.length() < 32) {
			throw new IllegalStateException("PHOTO_SIGNING_KEY must be at least 32 characters");
		}
		if (uploadBaseUrl == null || uploadBaseUrl.isBlank()) {
			throw new IllegalStateException("PHOTO_UPLOAD_BASE_URL is required in prod");
		}
		if (uploadBaseUrl.contains("local-photo-upload")) {
			throw new IllegalStateException("PHOTO_UPLOAD_BASE_URL must not point at the dev upload handler");
		}
	}
}
