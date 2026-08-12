package com.plasto.api.web;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.plasto.api.event.EventRepository;
import com.plasto.api.event.SyncEventResponse;

@RestController
@RequestMapping("/api/v1/users")
public class UserEventsController {

	private final EventRepository eventRepository;

	public UserEventsController(EventRepository eventRepository) {
		this.eventRepository = eventRepository;
	}

	@GetMapping("/{pubkey}/events")
	public List<SyncEventResponse> listEvents(
		@PathVariable String pubkey,
		@RequestParam(name = "after", defaultValue = "0") long after
	) {
		return eventRepository
			.findByCustomerPubkeyAndCreatedAtLocalGreaterThanOrderByCreatedAtLocalAsc(pubkey, after)
			.stream()
			.map(SyncEventResponse::from)
			.toList();
	}
}
