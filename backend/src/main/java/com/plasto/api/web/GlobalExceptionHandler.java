package com.plasto.api.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiErrorBody> validation(MethodArgumentNotValidException ex) {
		String msg = ex.getBindingResult().getFieldErrors().stream()
				.map(FieldError::getDefaultMessage)
				.findFirst()
				.orElse("validation failed");
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
				.body(new ApiErrorBody("VALIDATION", msg, null));
	}

	@ExceptionHandler(IllegalArgumentException.class)
	public ResponseEntity<ApiErrorBody> badRequest(IllegalArgumentException ex) {
		return ResponseEntity.status(HttpStatus.BAD_REQUEST)
			.body(new ApiErrorBody("BAD_REQUEST", ex.getMessage(), null));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiErrorBody> fallback(Exception ex) {
		log.error("unhandled", ex);
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
			.body(new ApiErrorBody("INTERNAL", "something broke", null));
	}
}
