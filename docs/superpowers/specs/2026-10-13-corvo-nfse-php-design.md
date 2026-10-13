# corvo-nfse-php Design

Date: 2026-10-13. References: shared spec, `corvo-nfse-node`, `MillionSend/millionsend-php`.

## Goal

Idiomatic PHP SDK (8.2+) for the Corvo NFS-e API. Library only.

## Package

- **Packagist name**: `corvo-technology/corvo-nfse`. Namespace: `CorvoNfse\\`.
- **Manifest**: `composer.json`. PSR-4 autoload `CorvoNfse\\` → `src/`.
- **Runtime deps**: `php-http/guzzle7-adapter` + `guzzlehttp/guzzle` (or `symfony/http-client`). Decision: **Guzzle 7** (most familiar to PHP devs).
- **Dev deps**: `phpunit/phpunit`, `php-http/mock-client`, `phpstan/phpstan`.

## Idiom

- **HTTP**: Guzzle 7 handler stack with `http_errors: false`; map non-2xx into the typed error. 30s timeout default.
- **Async**: synchronous; Guzzle's `Promise` interface is exposed as a thin `requestAsync()` but the public resource API is sync.
- **Result**: `CorvoNfse\Result` is a `readonly class` with `public mixed $data, public ?CorvoApiError $error`. Consumers use `match` (PHP 8) or `if ($r->error !== null)`. `CorvoApiError` is a `readonly class` with the shared fields.
- **Construction**: `new CorvoNfse\Client(['api_key' => ..., 'base_url' => ...])`; throws `InvalidArgumentException` on misconfiguration.

## Layout

```
src/
  Client.php
  Transport.php        # unwrap, toError
  Error.php            # CorvoApiError
  Webhooks.php         # CorvoWebhooks::verifySignature
  Result.php
  Resources/
    Companies.php
    Certificates.php
    Invoices.php
    Webhooks.php
    Credits.php
    Billing.php
    Health.php
  Types/               # readonly classes per resource
test/
  TransportTest.php
  WebhooksTest.php
  Resources/
  Contract/
composer.json
phpunit.xml
phpstan.neon
```

## Testing

Three layers. `php-http/mock-client` (or Guzzle's `MockHandler`). HMAC known vector. PHPUnit + `phpstan` (level 9) clean.

## Distribution

- Packagist auto-publish on GitHub release (or GitHub Actions workflow).
- Versioning synchronized.
- README in English.

## Out of scope

CLI, billing upgrade/downgrade, credits preview, OpenAPI codegen.
