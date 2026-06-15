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
		// Atomic CAS update: this update only succeeds if the row exists, the
		// plantId matches, and the resulting consumed would not exceed the cap.
		int updated = repository.consumeIfWithinCap(operatorPubkey, plantId, credits, Instant.now());
		if (updated == 1) {
			return;
		}
		// The update failed — figure out why with a follow-up read so we can
		// give the caller a precise error rather than a generic conflict.
		OperatorFloat opFloat = repository.findById(operatorPubkey)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "operator float not initialized"));
		if (!opFloat.getPlantId().equals(plantId)) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "operator float plant mismatch");
		}
		if (opFloat.getCap() <= 0L) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "operator float has no cap assigned");
		}
		// Detect potential overflow before adding to the consumed column.
		if (credits > opFloat.getCap() - opFloat.getConsumed()) {
			throw new ResponseStatusException(HttpStatus.CONFLICT, "operator float exceeded");
		}
		// Plant matches, cap is positive, credits fit. The most likely cause is a
		// concurrent update that changed consumed between our CAS attempt and
		// this read. Surface that as a retryable conflict.
		throw new ResponseStatusException(HttpStatus.CONFLICT, "operator float update raced; retry");
	}
}
