package com.plasto.api.event;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

	long countByCustomerPubkey(String customerPubkey);

	List<EventRecord> findByCustomerPubkeyAndCreatedAtLocalGreaterThanOrderByCreatedAtLocalAsc(
		String customerPubkey,
		long after
	);

	@Query("""
		SELECT e FROM EventRecord e
		WHERE e.customerPubkey = :pubkey
		AND (e.createdAtLocal > :afterTs OR (e.createdAtLocal = :afterTs AND e.eventId > :afterEventId))
		ORDER BY e.createdAtLocal ASC, e.eventId ASC
		""")
	List<EventRecord> findCustomerEventsAfterCursor(
		@Param("pubkey") String pubkey,
		@Param("afterTs") long afterTs,
		@Param("afterEventId") UUID afterEventId
	);

	List<EventRecord> findByCreatedAtLocalGreaterThanEqualAndCreatedAtLocalLessThanOrderByEventHashAsc(
		long startInclusive,
		long endExclusive
	);

	List<EventRecord> findByCustomerPubkey(String customerPubkey);
}
