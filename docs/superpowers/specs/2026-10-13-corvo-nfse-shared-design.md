# corvo-nfse-shared — Cross-cutting SDK design

Date: 2026-10-13
Status: approved in brainstorming (2026-10-13); awaits user review

## Goal

Cross-cutting design for the 8 Corvo NFS-e SDKs (Python, Go, Ruby, PHP, Rust, .NET, Elixir, Java), ensuring contract fidelity, consistent ergonomics, and idiomatic feel per language. The 8 sit beside the existing Node.js SDK and share the same verified API contract and design intent.

## References

- **Canonical implementation**: `corvo-technology/corvo-nfse-node` (Node 18+, zero runtime deps, dual ESM/CJS). Read it first to understand the contract end-to-end.
- **Verified API contract** (sampling of live backend, not the stale `docs/api/*`): `corvo-nodejs/docs/superpowers/specs/2026-10-12-corvo-nfse-node-design.md`.
- **Corvo backend source** (ground truth for envelopes and route gating): `corvo-backend/src/modules/**` and the global `ResponseInterceptor`.
- **Idiom reference per language**: the `MillionSend/millionsend-{lang}` SDK. Mirror its style, naming, and package layout, not the Corvo backend docs.

## Contract (identical across all SDKs)

The 8 SDKs implement exactly the same 28 API-key operations + 2 health checks already verified for the Node SDK. No language ships a subset. No language ships extras.

- **Auth**: `X-API-Key` header (never `Authorization: Bearer`). Format `corvo_test_` / `corvo_live_` + 40 hex.
- **Base URL**: self-hosted first. Each SDK accepts a `baseUrl` option; sensible env fallback (e.g., `CORVO_BASE_URL`); the **public** default is `https://api.corvo.tech` for production.
- **Prefix**: `v1` by default; each SDK exposes a `prefix` option for self-hosted installs with a custom `API_PREFIX`.
- **Response envelopes (uniform via `ResponseInterceptor`)**:
  - Every JSON success: `{ data: ... }`.
  - Lists: `{ data: T[], pagination: { limit, hasMore, nextCursor } }`. Cursor is opaque base64url; `nextCursor` is `null` when `hasMore` is `false`; `limit` is 1–1000, default 50.
  - `props` wrapper: `Invoice`, `InvoiceEvent`, `Plan` (credit plans), and `CreditTransaction` serialize as `{ props: ... }` in the wire format. The SDK unwraps it transparently — consumers see the entity directly.
  - Raw: `/health/live|ready` returns raw JSON without envelope; `/invoices/:id/pdf|xml` returns binary with `Content-Type` and `Content-Disposition: attachment; filename="..."`.
  - `204`: empty body, treated as `null`.
- **Errors (REST)**: `{ statusCode, code, message, details?, requestId }` plus `X-Request-Id` header. `code` is stable (`ERROR_VALIDATION`, `ERROR_COMPANY_NOT_FOUND`, `ERROR_INVOICE_NOT_AVAILABLE`, etc.); falls back to `http_<status>`. `details` is an array of `{ field, code, message }` for body validation. `Retry-After` header and/or `retryAfter` field on 429.
- **Idempotency**: `Idempotency-Key` header on `POST /invoices` and `POST /invoices/:id/email`. Each SDK accepts an `idempotencyKey` option on those methods.
- **Upload**: `multipart/form-data` with fields `file` (Blob, max 50 KiB) and `password` for certificate upload. The SDK builds the form from a `Buffer`/`bytes` and a password — the caller never touches multipart.
- **Webhook signature**: header `X-Corbo-Signature: sha256=<hex>`, HMAC-SHA256 over the raw request body with the secret returned at webhook creation. Each SDK exposes `verifySignature(rawBody, signatureHeader, secret): boolean` using a timing-safe constant-time compare.

## Excluded from all SDKs (verified against backend)

