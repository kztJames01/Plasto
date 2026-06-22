package com.plasto.api.price;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "price_schedule")
public class PriceSchedule {

	@Id
	@Column(name = "class", nullable = false)
	private String classCode;

	@Column(name = "rate_per_kg", nullable = false)
	private Integer ratePerKg;

	@Column(name = "effective_from", nullable = false)
	private Long effectiveFrom;

	@Column(name = "effective_to")
	private Long effectiveTo;

	public String getClassCode() {
		return classCode;
	}

	public Integer getRatePerKg() {
		return ratePerKg;
	}

	public Long getEffectiveFrom() {
		return effectiveFrom;
	}

	public Long getEffectiveTo() {
		return effectiveTo;
	}
}
