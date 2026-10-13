# corvo-nfse-ruby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idiomatic Ruby SDK for the Corvo NFS-e API — 28 ops + 2 health, `[data, error]` result-style, stdlib only.

**Architecture:** Single gem `corvo-nfse`. `CorvoNfse::Client` composes resource namespaces over `transport.rb` (net/http + envelope unwrap + error mapping). `[data, error]` — one is `nil`. `CorvoApiError` is a `Data.define`. `iterate` is a block/enumerator; first page failure raises.

**Tech Stack:** Ruby 3.1+, `net/http` (stdlib), `rspec` + `webmock`, `rake`.

**Spec:** `docs/superpowers/specs/2026-10-13-corvo-nfse-ruby-design.md`.

## Global Constraints

- Ruby `>=3.1`; gem `corvo-nfse`; namespace `CorvoNfse`; zero runtime deps.
- Auth `X-API-Key`. Base default `https://api.corvo.tech`; env `CORVO_API_KEY`/`CORVO_BASE_URL`; prefix `v1`.
- Result `[data, error]`; one `nil`. Never raise for API/network/timeout. Only `iterate` raises `CorvoApiError`.
- 28 ops + 2 health. Envelope `{data}`/`{data: {props: X}}`/list/`204` → `nil`.
- Types mirror the Node SDK. HMAC known vector (same body/secret/sig as shared).

---

### Task 1: Scaffold
**Files:** `corvo-nfse.gemspec`, `lib/corvo_nfse.rb`, `spec/spec_helper.rb`, `spec/smoke_spec.rb`, `LICENSE`, `README.md`, `.github/workflows/ci.yml`, `Rakefile`. `VERSION = "0.1.0"`. `rspec` smoke. Commit `chore: scaffold corvo-nfse-ruby`.

### Task 2: Error
**Files:** `lib/corvo_nfse/error.rb`, `spec/error_spec.rb`.
```ruby
module CorvoNfse
  CorvoApiError = Data.define(:status, :code, :message, :details, :request_id, :retry_after)
end
```
Test construct + defaults. Commit `feat: CorvoApiError`.

### Task 3: Transport
**Files:** `lib/corvo_nfse/transport.rb`, `spec/transport_spec.rb`. `request(method, path, json:, query:, idempotency_key:, unwrap:)` → `[data, error]`. `Net::HTTP` + keep-alive. `unwrap` 3 modes. `_to_error` from non-2xx. `webmock` asserts URL/headers/body/envelope/error. Commit `feat: net/http transport`.

### Task 4: Client + health
**Files:** `lib/corvo_nfse/client.rb`, `spec/client_spec.rb`. `Client.new(api_key:, base_url:, prefix:)` wires resources; `ArgumentError` on misconfig. `health.live`/`ready` pass through raw. Commit `feat: client and health`.

### Task 5: Companies (pattern)
**Files:** `lib/corvo_nfse/resources/companies.rb`, `spec/companies_spec.rb`. `list`, `create`, `get`, `update`, `remove`, `iterate` (block). Test URL/headers/body/unwrapped/`iterate` cursor. Commit `feat: companies resource`.

### Task 6: Certificates + invoices
**Files:** `resources/certificates.rb`, `invoices.rb`, specs. `upload` (multipart via `Net::HTTP::Post#set_form`); `create/get/list/iterate/events/pdf/xml/download_url/send_email`. Signatures table with unwrap modes. Commit `feat: certificates and invoices`.

### Task 7: Webhooks + credits + billing
**Files:** `resources/webhooks.rb` (nested `deliveries`), `credits.rb`, `billing.rb`, `webhooks.rb`, specs. `verify_signature` (`OpenSSL::HMAC` + `secure_compare`); `WEBHOOK_EVENTS`. Commit `feat: webhooks, credits, billing, signature`.

### Task 8: Exports + README + contract
**Files:** `README.md`, `spec/contract/` (skipped without env). `rake spec` + `rubocop`. Commit `docs: README and exports`.

**Handoff:** create repo `corvo-technology/corvo-nfse-ruby`, push, `gem push`.