- `POST /billing/upgrade`, `/billing/downgrade`, `/billing/checkout`, `/billing/checkout/:sessionId`, `/billing/portal` — controller lacks `@ApiKeyEndpoint`, so they return 403 with an API key. No SDK should expose them.
- `POST /credits/purchase/preview` — controller throws `GoneException` (410). Dead route.
- All auth/session/MCP routes — also lack `@ApiKeyEndpoint`. No SDK should expose them.
- CLI / bin — only the Node SDK ships a CLI. The 8 new SDKs ship **library only**.

## Resource surface (28 ops + 2 health)

| Resource | Methods |
|---|---|
| `companies` | `create`, `get`, `update`, `remove`, `list`, `iterate` |
| `certificates` | `upload` (multipart), `list`, `remove` |
| `invoices` | `create` (idempotency), `get`, `list`, `iterate`, `events` (cursor-paginated), `pdf`, `xml`, `downloadUrl`, `sendEmail` (idempotency) |
| `webhooks` | `list`, `create` (returns `secret` once), `remove`, `test`, `deliveries.list`, `deliveries.iterate`, `deliveries.stats`, `deliveries.retry` |
| `credits` | `balance`, `plans`, `history`, `iterateHistory` |
| `billing` | `plan`, `usage` |
| `health` | `live`, `ready` (public) |

Every list returns `{ data, pagination }` and has a paired `iterate()` async generator that walks the cursor.

## Result-style idiom ("never throws on API/network")

The Node SDK's `{ data, error }` union maps to each language's idiomatic failure-as-value shape. The rule is identical: **a request to the API, a network failure, or a timeout never raises an exception in the caller.** The only documented exception is the async generator `iterate()`, which raises a typed error on the first page failure (it has no `yield` to put a result in).

| Language | Success shape | Error shape | Throw? |
|---|---|---|---|
| Python | `(data, None)` tuple | `(None, error)` tuple | No |
| Go | `(T, nil)` | `(T{}, *CorvoError)` | No |
| Ruby | `[data, nil]` | `[nil, error]` | No |
| PHP | `new Result($data, null)` | `new Result(null, $error)` | No |
| Rust | `Ok(T)` | `Err(CorvoError)` (thiserror) | No |
| .NET | `new Result<T>(data, null)` | `new Result<T>(null, error)` | No |
| Elixir | `{:ok, data}` | `{:error, %CorvoError{}}` | No |
| Java | `new Ok<>(data)` | `new Err<>(error)` (sealed) | No |

The error type in every language carries at minimum: `status` (HTTP status, 0 for network/timeout), `code` (string, stable; `network_error` / `timeout` for transport failures), `message`, `requestId?`, `details?`, `retryAfter?`. Network/timeout failures set `status=0` and `code` to `network_error` or `timeout`.

The `iterate()` method's exception is the one place a typed error is raised; document it in each language's docs.

## Envelope handling (shared logic)

Every SDK implements a small envelope layer that the resources call. Two operations:

1. `unwrap(value, mode)` where `mode ∈ { "data", "data+props", "none" }`:
   - `data` → `body.data` (or `null` if missing).
   - `data+props` → `body.data.props` (unwraps the domain entity).
   - `none` → the whole body (used for `iterate` lists that return `{data, pagination}` together).
2. `toError(response, parsedBody)` — produces the typed error from a non-2xx response, populating `status` (HTTP), `code` (body.code ?? `http_<status>`), `message` (body.message / body.error / fallback), `requestId` (body.requestId ?? `X-Request-Id` header), `details` (body.details), `retryAfter` (body.retryAfter ?? `Retry-After` header → number).

Both helpers live in a transport module; resources call them. Tests cover the four matrix cells: success data / success data+props / empty 204 / REST error.

## Types

Each language maintains hand-written types that mirror the verified wire format. Fields are typed from the live samples (not the stale backend docs). The Node SDK's `src/types/*.ts` files are the source of truth for which fields exist and their names.

Per-language type mapping:

