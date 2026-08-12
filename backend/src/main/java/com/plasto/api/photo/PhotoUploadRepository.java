package com.plasto.api.photo;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PhotoUploadRepository extends JpaRepository<PhotoUpload, String> {
	Optional<PhotoUpload> findByObjectKey(String objectKey);
}
