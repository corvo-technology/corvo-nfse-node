# corvo-nfse-go Design

Date: 2026-10-13. References: shared spec, `corvo-nfse-node`, `MillionSend/millionsend-go`.

## Goal

Idiomatic Go SDK (1.22+) for the Corvo NFS-e API. Library only.

## Package

- **Module path**: `github.com/corvo-technology/corvo-nfse-go`. Import: `corvonfse`.
- **Manifest**: `go.mod` (Go modules, no dep manager).
- **Runtime deps**: zero (stdlib only — `net/http`, `encoding/json`, `crypto/hmac`, `crypto/sha256`, `crypto/subtle`).
- **Dev deps**: `github.com/stretchr/testify` (assertions only; not a runtime dep).

## Idiom

- **HTTP**: `net/http` client with custom `http.Transport` for connection pooling; 30s `context.Context` timeout.
- **Async**: blocking I/O + `context.Context`. No goroutines leaked by the SDK.
- **Result**: returns `(T, *CorvoError)` for resources that yield an entity; `(T, error)` is allowed when an error is impossible (e.g., iterator setup). Idiomatic Go: callers `if err != nil`. `CorvoError` is a struct with `Status`, `Code`, `Message`, `Details`, `RequestID`, `RetryAfter`.
- **Construction**: `corvonfse.NewClient(corvonfse.Options{...})`; panics on misconfiguration (missing key, public http).

## Layout

```
client.go        # Client struct, NewClient
transport.go     # request, unwrap, toError
error.go         # CorvoError
webhooks.go      # VerifySignature(rawBody, signatureHeader, secret)
resources/
  companies.go
  certificates.go
  invoices.go
  webhooks.go
  credits.go
  billing.go
  health.go
types/            # struct types per resource
test/
  transport_test.go
  webhooks_test.go
  resources/
  contract/
```

## Testing

Three layers. `httptest.NewServer` (or `httptest.NewRecorder` for unit) mocks the API. HMAC known vector. `go test ./...` and `go vet ./...` must be clean. `golangci-lint` (optional, in CI).

## Distribution

- Module published by tag + push to GitHub. `go get github.com/corvo-technology/corvo-nfse-go@vX.Y.Z`.
- Versioning synchronized with the 7 other SDKs.
- README in English: install, quickstart, downloads, webhook verification, link to `corvo-nfse-node` CLI.

## Out of scope

CLI, billing upgrade/downgrade, credits preview, OpenAPI codegen.
