package com.plasto.api.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.plasto.api.price.PriceSchedule;
import com.plasto.api.price.PriceScheduleRepository;
import com.fasterxml.jackson.annotation.JsonProperty;

@RestController
@RequestMapping("/api/v1/prices")
public class PriceController {

	private final PriceScheduleRepository repository;

	public PriceController(PriceScheduleRepository repository) {
		this.repository = repository;
	}

	@GetMapping
	public List<PriceResponse> activePrices() {
		long now = System.currentTimeMillis();
		return repository.findActive(now).stream().map(PriceController::toResponse).toList();
	}

	private static PriceResponse toResponse(PriceSchedule row) {
		return new PriceResponse(
			row.getClassCode(),
			row.getRatePerKg(),
			row.getEffectiveFrom(),
			row.getEffectiveTo()
		);
	}

	public record PriceResponse(
		@JsonProperty("class")
		String clazz,
		Integer ratePerKg,
		Long effectiveFrom,
		Long effectiveTo
	) {}
}
