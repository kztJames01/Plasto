package com.plasto.api.photo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PhotoUploadRepository extends JpaRepository<PhotoUpload, String> {
}
