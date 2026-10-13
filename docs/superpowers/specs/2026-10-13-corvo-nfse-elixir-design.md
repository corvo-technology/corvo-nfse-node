# corvo-nfse-elixir Design

Date: 2026-10-13. References: shared spec, `corvo-nfse-node`, `MillionSend/millionsend-elixir`.

## Goal

Idiomatic Elixir SDK (1.16+) for the Corvo NFS-e API. Library only.

## Package

- **Hex name**: `corvo_nfse`. Module: `CorvoNfse`.
- **Manifest**: `mix.exs`. Standard `lib/`, `test/` layout.
- **Runtime deps**: `finch` (HTTP), `jason` (JSON), `mint` (transitively).
- **Dev deps**: `ex_unit` (stdlib), `mox` (HTTP mock), `credo`, `dialyxir`, `ex_doc`.

## Idiom

- **HTTP**: `Finch` instance built once per `CorvoNfse.Client`; 30s receive timeout; pool configuration tunable.
- **Async**: BEAM processes + `Task.async` for fire-and-forget where useful; the public API is `{:ok, result} | {:error, error}` returning from awaited calls. `Stream` for `iterate`.
- **Result**: `{:ok, data} | {:error, %CorvoNfse.Error{}}`. `CorvoNfse.Error` is a `defstruct` with `status`, `code`, `message`, `details`, `request_id`, `retry_after`. No exceptions for API/network failures; `iterate` raises on the first page failure (documented).
- **Construction**: `%CorvoNfse.Client{api_key: ..., base_url: ...}` or `CorvoNfse.new(api_key: ..., base_url: ...)`. Raises `ArgumentError` on misconfiguration.

## Layout

```
lib/
  corvo_nfse.ex
  corvo_nfse/
    client.ex
    transport.ex           # Finch pool, request, unwrap, to_error
    error.ex
    webhooks.ex            # CorvoWebhooks.verify_signature/2
    resources/
      companies.ex
      certificates.ex
      invoices.ex
      webhooks.ex
      credits.ex
      billing.ex
      health.ex
    types/                 # @type t + defstruct
test/
  corvo_nfse/
    transport_test.exs
    webhooks_test.exs
    resources/
    contract/              # ExUnit, skipped without env
mix.exs
```

## Testing

Three layers. `mox` mocks the Finch pool. HMAC known vector. `mix test`, `mix credo --strict`, `mix dialyzer` clean.

## Distribution

- Hex via `mix hex.publish`. Docs on hexdocs.pm.
- Versioning synchronized.
- README in English. `@doc` and typespec on every public function.

## Out of scope

CLI, billing upgrade/downgrade, credits preview, OpenAPI codegen.
