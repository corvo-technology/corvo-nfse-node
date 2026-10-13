# corvo-nfse-php Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idiomatic PHP SDK for the Corvo NFS-e API — 28 ops + 2 health, immutable `Result` class, Guzzle 7.

**Architecture:** Single Composer package `corvo-technology/corvo-nfse`. `CorvoNfse\Client` composes resource namespaces over `Transport` (Guzzle handler stack with `http_errors: false`). `Result` is a `readonly class` with `$data` / `$error`. `iterate` returns a generator; first page failure throws.

**Tech Stack:** PHP 8.2+, `guzzlehttp/guzzle` (runtime), `phpunit` + `php-http/mock-client` + `phpstan`.

**Spec:** `docs/superpowers/specs/2026-10-13-corvo-nfse-php-design.md`.

## Global Constraints

- PHP `>=8.2`; package `corvo-technology/corvo-nfse`; namespace `CorvoNfse\`; PSR-4.
- Auth `X-API-Key`. Base default `https://api.corvo.tech`; env `CORVO_API_KEY`/`CORVO_BASE_URL`; prefix `v1`.
- Result is `new Result($data, null)` or `new Result(null, $error)`. Never throw for API/network/timeout. Only `iterate` throws `CorvoApiError`.
- 28 ops + 2 health. Envelope `{data}`/`{data: {props: X}}`/list/`204` → `null`.
- Types mirror the Node SDK. HMAC known vector (shared).

---

### Task 1: Scaffold
**Files:** `composer.json` (PSR-4 `CorvoNfse\` → `src/`), `src/`, `test/`, `LICENSE`, `README.md`, `.github/workflows/ci.yml`, `phpunit.xml`, `phpstan.neon`. `const VERSION = "0.1.0";` in a `Version` class or `composer.json`. Smoke test loads. Commit `chore: scaffold corvo-nfse-php`.

### Task 2: Error
**Files:** `src/CorvoApiError.php`, `test/CorvoApiErrorTest.php`. `readonly class CorvoApiError { public function __construct(public int $status, public string $code, public string $message, public array $details = [], public ?string $requestId = null, public ?int $retryAfter = null) {} }`. Test + `phpstan --level 9`. Commit `feat: CorvoApiError`.

### Task 3: Transport
**Files:** `src/Transport.php`, `test/TransportTest.php`. `request(string $method, string $path, ?array $json = null, ?array $query = null, ?string $idempotencyKey = null, string $unwrap = "data"): Result`. `Client` from Guzzle with `http_errors => false`. `_unwrap` 3 modes; `_toError` from non-2xx. Test with `MockHandler`. Commit `feat: Guzzle transport`.

### Task 4: Client + health
**Files:** `src/Client.php`, `test/ClientTest.php`. `new Client(['api_key' => ..., 'base_url' => ...])`. Throws `InvalidArgumentException` on misconfig. `health()->live()` / `ready()` pass through raw. Commit `feat: client and health`.

### Task 5: Companies (pattern)
**Files:** `src/Resources/Companies.php`, `test/CompaniesTest.php`. `list(?int $limit = null, ?string $cursor = null): Result`; `create(array $params): Result`; `get(string $id): Result`; `update(string $id, array $params): Result`; `remove(string $id): Result`; `iterate(array $params = []): Generator`. Test URL/headers/body/unwrapped/`iterate` cursor. Commit `feat: companies resource`.

### Task 6: Certificates + invoices
**Files:** `src/Resources/Certificates.php`, `Invoices.php`, tests. `upload(string $companyId, string $file, string $password, ?string $fileName = null): Result` (multipart via Guzzle `Multipart`); `invoices->create($params, ?string $idempotencyKey = null)`, `get`, `list`, `iterate`, `events`, `pdf`, `xml`, `downloadUrl`, `sendEmail`. Signatures table with unwrap modes. Commit `feat: certificates and invoices`.

### Task 7: Webhooks + credits + billing
**Files:** `src/Resources/Webhooks.php`, `Credits.php`, `Billing.php`, `src/Webhooks.php`, tests. `webhooks->list/create/remove/test`, `webhooks->deliveries->list/iterate/stats/retry`; `credits->balance/plans/history/iterateHistory`; `billing->plan/usage`; `CorvoWebhooks::verifySignature($rawBody, $header, $secret): bool` (`hash_equals`). `WEBHOOK_EVENTS` const. Commit `feat: webhooks, credits, billing, signature`.

### Task 8: Exports + README + contract
**Files:** `README.md`, `test/Contract/` (skipped without env). `phpunit`, `phpstan`. Commit `docs: README and exports`.

**Handoff:** create repo `corvo-technology/corvo-nfse-php`, push, publish to Packagist.
