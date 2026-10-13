# corvo-nfse-elixir Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idiomatic Elixir SDK for the Corvo NFS-e API — 28 ops + 2 health, `{:ok, data} | {:error, %Error{}}` result-style.

**Architecture:** Single Hex package `corvo_nfse`. `CorvoNfse.Client` struct with `Finch` pool. Resource modules call `CorvoNfse.Transport.request`. Result is `{:ok, data}` / `{:error, %CorvoNfse.Error{}}`. `iterate` returns a `Stream`; first page failure returns `{:error, ...}`.

**Tech Stack:** Elixir 1.16+, `finch`, `jason`, `ex_unit`, `mox`, `credo`, `dialyxir`.

**Spec:** `docs/superpowers/specs/2026-10-13-corvo-nfse-elixir-design.md`.

## Global Constraints

- Elixir `>=1.16`; package `corvo_nfse`; deps `finch`, `jason`.
- Auth `X-API-Key`. Base default `https://api.corvo.tech`; env `CORVO_API_KEY`/`CORVO_BASE_URL`; prefix `v1`.
- `{:ok, data}` / `{:error, %CorvoNfse.Error{}}`; never raise for API/network/timeout. Only `iterate` raises `CorvoApiError` (the `Stream` aborts with `{:error, ...}`).
- 28 ops + 2 health. Envelope `{data}`/`{data: {props: X}}`/list/`204` → `nil`.
- Types mirror the Node SDK. HMAC known vector (shared).

---

### Task 1: Scaffold
**Files:** `mix.exs`, `lib/corvo_nfse.ex`, `lib/corvo_nfse/`, `test/`, `LICENSE`, `README.md`, `.github/workflows/ci.yml`. Deps `finch`, `jason`; dev `credo`, `dialyxir`, `ex_doc`. `@version "0.1.0"`. `mix test`. Commit `chore: scaffold corvo-nfse-elixir`.

### Task 2: Error
**Files:** `lib/corvo_nfse/error.ex`, `test/corvo_nfse/error_test.exs`. `defstruct [:status, :code, :message, :details, :request_id, :retry_after]`. Test + `mix test`. Commit `feat: CorvoNfse.Error`.

### Task 3: Transport
**Files:** `lib/corvo_nfse/transport.ex`, `test/corvo_nfse/transport_test.exs`. `request(client, method, path, json: ..., query: ..., idempotency_key: ..., unwrap: :data)` → `{:ok, data}` / `{:error, %Error{}}`. `Finch` pool. `mox` asserts URL/headers/body/envelope/error. `mix test`, `mix credo`. Commit `feat: Finch transport`.

### Task 4: Client + health
**Files:** `lib/corvo_nfse/client.ex`, `test/corvo_nfse/client_test.exs`. `CorvoNfse.new(api_key: ..., base_url: ...)` or `%CorvoNfse.Client{}`. Raises `ArgumentError` on misconfig. `health.live(client)` / `ready`. Commit `feat: client and health`.

### Task 5: Companies (pattern)
**Files:** `lib/corvo_nfse/resources/companies.ex`, `test/corvo_nfse/companies_test.exs`. `list(client, limit: nil, cursor: nil)` → `{:ok, %{data: [...], pagination: %{...}}}`; `create`, `get`, `update`, `remove`, `iterate`. Test. Commit `feat: companies resource`.

### Task 6: Certificates + invoices
**Files:** `resources/certificates.ex`, `invoices.ex`, tests. `upload(client, company_id, {:file, path}, password)` (multipart via `Finch`); `create` (idempotency), `get`, `list`, `iterate`, `events`, `pdf`, `xml`, `download_url`, `send_email`. Signatures table with unwrap modes. Commit `feat: certificates and invoices`.

### Task 7: Webhooks + credits + billing
**Files:** `resources/webhooks.ex` (nested `deliveries`), `credits.ex`, `billing.ex`, `lib/corvo_nfse/webhooks.ex`, tests. `CorvoWebhooks.verify_signature(raw_body, header, secret)` (`:crypto.mac(:hmac, :sha256, secret, body)` + `:crypto.hash_equals`). `WEBHOOK_EVENTS` const. Commit `feat: webhooks, credits, billing, signature`.

### Task 8: Exports + README + contract
**Files:** `README.md`, `test/corvo_nfse/contract/` (skipped without env). `mix test`, `mix credo`, `mix dialyzer`. Commit `docs: README and exports`.

**Handoff:** create repo `corvo-technology/corvo-nfse-elixir`, push, `mix hex.publish`.
