# corvo-nfse-java Design

Date: 2026-10-13. References: shared spec, `corvo-nfse-node`, `MillionSend/millionsend-java`.

## Goal

Idiomatic Java SDK (JDK 21+, Java 21 records) for the Corvo NFS-e API. Library only.

## Package

- **Maven Central coordinates**: `com.corvotechnology:corvo-nfse-java`. Jar: `corvo-nfse-java`.
- **Manifest**: `pom.xml` (or `build.gradle.kts` — decision: **Maven**, matches the millionsend-java reference). Group `com.corvotechnology`, artifact `corvo-nfse-java`.
- **Runtime deps**: Jackson (`jackson-databind`, `jackson-datatype-jsr310`).
- **Dev deps**: JUnit 5, AssertJ, `mockwebserver` (okhttp).

## Idiom

- **HTTP**: `java.net.http.HttpClient` (JDK built-in; zero extra HTTP dep). 30s default request timeout. Multipart via `HttpRequest.BodyPublishers` and an in-memory boundary builder.
- **Async**: `CompletableFuture<T>` for resource methods; the public API exposes `thenApply`/`thenCompose`. A `Corvo.sync()` factory provides blocking variants (returns the entity directly, throws on error — not the recommended style but useful for legacy callers).
- **Result**: `public sealed interface Result<T> permits Ok, Err { record Ok<T>(T data) implements Result<T> {} record Err<T>(CorvoApiError error) implements Result<T> {} }` — exhaustive `switch` pattern matching.
- **Construction**: `Corvo.builder().apiKey(...).baseUrl(...).build()`. Throws `IllegalArgumentException` on misconfiguration.

## Layout

```
src/main/java/com/corvotechnology/corvo_nfse/
  Corvo.java
  transport/
    HttpTransport.java
    Result.java
  error/
    CorvoApiError.java
  webhooks/
    CorvoWebhooks.java       # static verifySignature
  resources/
    CompaniesResource.java
    CertificatesResource.java
    InvoicesResource.java
    WebhooksResource.java
    CreditsResource.java
    BillingResource.java
    HealthResource.java
  types/                      # record per resource
src/test/java/com/corvotechnology/corvo_nfse/
  transport/
  webhooks/
  resources/
  contract/
pom.xml
```

## Testing

Three layers. `okhttp3.mockwebserver` records and replays HTTP. HMAC known vector. JUnit 5 + AssertJ. `mvn verify` (compile + test + package) clean.

## Distribution

- Maven Central via `mvn deploy` in CI (Sonatype OSSRH credentials as secrets).
- Multi-module not required — single jar.
- Versioning synchronized.
- README in English. Javadoc on every public type.

## Out of scope

CLI, billing upgrade/downgrade, credits preview, OpenAPI codegen.
