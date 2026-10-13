# corvo-nfse-dotnet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idiomatic .NET SDK for the Corvo NFS-e API — 28 ops + 2 health, `Result<T>` record, `Task<T>` async.

**Architecture:** Single project `CorvoNfse` (.NET 8, C# 12). `CorvoClient` composes resource namespaces over `HttpTransport` (built-in `HttpClient`). `Result<T>` sealed record with `Data`/`Error`. `iterate` yields items; first page failure surfaces as `Error`.

**Tech Stack:** .NET 8, C# 12, `HttpClient`, `System.Text.Json`, `xunit`, `VerifyXunit`.

**Spec:** `docs/superpowers/specs/2026-10-13-corvo-nfse-dotnet-design.md`.

## Global Constraints

- .NET `>=8.0`; NuGet `CorvoNfse`; assembly `CorvoNfse`; zero runtime deps.
- Auth `X-API-Key`. Base default `https://api.corvo.tech`; env `CORVO_API_KEY`/`CORVO_BASE_URL`; prefix `v1`.
- `Result<T>(T? Data, CorvoApiError? Error)`; never throw for API/network/timeout. Only `iterate` throws `CorvoApiError`.
- 28 ops + 2 health. Envelope `{data}`/`{data: {props: X}}`/list/`204` → `null`.
- Types mirror the Node SDK. HMAC known vector (shared).

---

### Task 1: Scaffold
**Files:** `CorvoNfse.sln`, `src/CorvoNfse/CorvoNfse.csproj`, `tests/CorvoNfse.Tests/CorvoNfse.Tests.csproj`, `LICENSE`, `README.md`, `.github/workflows/ci.yml`. Target `net8.0`; deps `xunit`, `VerifyXunit`. `dotnet build`. Commit `chore: scaffold corvo-nfse-dotnet`.

### Task 2: Error
**Files:** `src/CorvoNfse/Errors/CorvoApiError.cs`, `tests/CorvoNfse.Tests/CorvoApiErrorTests.cs`. `public sealed record CorvoApiError(int Status, string Code, string Message, IReadOnlyList<Detail>? Details = null, string? RequestId = null, int? RetryAfter = null);`. Test + `dotnet test`. Commit `feat: CorvoApiError`.

### Task 3: Transport
**Files:** `src/CorvoNfse/Transport/HttpTransport.cs`, `Transport/Result.cs`, `tests/TransportTests.cs`. `public async Task<Result<T>> RequestAsync<T>(HttpMethod method, string path, object? body = null, Dictionary<string,string>? query = null, string? idempotencyKey = null, UnwrapMode unwrap = UnwrapMode.Data, CancellationToken ct = default)`. `HttpMessageHandler` subclass stubs. `Result<T>(T? Data, CorvoApiError? Error)`. Commit `feat: HttpClient transport`.

### Task 4: Client + health
**Files:** `src/CorvoNfse/CorvoClient.cs`, `tests/ClientTests.cs`. `new CorvoClient(new CorvoOptions { ApiKey = "...", BaseUrl = "..." })`. Throws `ArgumentException` on misconfig. `Health.LiveAsync()` / `ReadyAsync()`. Commit `feat: client and health`.

### Task 5: Companies (pattern)
**Files:** `src/CorvoNfse/Resources/CompaniesResource.cs`, `tests/CompaniesTests.cs`. `Task<Result<Paginated<Company>>> ListAsync(int? limit = null, string? cursor = null)`; `CreateAsync`, `GetAsync`, `UpdateAsync`, `RemoveAsync`, `IAsyncEnumerable<Company> IterateAsync(...)`. Test. Commit `feat: companies resource`.

### Task 6: Certificates + invoices
**Files:** `Resources/CertificatesResource.cs`, `InvoicesResource.cs`, tests. `UploadAsync(string companyId, byte[] file, string password, string? fileName = null)` (multipart via `MultipartFormDataContent`); `invoices.CreateAsync(params, string? idempotencyKey = null)`, `GetAsync`, `ListAsync`, `IterateAsync`, `EventsAsync`, `PdfAsync`, `XmlAsync`, `DownloadUrlAsync`, `SendEmailAsync`. Commit `feat: certificates and invoices`.

### Task 7: Webhooks + credits + billing
**Files:** `Resources/WebhooksResource.cs` (nested `DeliveriesResource`), `CreditsResource.cs`, `BillingResource.cs`, `Webhooks/CorvoWebhooks.cs`, tests. `CorvoWebhooks.VerifySignature(byte[] rawBody, string? header, string secret)` (`HMACSHA256` + `CryptographicOperations.FixedTimeEquals`). `WEBHOOK_EVENTS` const. Commit `feat: webhooks, credits, billing, signature`.

### Task 8: Exports + README + contract
**Files:** `README.md`, `tests/CorvoNfse.Tests/Contract/` (skipped without env). `dotnet test`, `dotnet format --verify-no-changes`. Commit `docs: README and exports`.

**Handoff:** create repo `corvo-technology/corvo-nfse-dotnet`, push, `dotnet nuget push`.
