# corvo-nfse-java Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idiomatic Java SDK for the Corvo NFS-e API — 28 ops + 2 health, sealed `Result<T>`, `CompletableFuture<T>` async.

**Architecture:** Single Maven artifact `com.corvotechnology:corvo-nfse-java`. `Corvo` client composes resource namespaces over `HttpTransport` (built-in `java.net.http.HttpClient`). `sealed interface Result<T>` with `Ok`/`Err` records; pattern matching. `iterate` returns `Stream<T>`; first page failure surfaces as `Err`.

**Tech Stack:** JDK 21, `java.net.http.HttpClient`, Jackson (`jackson-databind`, `jackson-datatype-jsr310`), JUnit 5, AssertJ, `okhttp3.mockwebserver`.

**Spec:** `docs/superpowers/specs/2026-10-13-corvo-nfse-java-design.md`.

## Global Constraints

- JDK `>=21`; Maven coordinates `com.corvotechnology:corvo-nfse-java`; deps `jackson-databind`, `jackson-datatype-jsr310`.
- Auth `X-API-Key`. Base default `https://api.corvo.tech`; env `CORVO_API_KEY`/`CORVO_BASE_URL`; prefix `v1`.
- `Result<T>` sealed interface (`Ok<T>`, `Err<T>`); never throw for API/network/timeout. Only `iterate` throws `CorvoApiError`.
- 28 ops + 2 health. Envelope `{data}`/`{data: {props: X}}`/list/`204` → `null`.
- Types mirror the Node SDK. HMAC known vector (shared).

---

### Task 1: Scaffold
**Files:** `pom.xml`, `src/main/java/com/corvotechnology/corvo_nfse/`, `src/test/java/com/corvotechnology/corvo_nfse/`, `LICENSE`, `README.md`, `.github/workflows/ci.yml`. JDK 21; Jackson; JUnit 5 + AssertJ + `mockwebserver`. `mvn verify`. Commit `chore: scaffold corvo-nfse-java`.

### Task 2: Error
**Files:** `src/main/java/com/corvotechnology/corvo_nfse/error/CorvoApiError.java`, test. `public record CorvoApiError(int status, String code, String message, List<Detail> details, String requestId, Integer retryAfter)`. Test + `mvn test`. Commit `feat: CorvoApiError`.

### Task 3: Transport
**Files:** `transport/HttpTransport.java`, `transport/Result.java`, test. `public <T> CompletableFuture<Result<T>> request(HttpMethod method, String path, Object body, Map<String,String> query, String idempotencyKey, UnwrapMode unwrap)`. `java.net.http.HttpClient`. `mockwebserver` asserts URL/headers/body/envelope/error. `mvn test`. Commit `feat: HttpClient transport`.

### Task 4: Client + health
**Files:** `Corvo.java`, `test/CorvoTest.java`. `Corvo.builder().apiKey(...).baseUrl(...).build()`. Throws `IllegalArgumentException` on misconfig. `health().live()` / `ready()`. Commit `feat: client and health`.

### Task 5: Companies (pattern)
**Files:** `resources/CompaniesResource.java`, test. `CompletableFuture<Result<Paginated<Company>>> listAsync(int limit, String cursor)`; `create`, `get`, `update`, `remove`, `Stream<Company> iterate(...)`. Test. Commit `feat: companies resource`.

### Task 6: Certificates + invoices
**Files:** `resources/CertificatesResource.java`, `InvoicesResource.java`, tests. `uploadAsync(String companyId, byte[] file, String password, String fileName)` (multipart via `HttpRequest.BodyPublishers.ofByteArray` with a boundary builder); `invoices.createAsync(params, idempotencyKey)`, `getAsync`, `listAsync`, `iterate`, `eventsAsync`, `pdfAsync`, `xmlAsync`, `downloadUrlAsync`, `sendEmailAsync`. Commit `feat: certificates and invoices`.

### Task 7: Webhooks + credits + billing
**Files:** `resources/WebhooksResource.java` (nested `DeliveriesResource`), `CreditsResource.java`, `BillingResource.java`, `webhooks/CorvoWebhooks.java`, tests. `CorvoWebhooks.verifySignature(byte[] rawBody, String header, String secret)` (`javax.crypto.Mac` + `MessageDigest.isEqual`). `WEBHOOK_EVENTS` const. Commit `feat: webhooks, credits, billing, signature`.

### Task 8: Exports + README + contract
**Files:** `README.md`, `src/test/java/.../Contract/` (skipped without env). `mvn verify`. Commit `docs: README and exports`.

**Handoff:** create repo `corvo-technology/corvo-nfse-java`, push, deploy to Maven Central.
