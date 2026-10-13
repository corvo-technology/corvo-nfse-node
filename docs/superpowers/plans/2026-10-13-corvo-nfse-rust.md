# corvo-nfse-rust Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idiomatic Rust SDK for the Corvo NFS-e API — 28 ops + 2 health, `Result<T, CorvoError>` (thiserror), async.

**Architecture:** Single crate `corvo-nfse`. `Corvo` struct composes resource namespaces over `transport` (reqwest + tokio + serde). `Result<T, CorvoError>` is the idiomatic Rust error handling — `thiserror` derive. `iterate` is `Stream`-style iterator; first page failure surfaces as `Err`.

**Tech Stack:** Rust 1.75+, `reqwest` (rustls), `tokio`, `serde`, `thiserror`, `wiremock`, `cargo test`.

**Spec:** `docs/superpowers/specs/2026-10-13-corvo-nfse-rust-design.md`.

## Global Constraints

- Rust `>=1.75`; crate `corvo-nfse`, lib name `corvo_nfse`; deps `reqwest`, `tokio`, `serde`, `serde_json`, `thiserror`, `futures-util`.
- Auth `X-API-Key`. Base default `https://api.corvo.tech`; env `CORVO_API_KEY`/`CORVO_BASE_URL`; prefix `v1`.
- `Result<T, CorvoError>` everywhere; never panic for API/network/timeout. `CorvoError` enum: `Api`, `Network`, `Timeout`, `InvalidUrl`.
- 28 ops + 2 health. Envelope `{data}`/`{data: {props: X}}`/list/`204` → `None`.
- Types mirror the Node SDK. HMAC known vector (shared).

---

### Task 1: Scaffold
**Files:** `Cargo.toml`, `src/lib.rs`, `tests/`, `LICENSE`, `README.md`, `.github/workflows/ci.yml`. Deps per the spec. `pub const VERSION: &str = "0.1.0";`. `cargo test`. Commit `chore: scaffold corvo-nfse-rust`.

### Task 2: Error
**Files:** `src/error.rs`, `tests/error.rs`. `#[derive(thiserror::Error, Debug)] pub enum CorvoError { Api { status: u16, code: String, message: String, details: Vec<Detail>, request_id: Option<String>, retry_after: Option<u64> }, Network(String), Timeout, InvalidUrl }`. Test + `cargo test`. Commit `feat: CorvoError`.

### Task 3: Transport
**Files:** `src/transport.rs`, `tests/transport.rs`. `pub async fn request<T>(...) -> Result<T, CorvoError>` using `reqwest::Client`. Unwrap 3 modes; map non-2xx to `CorvoError::Api`; 204 → `Ok(None)`. `wiremock` asserts URL/headers/body/envelope/error. `cargo test`, `cargo clippy`. Commit `feat: reqwest transport`.

### Task 4: Client + health
**Files:** `src/client.rs`, `tests/client.rs`. `Corvo::new(api_key, base_url)` or `Corvo::builder().api_key(...).base_url(...).build()` → `Result<Self, CorvoError>`. `health.live()`/`ready()`. Commit `feat: client and health`.

### Task 5: Companies (pattern)
**Files:** `src/resources/companies.rs`, `tests/companies.rs`. `pub async fn list(&self, limit: Option<u16>, cursor: Option<&str>) -> Result<(Vec<Company>, Pagination), CorvoError>`; `create`, `get`, `update`, `remove`, `iterate` (async iterator). Test with `wiremock`. Commit `feat: companies resource`.

### Task 6: Certificates + invoices
**Files:** `src/resources/certificates.rs`, `invoices.rs`, tests. `upload` (multipart via `reqwest::multipart`); `create` (idempotency), `get`, `list`, `iterate`, `events`, `pdf`, `xml`, `download_url`, `send_email`. Signatures table with unwrap modes. Commit `feat: certificates and invoices`.

### Task 7: Webhooks + credits + billing
**Files:** `src/resources/webhooks.rs` (nested `deliveries`), `credits.rs`, `billing.rs`, `src/webhooks.rs`, tests. `verify_signature` (`hmac` crate or manual); `WEBHOOK_EVENTS` const. Commit `feat: webhooks, credits, billing, signature`.

### Task 8: Exports + README + contract
**Files:** `README.md`, `tests/contract.rs` (skipped without env). `cargo test`, `cargo clippy`, `cargo doc`. Commit `docs: README and exports`.

**Handoff:** create repo `corvo-technology/corvo-nfse-rust`, push, `cargo publish`.
