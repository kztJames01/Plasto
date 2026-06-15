package com.plasto.api.event;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface EventRepository extends JpaRepository<EventRecord, UUID> {
	/**
	 * Latest event for an operator. Concurrency is enforced by the unique
	 * constraints (operator_pubkey, event_hash) and (operator_pubkey,
	 * previous_hash) defined in V4__event_hash_unique_constraints.sql — two
	 * concurrent batches both reading the same latest hash and inserting
	 * different events will fail at INSERT time with a constraint violation.
	 */
	Optional<EventRecord> findFirstByOperatorPubkeyOrderByCreatedAtLocalDescReceivedAtDesc(String operatorPubkey);

	boolean existsByPhotoHashesContaining(String photoHash);
}
