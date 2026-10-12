# Spec — corvo-nfse-node

Data: 2026-10-12
Status: aprovado em brainstorming, aguardando revisão

## Objetivo

Lib Node.js + CLI oficial para a API Corvo (NFS-e self-hosted), modelada após
[millionsend-node](https://github.com/MillionSend/millionsend-node). Cobrange
exatamente as 31 operações habilitadas para autenticação por API key, conforme
`corvo-backend/docs/api-key-reference.md` e `docs/api/http-contract.md`.

Pacote npm: `corvo-nfse-node`. Diretório: `/Users/pedrohenrique/Documents/corvo-nodejs`.
Node 18+ (usa `fetch`, `FormData`, `Blob` e `crypto` globais). TypeScript,
build dual ESM+CJS via tsup, testes com Vitest.

## Contrato da API (referência, conferido no backend)

- Prefixo padrão `/v1` (`API_PREFIX`); baseUrl default do cliente: `https://api.corvo.tech`.
- Autenticação: header `X-API-Key`. Formato `corvo_test_`/`corvo_live_` + 40 hex.
  `Authorization: Bearer` não substitui `X-API-Key`. Não enviar `tenantId` no corpo.
- Ambiente (`test`/`live`) é o persistido na chave; `X-Corvo-Environment` é ignorado
  com API key autenticada.
- Erros REST: `{ statusCode, code, message, details?, requestId }` — `code` é estável
  (`ERROR_VALIDATION` etc.), `details` é array de `{field, code, message}` em 400 de
  validação. Header `X-Request-Id` em toda resposta. 429 pode trazer `retryAfter`.
- Sucesso é heterogêneo: `{data}`, `{data, pagination}`, `{props}`, arrays puros,
  `{deleted}`, `{sent}`, `{retried}`, PDF/XML cruos, 204 sem corpo.

## Cliente

```ts
import { Corvo } from 'corvo-nfse-node';

const corvo = new Corvo({
  apiKey: 'corvo_live_...',   // fallback process.env.CORVO_API_KEY; throw se ausente
  baseUrl: 'https://api.corvo.tech', // default; fallback process.env.CORVO_BASE_URL
  timeoutMs: 30_000,
  fetch: customFetch,         // opcional
  allowInsecureHttp: false,   // http:// aceito só em loopback/rede privada; true libera qualquer host
});
```

- Node 18+ obrigatório (validado no construction).
- Requisições montam `X-API-Key`, `Content-Type: application/json` (quando há corpo)
  e encaminham `Idempotency-Key` quando o método da resource aceita a opção.
- Timeout via `AbortSignal`; `204` resolve como `data: null`.

## Resultado

Estilo millionsend: erro de API ou de rede **nunca lança**.

```ts
const { data, error } = await corvo.invoices.create(params);
if (error) {
  error.code;       // 'ERROR_VALIDATION' (vem do corpo) ou 'network_error' | 'timeout'
  error.status;     // HTTP status ou 0 em falha de rede/timeout
  error.message;    // string
  error.details;    // {field, code, message}[] | undefined
  error.requestId;  // X-Request-Id | body.requestId | undefined
  error.retryAfter; // segundos, só em 429
}
```

`CorvoApiError` é um Error nomeado (stack útil em logs) exposto como `error`.
Programação imperativa (`throw`) é possível tratando `if (error) throw error`.

## Normalização de envelopes

| API retorna | Lib entrega |
|---|---|
| `{ props: Invoice }` (notas) | `Invoice` direto |
| `{ data: X }` | `X` direto |
| `{ data: null }` / `204` | `null` |
| `{ data: [...] , pagination }` (matriz de rotas) | `{ data: T[], pagination }` |
| `[{ props: X }]` (notas, eventos, planos, histórico) | `T[]` |
| `Certificate` / `Certificate[]` (certificados) | `Certificate` / `Certificate[]` |
| `{ deleted: true }`, `{ sent: true }`, `{ retried: true }` | o objeto booleano direto |
| PDF/XML cruos | `Buffer` (+ `mimeType`, `fileName` dos headers) |

`pagination` é `{ limit, hasMore, nextCursor }` montado por recurso, respeitando a
realidade de cada endpoint:

- **Empresas**: API faz `limit+1` sem metadados → lib monta `hasMore` pelo item extra e
  `nextCursor` do último item exibido (`createdAt|id`).
- **Notas**: cursor `createdAt` ASC estrito; API não devolve metadados → lib usa
  `hasMore = items.length === limit`, `nextCursor` do último item.
- **Entregas de webhook e histórico de créditos**: offset/limit → `hasMore` por
  `items.length === limit`, `nextCursor = String(offset + items.length)`.

Auto-paginação: `corvo.invoices.iterate(params)` devolve `AsyncGenerator<Invoice>`
(varre todas as páginas); análogo em `companies.iterate`, `webhooks.deliveries.iterate`,
`credits.history.iterate`.

## Resources

Tudo que segue é autenticado por API key. `pagination`/`limit`/`cursor` conforme contrato.

### companies
- `create(params)` → `POST /companies` → `Company` (201). Campos: `legalName`, `taxId`,
  `taxRegime` (`MEI` | `Simples Nacional` | `Lucro Presumido` | `Lucro Real`),
  `tradeName?`, `municipalReg?`, `municipalityCode?`, `simpleNational?`,
  `specialRegime?`, `address?` (objeto aninhado na entrada; resposta achatada em
  `addressStreet` etc.).
- `list(params?)` → `GET /companies` → `{ data: Company[], pagination }`
- `iterate(params?)` → AsyncGenerator<Company>
- `get(id)` → `GET /companies/:id` → `Company`
- `update(id, params)` → `PATCH /companies/:id` → `Company` (`municipalReg: null` limpa;
  `address: null` limpa; `environment` não muda)
- `remove(id)` → `DELETE /companies/:id` → `null`

### certificates
- `upload(companyId, { file: Buffer | Uint8Array, fileName?, password })` →
  `POST /companies/:companyId/certificates` multipart → `Certificate`.
  Máx 50 KiB no backend. `fileName` default `certificate.p12`.
- `list(companyId)` → `GET .../certificates` → `Certificate[]`
- `remove(companyId, certId)` → `DELETE ...` → `null` (204)

### invoices
- `create(params, options?)` → `POST /invoices` → `Invoice` (201, status `queued`).
  Entrada: `companyId` XOR `companyTaxId`, `externalId?`, `customer` (name, taxId,
  email?, address? {city,state}...), `service` ({code 6 dígitos, municipalityCode?,
  description?}), `amount`, `competenceDate`, `email?`, `options.email.send?`.
  `options.idempotencyKey` → header `Idempotency-Key`.
- `list(params?)` → `GET /invoices` → `{ data: Invoice[], pagination }`.
  Filtros: `companyId`, `status`, `from`, `to` (competência), `externalId`,
  `limit` (1–100, default 50), `cursor`.
- `iterate(params?)` → AsyncGenerator<Invoice>
- `get(id)` → `GET /invoices/:id` → `Invoice`
- `events(id)` → `GET /invoices/:id/events` → `InvoiceEvent[]` (sem paginação)
- `pdf(id)` → `GET /invoices/:id/pdf` → `{ data: Buffer, mimeType, fileName }`; exige `authorized`
- `xml(id)` → idem com XML
- `downloadUrl(id, format: 'pdf' | 'xml')` → `POST /invoices/:id/download-url` →
  `{ downloadUrl, expiresAt, fileName, mimeType }`
- `sendEmail(id, options?)` → `POST /invoices/:id/email` → `{ emailId, status }` (202);
  `options.idempotencyKey`

Status fiscais expostos como union type:
`queued | processing | authorized | rejected | retry_pending | reconciliation_required | manual_review | failed`.
Derived: `stage` (`pending | authorized | documents_ready | completed | failed`),
`documentsStatus`, `emailStatus`.

### webhooks
- `list()` → array de `Webhook` (sem secret)
- `create({ url, events })` → `Webhook & { secret: string }` — secret só retornado aqui
- `remove(id)` → `{ deleted: true }`
- `test(id)` → `{ sent: true }`
- `deliveries.list(params?)` → `WebhookDelivery[]` (`hours`, `limit`, `offset`, `environment`)
- `deliveries.iterate(params?)` → AsyncGenerator<WebhookDelivery>
- `deliveries.stats(params?)` → `{ total, sent, failed, pending, delayed }`
- `deliveries.retry(id)` → `{ retried: true }`

Constante `WEBHOOK_EVENTS` com os 8 eventos públicos
(`nfse.invoice.authorized` ... `nfse.invoice.email_failed`) + `webhook.test`.

### Webhooks — lado receptor
`CorvoWebhooks.verifySignature(rawBody: string | Buffer, signatureHeader: string, secret: string): boolean`
— HMAC-SHA256 timing-safe, formato `sha256=<hex>`, exige os bytes brutos do corpo.
Espelha `webhook-dispatcher.adapter.ts` do backend.

### credits
- `balance()` → `{ tenantId, balance }`
- `plans()` → `Plan[]`
- `history(params?)` → `{ data: CreditTransaction[], pagination }` (offset)
- `history.iterate(params?)` → AsyncGenerator<CreditTransaction>
- `preview({ amountBrlCents })` → `{ credits, unitPriceCents }`

### billing
- `plan()` → `{ plan, usage }` (snake_case preservado — é o formato real da API)
- `usage()` → `QuotaStatus` (camelCase — formato real deste endpoint)
- `upgrade({ planSlug })` → envia `plan_slug` → `{ plan_slug, period_start, period_end }`
- `downgrade({ planSlug })` → `{ current_plan, scheduled_plan, effective_at }`

### health
- `live()` / `ready()` → status operacional (`{ status: 'ok' }`), sem auth de negócio.

## Tipos exportados

`Company`, `Certificate`, `Invoice`, `InvoiceEvent`, `Webhook`, `WebhookDelivery`,
`CreditTransaction`, `Plan`, `QuotaStatus`, `CorvoError`, `Paginated<T>`,
unions de status/eventos. Campos e nullabilidade conferidos contra os serializers do
backend (ex.: `Invoice` com `accessKey`/`nfseNumber` nullable, snapshots, `stage`).

Nota de fidelidade: a lib NÃO reescreve campos para camelCase na **resposta** —
o JSON real é repassado como está (camelCase e snake_case convivem, ex. `billing.plan`).
 camelCase vale para **entrada** e opções da lib.

## CLI

Binário `corvo` (commander; única dependência do CLI; lib em runtime é zero-dep).

Configuração: `corvo config set <key> <value>` (`apiKey`, `baseUrl`) gravando
`~/.config/corvo/config.json` (0600). Precedência: flag `--api-key`/`--base-url` >
env `CORVO_API_KEY`/`CORVO_BASE_URL` > arquivo de config.

Comandos (espelho da lib):

```
corvo config set|get|list|path
corvo companies list|get|create|update|remove
corvo certificates list|upload|remove
corvo invoices list|get|create|events|pdf|xml|download-url|email
corvo webhooks list|create|remove|test
corvo webhooks deliveries list|stats|retry
corvo credits balance|plans|history|preview
corvo billing plan|usage|upgrade|downgrade
corvo health live|ready
```

Comportamento:
- Saída humana em tabelas por padrão; `--json` em todo comando devolve o JSON cru da lib.
- `corvo invoices create --file nota.json` (ou JSON no stdin com `-`), suporta
  `--idempotency-key`; `--email` liga `options.email.send`.
- `corvo invoices pdf|xml <id> -o arquivo` grava em disco (default `nfse-<id>.<ext>`).
- `corvo certificates upload <companyId> --file cert.p12 --password ...` (senha também
  via env `CORVO_CERT_PASSWORD` para não vazar em history/shell).
- `corvo invoices download-url <id> --format pdf` imprime a URL.
- Erros: mensagem legível em stderr com `code`, `requestId` e `details` por campo;
  exit code 1. `--json` imprime o objeto de erro em stderr.
- `--base-url` default aplicado pelo cliente (api.corvo.tech) quando nada configurado.

## Build e repo

- `package.json`: `type: module`, exports dual import/require com types, `bin.corvo`.
- tsup: `dist/esm`, `dist/cjs`, `.d.ts`. Biome ou eslint mínimo — seguir o padrão do
  corvo-backend (eslint) só se não pesar; decisão: **Biome** (rápido, zero config extra).
- Vitest. `pnpm` para gerência (mesma escolha da millionsend).
- README em português com quickstart lib + CLI e exemplo de verificação de webhook.

## Testes

1. **Unitários com fetch mockado**: cada método monta método/path/headers corretos;
   normalização de envelope por recurso (tabela acima); erro REST → `CorvoApiError`
   com code/status/details/requestId; erro de rede e timeout → resultado de erro;
   204 → `null`; paginação de empresas (limit+1) e de notas (cursor).
2. **Assinatura de webhook**: vetor conhecido — corpo fixo + secret fixo → hex esperado;
   header malformado e corpo alterado → false.
3. **CLI**: parsing de args (commander programático), precedência de config, exit code
   em erro. Saída formatada com snapshot leve.
4. **Contract opcional**: `test/contract/` rodando só com `CORVO_API_KEY`+`CORVO_BASE_URL`
   definidos (skip automático caso contrário) — health + companies.list contra a
   instância real.

## Fora de escopo (YAGNI)

- Auth por sessão/magic-link/OAuth, MCP, Turnstile/OTP.
- Retry automático em 429/5xx (expomos `error.retryAfter`; quem decide é o chamador).
- Cancelamento/edição de nota (não existe na API).
- Webhook server pronto para uso (só a utilidade de verificação de assinatura).
- Publish automático ao npm (o user publica quando quiser).
