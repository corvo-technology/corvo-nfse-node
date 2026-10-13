# Spec — corvo-nfse-node

Data: 2026-10-12
Status: aprovado; contrato verificado empiricamente contra o backend local (`localhost:3000`, chave do smoke) e contra o código-fonte do corvo-backend

## Objetivo

Lib Node.js + CLI para a API Corvo (NFS-e self-hosted), modelada após
[millionsend-node](https://github.com/MillionSend/millionsend-node). Cobre todas as
operações com `X-API-Key`, verificadas uma a uma no backend (decorator
`@ApiKeyEndpoint` = a superfície real disponível por API key).

Pacote npm: `corvo-nfse-node`. Diretório: `/Users/pedrohenrique/Documents/corvo-nodejs`.
Node 18+ (`fetch`/`FormData`/`Blob`/`crypto` globais). TypeScript, build dual ESM+CJS
via tsup, testes com Vitest, lint com Biome, gerência com **yarn**.

## Contrato da API (VERIFICADO no backend em 2026-10-12)

- Prefixo `/v1` (cliente envia `{baseUrl}/v1{path}`; opção `prefix`, default `v1`).
- Auth: header `X-API-Key` (`corvo_test_`/`corvo_live_` + 40 hex). `Bearer` não vale.
  Rota sem `@ApiKeyEndpoint` + header presente → 403. Não enviar `tenantId`.
- **Envelope uniforme** (global `ResponseInterceptor`): todo JSON de sucesso tem
  `{ data: ... }`. Exceções raw: `GET /health/live|ready`, downloads PDF/XML (binário).
- **Todas as listagens** (companies, certificates, invoices, events, webhooks,
  deliveries, credits/history, credits/plans) retornam
  `{ data: T[], pagination: { limit, hasMore, nextCursor } }` — cursor opaco
  (base64url), `nextCursor: null` quando `hasMore: false`, `limit` 1–1000 default 50.
  Params: `limit` + `cursor`; invoices adicionam `companyId, status, from, to,
  externalId`; deliveries adicionam `hours, environment`; credits/plans sem filtros.
- **Wrapper `props`**: entidades de domínio serializam `{ props: {...} }` —
  Invoice (single e itens de lista), InvoiceEvent (itens), Plan (itens),
  CreditTransaction (itens). Company, Certificate, Webhook, WebhookDelivery e
  objetos de serviço são planos.
- Erros: `{ statusCode, code, message, details?, requestId }` + header
  `X-Request-Id`. `code` estável (`ERROR_VALIDATION`, `ERROR_BAD_REQUEST`,
  `ERROR_COMPANY_NOT_FOUND`...). 429/410 podem trazer `Retry-After`.
  Headers expostos: `X-RateLimit-Limit/Remaining/Reset`, `Retry-After`, `X-Request-Id`.
- Idempotência: header `Idempotency-Key` em `POST /invoices` e `POST /invoices/:id/email`.
- Upload de certificado: `multipart/form-data` com campos `file` (blob, máx 50 KiB)
  e `password`.

### Superfície API-key real (28 operações + health)

| Grupo | Rotas |
|---|---|
| companies (5) | `POST/GET /companies`, `GET/PATCH/DELETE /companies/:id` |
| certificates (3) | `GET/POST /companies/:companyId/certificates`, `DELETE .../:certId` (204) |
| invoices (8) | `POST /invoices` (202), `GET /invoices`, `GET /invoices/:id`, `GET .../events`, `GET .../pdf`, `GET .../xml`, `POST .../download-url`, `POST .../email` (202) |
| webhooks (7) | `GET/POST /webhooks`, `DELETE /webhooks/:id`, `POST /webhooks/:id/test`, `GET /webhooks/deliveries`, `GET .../stats`, `POST .../deliveries/:id/retry` |
| credits (3) | `GET /credits`, `GET /credits/plans`, `GET /credits/history` |
| billing (2) | `GET /billing/plan`, `GET /billing/usage` |
| health (2, público) | `GET /health/live`, `GET /health/ready` |

**Excluído por verificação no código** (docs desatualizados):
- `POST /billing/upgrade|downgrade|checkout|portal` — sem `@ApiKeyEndpoint` → 403 com API key.
- `POST /credits/purchase/preview` — controller lança 410 Gone (rota morta).
- Rotas de auth (`/auth/*`, members, api-keys) — sem `@ApiKeyEndpoint` → 403.

### Formatos de resposta por recurso (amostrados ao vivo)

- `GET /companies` → `{data: Company[], pagination}`; single → `{data: Company}`.
  Company (24 campos): `id, tenantId, legalName, tradeName, taxId, municipalReg,
  municipalityCode, taxRegime, simpleNational, specialRegime, addressStreet,
  addressNumber, addressComplement, addressDistrict, addressCity, addressState,
  addressZip, fiscalSchemaVersion, environment, status, createdAt, updatedAt,
  deletedAt, setupGaps: string[]`.
- Certificados → `{data: Certificate[], pagination}`; item (10 campos): `id, companyId,
  serialNumber, issuer, subject, fingerprint, validFrom, validUntil, status, createdAt`.
- `GET /invoices` → `{data: [{props: Invoice}], pagination}`; single/create →
  `{data: {props: Invoice}}`. Invoice props (36 campos): `id, companyId, tenantId,
  environment, documentKeyVersion, emailSnapshot, externalId, idempotencyKey, status,
  customerSnapshot, serviceSnapshot, taxSnapshot, amount, currency, competenceDate,
  dpsId, dpsSeries, dpsNumber, accessKey, nfseNumber, fiscalProvider,
  fiscalSchemaVersion, issuedAt, authorizedAt, lastErrorCode, lastErrorMessage,
  lastErrorProvider, documentsReadyAt, lastEmailStatus, lastEmailSentAt, createdAt,
  updatedAt, documentsStatus, emailStatus, stage`.
- Events → `{data: [{props: InvoiceEvent}], pagination}`; props: `id, invoiceId,
  fromStatus, toStatus, reason, createdAt`.
- PDF/XML → binário cru com `Content-Type` e `Content-Disposition: attachment;
  filename="nfse-<n>.<ext>"`.
- `POST .../download-url` → `{data: {downloadUrl, expiresAt, fileName, mimeType}}`.
- `POST .../email` → `{data: {emailId, status}}`.
- `GET /webhooks` → `{data: Webhook[], pagination}`; Webhook: `id, url, events,
  active, createdAt, updatedAt`; `POST /webhooks` → `{data: Webhook & {secret}}`;
  remove/test → `{data: {deleted|sent: true}}`; retry → `{data: {retried: true}}`.
- `GET /webhooks/deliveries` → `{data: WebhookDelivery[], pagination}`; item (16):
  `id, tenantId, webhookConfigId, eventType, environment, url, payload, statusCode,
  responseBody, errorMessage, status, durationMs, retryCount, nextRetryAt, lastError,
  createdAt`. Stats → `{data: {total, sent, failed, pending, delayed}}`.
- `GET /credits` → `{data: {tenantId, balance, overageUnits, overageAmountCents, hardLimit}}`.
- `GET /credits/plans` → `{data: [{props: CreditPlan}], pagination}`; props: `id, slug,
  name, description, dailyLimit, maxActiveCompanies, creditUnitPriceCents,
  throughputRps, includesWebhooks, includesXmlDownload, includesPdfDownload,
  includesApiKeys, supportTier, active, createdAt, updatedAt`.
- `GET /credits/history` → `{data: [{props: CreditTransaction}], pagination}`.
- `GET /billing/plan` → `{data: {plan: {slug, name, monthly_allowance, daily_limit,
  max_active_companies, monthly_price_cents}, subscription: {status, paid_until,
  cancel_at_period_end, scheduled_plan, blocked}, usage: {overage_units,
  overage_amount_cents, hard_limit, credits_used, credits_reserved, credits_remaining,
  monthly_allowance, daily_usage, daily_limit, active_companies,
  max_active_companies, period_start, period_end}}}` (snake_case preservado).
- `GET /billing/usage` → `{data: QuotaStatus}` camelCase: `canEmit, creditsRemaining,
  creditsUsed, creditsReserved, monthlyAllowance, dailyUsage, dailyLimit,
  activeCompanies, maxActiveCompanies, periodStart, periodEnd`.
- `GET /health/live|ready` → raw `{status, timestamp, uptime}` (sem envelope).
- `DELETE /companies/:id` → `{data: null}`; `DELETE .../certificates/:id` → 204 sem corpo.

## Cliente

```ts
const corvo = new Corvo({
  apiKey: 'corvo_live_...',        // fallback env CORVO_API_KEY; throw se ausente
  baseUrl: 'https://api.corvo.tech', // default; fallback env CORVO_BASE_URL
  prefix: 'v1',                    // default; cobre instalações com API_PREFIX alterado
  timeoutMs: 30_000,
  fetch: customFetch,
  allowInsecureHttp: false,        // http:// só para loopback/rede privada, senão throw na construção
});
```

- Erros de **configuração** lançam na construção (apiKey ausente, Node <18 sem fetch,
  `http://` para host público sem `allowInsecureHttp`).
- Erros de **requisição** (API, rede, timeout) nunca lançam — vêm em `{error}`.

## Resultado

```ts
const { data, error } = await corvo.invoices.create(params);
if (error) {
  error.code;       // 'ERROR_VALIDATION' etc. do corpo | 'network_error' | 'timeout' | 'invalid_json' | 'http_<status>'
  error.status;     // HTTP ou 0 (rede/timeout)
  error.message; error.details?; error.requestId?; error.retryAfter?;
}
```

`CorvoApiError extends Error` (nome estável, stack útil). `throw error` para quem
prefere estilo imperativo.

**Exceção documentada**: geradores `iterate()` lançam `CorvoApiError` em falha
(um `yield` não pode devolver `Result`); os métodos `list/get/create/...` nunca lançam.

## Normalização de envelopes (na lib)

| API | Lib |
|---|---|
| `{data: X}` | `X` (`unwrap: 'data'`, default) |
| `{data: {props: X}}` | `X` (`unwrap: 'data+props'`) |
| `{data: [...], pagination}` | `{ data: T[], pagination }` (`Paginated<T>`, itens mapeados) |
| `{data: null}` / `204` | `null` |
| raw (health, PDF/XML) | objeto cru / `DownloadedFile` |

Respostas são repassadas **sem reescrita de case** (snake_case e camelCase convivem
no JSON real). camelCase vale para entrada/opções da lib.

Paginação auxiliar: `list(params)` devolve a primeira página; `iterate(params)` é
`AsyncGenerator` que varre todas as páginas repassando `cursor`.

## Resources

### companies
- `create(params)` → `POST /companies` → `Company`. Entrada: `legalName, taxId,
  taxRegime, tradeName?, municipalReg?, municipalityCode?, simpleNational?,
  specialRegime?, address? {street, number?, complement?, district, city, state, zip}`.
- `list(params?)` / `iterate(params?)` → `Paginated<Company>` / `AsyncGenerator<Company>`
- `get(id)`, `update(id, params)` (aceita `municipalReg: null`, `address: null`),
  `remove(id)` → `null`

### certificates
- `upload(companyId, { file: Buffer|Uint8Array, fileName?, password })` → FormData
  (`file` blob + `password`; default `certificate.p12`) → `Certificate`
- `list(companyId)` → `Paginated<Certificate>`; `remove(companyId, certId)` → `null` (204)

### invoices
- `create(params, { idempotencyKey? })` → `Invoice` (202, status `queued`). Entrada:
  `companyId` XOR `companyTaxId`, `externalId?`, `customer {name, taxId, email?,
  address? {street, city, state, zip, country?}}`, `service {code, municipalityCode?,
  description?}`, `amount`, `competenceDate`, `email?`, `options? {email? {send?}}`,
  `correlationId?`.
- `list(params?)`/`iterate(params?)` → `Paginated<Invoice>`; filtros `companyId,
  status, from, to, externalId, limit, cursor`.
- `get(id)` → `Invoice`; `events(id)` → `Paginated<InvoiceEvent>` (cursor-paginado).
- `pdf(id)`/`xml(id)` → `DownloadedFile` `{ buffer, mimeType?, fileName? }`.
- `downloadUrl(id, 'pdf'|'xml')` → `{downloadUrl, expiresAt, fileName, mimeType}`.
- `sendEmail(id, { idempotencyKey? })` → `{emailId, status}` (202).

### webhooks
- `list(params?)` → `Paginated<Webhook>`; `create({url, events, description?})` →
  `Webhook & { secret }` (secret só aqui); `remove(id)` → `{deleted: true}`;
  `test(id)` → `{sent: true}`.
- `deliveries.list(params?)`/`iterate` → `Paginated<WebhookDelivery>` (`hours,
  environment, limit, cursor`); `deliveries.stats(params?)` →
  `{total, sent, failed, pending, delayed}`; `deliveries.retry(id)` → `{retried: true}`.
- `WEBHOOK_EVENTS`: 8 eventos públicos (`nfse.invoice.authorized|rejected|failed|
  reconciliation_required|manual_review|documents_ready|email_sent|email_failed`) +
  `webhook.test`.

### Webhooks — receptor
`CorvoWebhooks.verifySignature(rawBody: string|Buffer, signatureHeader: string|null|undefined, secret: string): boolean`
— HMAC-SHA256 timing-safe, formato `sha256=<hex>`, header `X-Corvo-Signature`,
bytes brutos do corpo. (Vetor conhecido no teste.)

### credits
- `balance()` → `{tenantId, balance, overageUnits, overageAmountCents, hardLimit}`
- `plans()` → `Paginated<CreditPlan>`; `history(params?)` → `Paginated<CreditTransaction>`.

### billing
- `plan()` → `BillingPlanResponse` (snake_case real preservado)
- `usage()` → `QuotaStatus` (camelCase real)

### health
- `live()` / `ready()` → objeto cru (`{status, timestamp, uptime}`), sem auth.

## Tipos exportados

`Company`, `Certificate`, `Invoice`, `InvoiceEvent`, `Webhook`, `WebhookDelivery`,
`CreditBalance`, `CreditPlan`, `CreditTransaction`, `BillingPlanResponse`,
`QuotaStatus`, `Paginated<T>`, `Result<T>`, `CorvoApiError`, unions
(`TaxRegime`, `InvoiceStatus`, `InvoiceStage`, `WebhookEvent`). Campos conferidos
campo a campo contra respostas reais; `CreditTransaction` segue o docs (histórico
vazio no ambiente de verificação).

## CLI

Binário `corvo` (commander — única dep; lib em runtime é zero-dep).

Config: `~/.config/corvo/config.json` (0600; override env `CORVO_CONFIG_PATH`).
Precedência: flag `--api-key`/`--base-url` > env `CORVO_API_KEY`/`CORVO_BASE_URL` > arquivo.

```
corvo config set <key> <value> | get <key> | list | path
corvo companies list|get|create|update|remove
corvo certificates list|upload|remove
corvo invoices list|get|create|events|pdf|xml|download-url|email
corvo webhooks list|create|remove|test
corvo webhooks deliveries list|stats|retry
corvo credits balance|plans|history
corvo billing plan|usage
corvo health live|ready
```

- Tabelas por padrão, `--json` em todo comando (flag por comando via helper comum).
- `invoices create --file nota.json | -` (stdin), `--idempotency-key`, `--email`
  (liga `options.email.send`).
- `invoices pdf|xml <id> -o arquivo` (default `nfse-<id>.<ext>`).
- `certificates upload <companyId> --file cert.p12 --password ...`
  (senha via env `CORVO_CERT_PASSWORD` também aceita).
- Erros em stderr com `code`, `requestId`, `details` por campo; exit 1.

## Build e repo

- `package.json`: `type: module`, exports dual (`.js` ESM / `.cjs` CJS + d.ts),
  `bin.corvo → ./bin/corvo`, deps: `commander ^13`; dev: `typescript`, `tsup`, `vitest`,
  `@types/node`, `@biomejs/biome`.
- Scripts: `build`, `test`, `typecheck` (`tsc --noEmit`), `lint` (`biome check src test`).
- README **em inglês**: quickstart lib + CLI + webhook verification.
- Repo: `github.com/corvo-technology/corvo-nfse-node`, branch `main`, yarn.

## Testes

1. **Unitários com fetch mockado**: método/path/query/headers (X-API-Key,
   Idempotency-Key, multipart sem Content-Type manual), normalização por recurso com
   fixtures nos formatos REAIS amostrados, erro REST → `CorvoApiError`
   (code/status/requestId/details/retryAfter), rede/timeout/JSON inválido,
   `204 → null`, paginação e `iterate()` (propagação de cursor, filtros preservados,
   throw em erro).
2. **Construção**: apiKey obrigatória, env fallbacks, baseUrl default
   `https://api.corvo.tech`, `http://` público → throw, privado → ok.
3. **Assinatura**: vetor conhecido
   `{"type":"nfse.invoice.authorized","data":{"id":"inv_1"}}` +
   secret `whsec_test_123` → `sha256=8f9bd040d8f717b19618ab3395ddfa4b8c176b8dc863195227b88dd85426bbbc`;
   corpo alterado/secret errado/header malformado → false.
4. **CLI**: config (precedência, escrita 0600), parsing, `--json`, exit 1 em erro,
   escrita de PDF em arquivo.
5. **Contract opcional** (`test/contract/`): roda só com `CORVO_API_KEY`+`CORVO_BASE_URL`
   (skip automático) — health + companies.list.

## Fora de escopo (YAGNI)

- Auth/session/OAuth/MCP; upgrade/downgrade/checkout/portal (403 por API key);
  preview de créditos (410); retry automático (expomos `error.retryAfter`);
  cancelamento de nota (não existe); server de webhook pronto (só a verificação);
  publish automático ao npm.
