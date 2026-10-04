package com.plasto.api.floatcap;

import java.time.Instant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface OperatorFloatRepository extends JpaRepository<OperatorFloat, String> {
	@Modifying
	@Query("""
		UPDATE OperatorFloat f
		SET f.consumed = f.consumed + :credits, f.lastSync = :now
		WHERE f.operatorPubkey = :operatorPubkey
		  AND f.plantId = :plantId
		  AND f.consumed + :credits <= f.cap
	""")
	int consumeIfWithinCap(
		@Param("operatorPubkey") String operatorPubkey,
		@Param("plantId") String plantId,
		@Param("credits") long credits,
		@Param("now") Instant now
	);
}
