# Plasto Bank

Corruption-proof, offline-first waste credit platform for Myanmar’s connectivity gaps and minimal reliance on central authorities.

This repo follows the architecture in [Documents/roadmap.md](Documents/roadmap.md): **React Native** (mobile), **Java / Spring Boot** (API), **Neon Postgres** (cloud DB), with **Azure** as the target hosting surface for API and cold storage (see roadmap Epic 8).

## Layout

| Path | What |
|------|------|
| `mobile/` | React Native app (TypeScript, strict mode). Package id: `com.plasto.bank`. |
| `backend/` | Spring Boot API, Flyway migrations, JDBC to Neon. |

> **Note:** The roadmap mentions Spring Boot 3.2; `start.spring.io` now serves **3.5.x** as the compatible baseline. Behavior matches the roadmap stack (Web MVC, JPA, Validation, Flyway, PostgreSQL).

## Prerequisites

- **Node** ≥ 22 (see `mobile/package.json` engines).
- **JDK 17+** (repo toolchain is 17; use 21 in production if you standardize on it).
- **Neon** project: create a database branch and copy the connection details.

## Neon / Postgres (backend)

Neon requires TLS. Set a JDBC URL (adjust host, db name, user, password):

```bash
export DATABASE_URL='jdbc:postgresql://YOUR_HOST/neondb?sslmode=require'
export DATABASE_USER='YOUR_USER'
export DATABASE_PASSWORD='YOUR_PASSWORD'
```

Copy `backend/.env.example` naming into your shell or deployment secrets. For **Azure Container Apps**, store these as app secrets / Key Vault references.

Run migrations on startup (Flyway) and the API:

```bash
cd backend
./gradlew bootRun
```

- Health: `GET http://localhost:8080/api/v1/health`
- actuator: `GET http://localhost:8080/actuator/health`

Tests use H2 with a `test` profile (no Neon required):

```bash
cd backend
./gradlew test
```

## React Native (mobile)

```bash
cd mobile
npm start
# Android
npx react-native run-android
```

iOS: install CocoaPods in `mobile/ios` (`bundle install` then `bundle exec pod install`) then `npx react-native run-ios`.

## Azure (next steps)

Roadmap direction: **Azure Container Apps** for the Java container, **Azure Blob** as optional mirror for photos, DNS / failover as in Epic 8. CI/CD and Azure resource definitions are not scaffolded yet; add them when you pick subscriptions and regions.

## Sprint 0 (from roadmap)

Foundation order: identity keypair → local SQLite schema → this API + Neon → operator proposal UI with mock signing. Build those before sync, AI, and pricing.
