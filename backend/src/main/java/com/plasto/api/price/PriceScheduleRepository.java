package com.plasto.api.price;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PriceScheduleRepository extends JpaRepository<PriceSchedule, String> {

	@Query("""
		select p from PriceSchedule p
		where p.effectiveFrom <= ?1
		and (p.effectiveTo is null or p.effectiveTo > ?1)
		order by p.classCode asc
	""")
	List<PriceSchedule> findActive(long now);
}