- **Python**: `@dataclass` for resources; `TypedDict` or `pydantic` for the envelope shapes if convenient. `Invoice` carries the 36 verified fields, `Company` the 24, etc.
- **Go**: `struct` types; no protobuf / OpenAPI codegen.
- **Ruby**: `Data` (immutable) or `Struct`; snake_case wire fields mapped to Ruby snake_case methods.
- **PHP**: `readonly class` (PHP 8.2+) per resource.
- **Rust**: `serde::Deserialize` structs with `#[serde(rename_all = "camelCase")]` (snake_case variants as aliases where the backend mixes).
- **.NET**: `record` types with `JsonPropertyName` for the few snake_case fields in `BillingPlanResponse`.
- **Elixir**: `@type` (typespec) per resource; runtime `defstruct`.
- **Java**: `record` per resource; Jackson `@JsonProperty` for snake_case fields where needed.

The shared rule: **wire format is passed through unchanged**. The SDK never re-cases server fields. Input to the SDK is camelCase (where the language is conventionally camelCase), output is whatever the server returned.

## Testing strategy (three layers, every language)

1. **Unit tests with mocked HTTP** — verify method, path, query, headers (`X-API-Key`, `Idempotency-Key`, multipart omits manual `Content-Type`), request body (camelCase pass-through), envelope unwrap, error mapping (REST 400 with `code`/`details`/`requestId`, 429 `Retry-After`, 410), 204 → `null`, network/timeout mapping, construction validation (missing API key, http on public hosts), pagination cursor propagation, iterate throws on failure.
2. **HMAC signature vector** — every SDK includes the same known vector:
   - body: `{"type":"nfse.invoice.authorized","data":{"id":"inv_1"}}`
   - secret: `whsec_test_123`
   - expected: `sha256=8f9bd040d8f717b19618ab3395ddfa4b8c176b8dc863195227b88dd85426bbbc`
   - Additional assertions: tampered body → `false`; wrong secret → `false`; malformed header → `false`.
3. **Optional contract test** — lives in `test/contract/` (or idiom equivalent). Skips automatically without env; runs `health.live()` + `companies.list({ limit: 1 })` against a real instance when `CORVO_API_KEY` and `CORVO_BASE_URL` are set. Not part of default CI.

## Repo conventions

- Repo name: `corvo-technology/corvo-nfse-{lang}`.
- Branch: `main`; PRs land via feature branches.
- README in English (same tone as the Node SDK): one-line positioning, "Why" bullets, install + quickstart, downloads, webhook verification, CLI mention (point to `corvo-nfse-node`), development commands.
- LICENSE: MIT, copyright `Corvo Technology 2026`.
- CI: GitHub Actions. Each repo sets up the language's toolchain. Optional contract test runs in CI when the secrets are present.
- Package name on the registry: **`corvo-nfse`** (same name across all 8 — convention from millionsend). Import path / module name / namespace differs per language.
- Versioning: **synchronized semver across the 8 SDKs**. A contract-breaking change bumps all 8 to a new major at the same time. Each repo's CHANGELOG has a "Contract changes" section pointing back to this spec.

## Out of scope (all SDKs)

- CLI / bin. The Node SDK remains the only one with a CLI.
- Auth, session, magic-link, OAuth, MCP.
- `billing/upgrade|downgrade|checkout|portal` (403 with API key).
- `credits/purchase/preview` (410 Gone).
- Automatic type generation from OpenAPI. Types are hand-maintained against the verified wire format.
- Webhook server / framework integration. The SDK only ships the signature verifier; consumers wire it into their own HTTP server.

## Reference handoff (how each language SDK is built)

Each per-language spec is a thin layer on top of this one. The per-language spec adds:

1. The exact package manifest and dependency list.
2. The HTTP client choice and connection-pool / timeout configuration.
3. The async model (sync vs async vs mixed) and the signature of resource methods.
4. The exact package layout (source folder, public exports, module hierarchy).
5. The test framework and fixture style, mapped from this spec's three testing layers.
6. The distribution path and release steps.

Each per-language spec is **drafted as a sibling of this file** at `corvo-nodejs/docs/superpowers/specs/2026-10-13-corvo-nfse-{lang}-design.md` and moves to that language's repo's `docs/` when the repo is created.
