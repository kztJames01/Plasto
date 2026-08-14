package com.plasto.api.audit;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MerkleRootRepository extends JpaRepository<MerkleRoot, UUID> {
	Optional<MerkleRoot> findByPlantIdAndDayUtc(String plantId, LocalDate dayUtc);

	Optional<MerkleRoot> findFirstByOrderByCreatedAtDesc();
}
