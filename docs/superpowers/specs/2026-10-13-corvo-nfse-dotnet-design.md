# corvo-nfse-dotnet Design

Date: 2026-10-13. References: shared spec, `corvo-nfse-node`, `MillionSend/millionsend-dotnet`.

## Goal

Idiomatic .NET SDK (.NET 8, C# 12) for the Corvo NFS-e API. Library only.

## Package

- **NuGet name**: `CorvoNfse`. Assembly: `CorvoNfse`.
- **Manifest**: `CorvoNfse.csproj` (single project, multi-targeting `net8.0`).
- **Runtime deps**: zero (built-in `HttpClient`, `System.Text.Json`).
- **Dev deps**: `xunit`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `VerifyXunit` (snapshot tests).

## Idiom

- **HTTP**: `HttpClient` injected via `IHttpClientFactory` or constructed internally; 30s default `Timeout` via `HttpClient.Timeout`.
- **Async**: `Task<T>` everywhere. The public API is `async Task<Result<T, CorvoApiError>>`.
- **Result**: `public sealed record Result<T>(T? Data, CorvoApiError? Error)` with helper methods `IsSuccess`, `IsError`, and a `Match` visitor. `CorvoApiError` is a `sealed record` with the shared fields. Nullability annotations everywhere (`#nullable enable`).
- **Construction**: `new CorvoClient(new CorvoOptions { ApiKey = "...", BaseUrl = "..." })`; throws `ArgumentException` on misconfiguration.

## Layout

```
src/
  CorvoClient.cs
  Transport/
    HttpTransport.cs        # request, unwrap, toError
    Result.cs               # Result<T> record
  Errors/
    CorvoApiError.cs
  Webhooks/
    CorvoWebhooks.cs        # static VerifySignature
  Resources/
    CompaniesResource.cs
    CertificatesResource.cs
    InvoicesResource.cs
    WebhooksResource.cs
    CreditsResource.cs
    BillingResource.cs
    HealthResource.cs
  Types/                     # record per resource
tests/
  Corvo.Tests/
    TransportTests.cs
    WebhookTests.cs
    Resources/
    Contract/
CorvoNfse.sln
```

## Testing

Three layers. `HttpMessageHandler` subclass stubs HTTP (no `HttpClient` mocking library needed). HMAC known vector. `dotnet test`, `dotnet format --verify-no-changes`, build with `TreatWarningsAsErrors`.

## Distribution

- NuGet via `dotnet pack` + `dotnet nuget push` in CI. Multi-target `net8.0`.
- Versioning synchronized.
- README in English. XML doc on every public member.

## Out of scope

CLI, billing upgrade/downgrade, credits preview, OpenAPI codegen.
