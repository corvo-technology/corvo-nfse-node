# corvo-nfse-ruby Design

Date: 2026-10-13. References: shared spec, `corvo-nfse-node`, `MillionSend/millionsend-ruby`.

## Goal

Idiomatic Ruby SDK (3.1+) for the Corvo NFS-e API. Library only.

## Package

- **RubyGems name**: `corvo-nfse`. Namespace: `CorvoNfse`.
- **Manifest**: `corvo-nfse.gemspec`. Standard RubyGems layout (`lib/`, `test/`).
- **Runtime deps**: zero (stdlib `net/http`, `uri`, `json`, `openssl`, `base64`).
- **Dev deps**: `rspec`, `webmock`, `rake`.

## Idiom

- **HTTP**: `Net::HTTP` with keep-alive, 30s default timeout, `OpenSSL::HMAC` for signature verification.
- **Async**: synchronous by default (matches the existing ecosystem). A `CorvoNfse::Async` wrapper over `concurrent-ruby` or `async` is optional (YAGNI for now).
- **Result**: `[data, error]` two-element array. One is always `nil`. `CorvoApiError` is a `Data.define` with `status`, `code`, `message`, `details`, `request_id`, `retry_after`.
- **Construction**: `CorvoNfse::Client.new(api_key: ..., base_url: ...)`; raises `ArgumentError` on misconfiguration.

## Layout

```
lib/corvo_nfse/
  client.rb
  transport.rb        # unwrap, to_error
  error.rb            # CorvoApiError
  webhooks.rb         # CorvoWebhooks.verify_signature
  resources/
    companies.rb
    certificates.rb
    invoices.rb
    webhooks.rb
    credits.rb
    billing.rb
    health.rb
  types/              # Data.define per resource
test/
  spec/
  contract/
```

## Testing

Three layers. `webmock` blocks HTTP. HMAC known vector. `rspec` and `rake spec` clean. Rubocop optional.

## Distribution

- Published to RubyGems. `gem install corvo-nfse`.
- Versioning synchronized.
- README in English.

## Out of scope

CLI, billing upgrade/downgrade, credits preview, OpenAPI codegen.
