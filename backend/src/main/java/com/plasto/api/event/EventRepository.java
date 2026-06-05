package com.plasto.api.event;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EventRepository extends JpaRepository<EventRecord, UUID> {
	Optional<EventRecord> findFirstByOperatorPubkeyOrderByCreatedAtLocalDescReceivedAtDesc(String operatorPubkey);
	boolean existsByPhotoHashesContaining(String photoHash);
}
