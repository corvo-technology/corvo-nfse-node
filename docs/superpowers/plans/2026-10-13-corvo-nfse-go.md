# corvo-nfse-go Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idiomatic Go SDK for the Corvo NFS-e API — 28 ops + 2 health, `(T, *CorvoError)` result-style, stdlib only.

**Architecture:** Single Go module. `corvonfse.Client` composes 7 resource structs over one `transport.go` (net/http + envelope unwrap + error mapping). `(T, *CorvoError)` — `err != nil` on failure; never panics. `iterate` returns items via callback or channel; first page failure surfaces as `*CorvoError`.

**Tech Stack:** Go 1.22+, `net/http` (stdlib), `testing` + `httptest` + `testify`, `golangci-lint`.

**Spec:** `docs/superpowers/specs/2026-10-13-corvo-nfse-go-design.md` (references the shared spec).

## Global Constraints

- Go `>=1.22`; module `github.com/corvo-technology/corvo-nfse-go`; import alias `corvonfse`; zero runtime deps.
- Auth via `X-API-Key`. Base URL default `https://api.corvo.tech`; env `CORVO_API_KEY`/`CORVO_BASE_URL`; `prefix` default `v1`.
- Result `(T, *CorvoError)`; never panic for API/network/timeout. `CorvoError` carries `Status`, `Code`, `Message`, `Details`, `RequestID`, `RetryAfter`.
- 28 ops + 2 health, per the shared spec. No extras.
- Envelope: `{data}` → data; `{data: {props: X}}` → X; list → `(data: []X, pagination)`; `204` → `nil`.
- Types mirror the Node SDK's `src/types/*.ts`.
- HMAC known vector: body `{"type":"nfse.invoice.authorized","data":{"id":"inv_1"}}`, secret `whsec_test_123`, sig `sha256=8f9bd040d8f717b19618ab3395ddfa4b8c176b8dc863195227b88dd85426bbbc`.

---

### Task 1: Scaffold

**Files:** `go.mod`, `client.go`, `error.go`, `transport.go`, `webhooks.go`, `resources/`, `types/`, `test/`, `LICENSE`, `README.md`, `.github/workflows/ci.yml`.

**Steps:** `go mod init github.com/corvo-technology/corvo-nfse-go`. `go 1.22`. Layout per the design spec. `client.go` exports `Client`, `NewClient(Options)`. `error.go` defines `CorvoError` struct + `Error() string`. Run `go build ./... && go vet ./...`. Commit `chore: scaffold corvo-nfse-go`.

### Task 2: Error type

**Files:** `error.go`, `test/error_test.go`.

```go
type CorvoError struct {
    Status    int    `json:"statusCode"`
    Code      string `json:"code"`
    Message   string `json:"message"`
    Details   []Detail `json:"details,omitempty"`
    RequestID string `json:"requestId"`
    RetryAfter int   `json:"retryAfter,omitempty"`
}
type Detail struct { Field, Code, Message string }
func (e *CorvoError) Error() string { return e.Code + ": " + e.Message }
```

Test: construct, assert `Error()`, JSON tags parse from a fixture body. Commit `feat: CorvoError type`.

### Task 3: Transport

**Files:** `transport.go`, `test/transport_test.go`. `request(ctx, method, path, body, query, idempotencyKey, unwrap) (any, *CorvoError)`. Build URL `{base}/{prefix}{path}`, set `X-API-Key`/`Idempotency-Key`, POST JSON, map non-2xx to `*CorvoError` (code fallback `http_<status>`, requestId from body or header), `204` → `nil`. Test with `httptest.NewServer`. Commit `feat: net/http transport with envelope and error mapping`.

### Task 4: Client + validation

**Files:** `client.go`, `test/client_test.go`. `NewClient` wires `http.Client`, resources; panics on missing key / public http base. `Health.Live(ctx)`/`Ready(ctx)` return `(any, *CorvoError)`. Commit `feat: client with env fallbacks and health`.

### Task 5: Companies (pattern)

**Files:** `resources/companies.go`, `test/companies_test.go`.

```go
type Companies struct{ t *Transport }
func (c *Companies) List(ctx context.Context, q *ListParams) ([]Company, Pagination, *CorvoError)
func (c *Companies) Create(ctx context.Context, p CompanyCreateParams) (Company, *CorvoError)
func (c *Companies) Get(ctx context.Context, id string) (Company, *CorvoError)
func (c *Companies) Update(ctx context.Context, id string, p CompanyUpdateParams) (Company, *CorvoError)
func (c *Companies) Remove(ctx context.Context, id string) *CorvoError
```

Test: `httptest` records request; assert URL/headers/body/unwrapped result/pagination. `go vet`. Commit `feat: companies resource`.

### Task 6: Certificates + invoices

**Files:** `resources/certificates.go`, `invoices.go`, tests. `certificates.Upload(ctx, companyID, file []byte, password, fileName)` builds multipart. `invoices`: `Create` (idempotency), `Get`, `List`, `Iterate`, `Events`, `PDF`, `XML`, `DownloadURL`, `SendEmail`. Signatures table (unwrap in parens): `Create(data+props)`, `Get(data+props)`, `List(none)`, `Events(none)`, `PDF(raw)`, `XML(raw)`, `DownloadURL(data)`, `SendEmail(data)`. Commit `feat: certificates and invoices resources`.

### Task 7: Webhooks + deliveries + credits + billing

**Files:** `resources/webhooks.go` (nested `Deliveries`), `credits.go`, `billing.go`, `webhooks.go`, tests. `webhooks.List/Create/Remove/Test`; `deliveries.List/Iterate/Stats/Retry`; `credits.Balance/Plans/History/IterateHistory`; `billing.Plan/Usage`; `CorvoWebhooks.VerifySignature(rawBody, header, secret) bool` (`crypto/hmac` + `crypto/subtle`). `WEBHOOK_EVENTS` const (9). Commit `feat: webhooks, credits, billing and signature verification`.

### Task 8: Public exports + README + contract test

**Files:** `README.md`, `test/contract/contract_test.go` (skipped without env). `go vet ./...`, `go test ./...`, `golangci-lint`. Commit `docs: README and public exports`.

**Handoff:** create repo `corvo-technology/corvo-nfse-go`, push.
