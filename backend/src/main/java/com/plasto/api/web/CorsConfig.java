package com.plasto.api.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

	@Value("${plasto.cors.allowed-origins:*}")
	private String allowedOrigins;

	@Override
	public void addCorsMappings(CorsRegistry registry) {
		String[] origins = allowedOrigins.split(",");
		for (int i = 0; i < origins.length; i++) {
			origins[i] = origins[i].trim();
		}
		registry.addMapping("/api/**")
			.allowedOriginPatterns(origins)
			.allowedMethods("GET", "POST", "PUT", "OPTIONS")
			.allowedHeaders("*")
			.exposedHeaders("*");
	}
}
