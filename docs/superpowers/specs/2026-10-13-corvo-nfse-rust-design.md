# corvo-nfse-rust Design

Date: 2026-10-13. References: shared spec, `corvo-nfse-node`, `MillionSend/millionsend-rust`.

## Goal

Idiomatic Rust SDK (1.75+, async) for the Corvo NFS-e API. Library only.

## Package

- **crates.io name**: `corvo-nfse`. Crate: `corvo_nfse`.
- **Manifest**: `Cargo.toml`. Edition 2021.
- **Runtime deps**: `reqwest` (with `rustls-tls` — no OpenSSL), `tokio` (features `rt-multi-thread`, `macros`), `serde` + `serde_json`, `thiserror`, `futures-util`.
- **Dev deps**: `wiremock`, `tokio` (test feature), `pretty_assertions`.

## Idiom

- **HTTP**: `reqwest::Client` with connection pooling, 30s default timeout, async.
- **Async**: `tokio` runtime; the public API is `async fn` everywhere.
- **Result**: `Result<T, CorvoError>` for every call. `CorvoError` is a `#[derive(thiserror::Error)]` enum with variants `Api { status, code, message, details, request_id, retry_after }`, `Network(String)`, `Timeout`, `InvalidUrl`. The `iterate()` method yields items and on the first page failure **returns** the error from the generator's `next()` via a sealed error (documented exception).
- **Construction**: `Corvo::new(api_key, base_url)` or `Corvo::builder().api_key(...).base_url(...).build()`. Returns `Result<Self, CorvoError>` on misconfiguration (no panic).

## Layout

```
src/
  lib.rs             # public exports
  client.rs          # Corvo struct, ClientConfig
  transport.rs       # request, unwrap, toError
  error.rs           # CorvoError + thiserror impl
  webhooks.rs        # CorvoWebhooks::verify_signature (pub fn)
  resources/
    mod.rs
    companies.rs
    certificates.rs
    invoices.rs
    webhooks.rs
    credits.rs
    billing.rs
    health.rs
  types/             # serde structs
tests/
  transport.rs
  webhooks.rs
  resources/
  contract.rs        # #[tokio::test] skipped without env
```

## Testing

Three layers. `wiremock` for HTTP. HMAC known vector. `cargo test`, `cargo clippy --all-targets -- -D warnings`, `cargo doc --no-deps` all clean.

## Distribution

- crates.io via `cargo publish`. Doc hosting on docs.rs.
- Versioning synchronized.
- README in English. Idiomatic rustdoc on every public item.

## Out of scope

CLI, billing upgrade/downgrade, credits preview, OpenAPI codegen.
