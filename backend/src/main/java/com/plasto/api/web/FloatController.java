package com.plasto.api.web;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.plasto.api.floatcap.OperatorFloat;
import com.plasto.api.floatcap.OperatorFloatRepository;

@RestController
@RequestMapping("/api/v1/operators")
public class FloatController {

	private final OperatorFloatRepository repository;

	public FloatController(OperatorFloatRepository repository) {
		this.repository = repository;
	}

	@GetMapping("/{pubkey}/float")
	public Map<String, Object> getFloat(@PathVariable String pubkey) {
		OperatorFloat opFloat = repository.findById(pubkey)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "operator float not found"));
		long remaining = Math.max(0L, opFloat.getCap() - opFloat.getConsumed());
		return Map.of(
			"operatorPubkey", opFloat.getOperatorPubkey(),
			"plantId", opFloat.getPlantId(),
			"cap", opFloat.getCap(),
			"consumed", opFloat.getConsumed(),
			"remaining", remaining
		);
	}
}
