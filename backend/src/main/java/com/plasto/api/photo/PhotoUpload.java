package com.plasto.api.photo;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "photo_uploads")
public class PhotoUpload {

	@Id
	@Column(columnDefinition = "TEXT")
	private String photoHash;

	private UUID eventId;
	@Column(nullable = false)
	private String contentType;
	@Column(nullable = false, columnDefinition = "TEXT")
	private String objectKey;
	@Column(nullable = false, columnDefinition = "TEXT")
	private String uploadUrl;
	@Column(nullable = false)
	private Instant expiresAt;
	@Column(nullable = false)
	private boolean uploaded;

	public String getPhotoHash() { return photoHash; }
	public void setPhotoHash(String photoHash) { this.photoHash = photoHash; }
	public UUID getEventId() { return eventId; }
	public void setEventId(UUID eventId) { this.eventId = eventId; }
	public String getContentType() { return contentType; }
	public void setContentType(String contentType) { this.contentType = contentType; }
	public String getObjectKey() { return objectKey; }
	public void setObjectKey(String objectKey) { this.objectKey = objectKey; }
	public String getUploadUrl() { return uploadUrl; }
	public void setUploadUrl(String uploadUrl) { this.uploadUrl = uploadUrl; }
	public Instant getExpiresAt() { return expiresAt; }
	public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
	public boolean isUploaded() { return uploaded; }
	public void setUploaded(boolean uploaded) { this.uploaded = uploaded; }
}
