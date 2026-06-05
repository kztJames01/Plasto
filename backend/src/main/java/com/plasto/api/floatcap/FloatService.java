package com.plasto.api.floatcap;

import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class FloatService {

	private final OperatorFloatRepository repository;

	public FloatService(OperatorFloatRepository repository) {
		this.repository = repository;
	}

	public void resetFloatLimit(String operatorPubkey, String plantId, long cap) {
		OperatorFloat opFloat = repository.findById(operatorPubkey).orElseGet(OperatorFloat::new);
		opFloat.setOperatorPubkey(operatorPubkey);
		opFloat.setPlantId(plantId);
		opFloat.setCap(cap);
		opFloat.setConsumed(0);
		opFloat.setLastSync(Instant.now());
		repository.save(opFloat);
	}

	public void consume(String operatorPubkey, String plantId, long credits) {
		if (credits <= 0) {
			return;
		}
		int updated = repository.consumeIfWithinCap(operatorPubkey, plantId, credits, Instant.now());
		if (updated == 1) {
			return;
		}
		OperatorFloat opFloat = repository.findById(operatorPubkey)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "operator float not initialized"));
		if (!opFloat.getPlantId().equals(plantId)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "operator float plant mismatch");
		}
		throw new ResponseStatusException(HttpStatus.CONFLICT, "operator float exceeded");
	}
}
