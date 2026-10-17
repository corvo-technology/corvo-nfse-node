# corvo-nfse-node

**The Node.js SDK and CLI for the [Corvo](https://corvo.tech) NFS-e API.** Register companies, calculate taxes, issue Brazilian service invoices (NFS-e), follow them by webhook and download the PDF and XML, from Node 18+, with typed results and no `try/catch` around every call.

- **Typed and promise-based.** Every method returns `{ data }` or `{ error }`. API, network and timeout failures never throw; the error carries the server's stable `code`, the HTTP `status`, the `requestId` and the field-level `details`.
- **Pagination built in.** Every list returns `{ data, pagination: { limit, hasMore, nextCursor } }`, and `iterate()` walks all pages for you.
- **Safe retries.** Issuing an invoice and sending an email accept an idempotency key.
- **Webhook signature check** with a timing-safe HMAC comparison.
- **A CLI** (`corvo`) for the same operations.
- **Small footprint.** The SDK uses the built-in `fetch`, `FormData`, `Blob` and `node:crypto`. The only dependency is `commander`, used by the CLI.

Full API reference: <https://corvo.tech/en/docs>.

## Install

```bash
npm install corvo-nfse-node
# or
yarn add corvo-nfse-node
```

For the CLI on your `PATH`: `npm install -g corvo-nfse-node`.

## Quickstart

Start with a `corvo_test_...` key: invoices issued with it have no fiscal value.

```ts
import { Corvo } from "corvo-nfse-node";

const corvo = new Corvo({
  apiKey: process.env.CORVO_API_KEY, // or just set CORVO_API_KEY
  // baseUrl: "https://api.corvo.tech", // default; also read from CORVO_BASE_URL
});

const { data, error } = await corvo.companies.list({ limit: 10 });
if (error) {
  // CorvoApiError: code, status, requestId, details, retryAfter
  console.error(error.code, error.status, error.requestId, error.details);
} else {
  console.log(data.data, data.pagination);
}
```

`new Corvo()` is the only call that throws: it fails fast when no API key is configured.

### Register a company

```ts
const { data: company, error } = await corvo.companies.create({
  legalName: "Empresa Exemplo Ltda",
  taxId: "11222333000181",
  taxRegime: "Simples Nacional", // "MEI" | "Simples Nacional" | "Lucro Presumido" | "Lucro Real"
  municipalityCode: "3550308", // IBGE code, 7 digits
  defaultServiceCode: "010101", // optional: used when an invoice omits service.code
});
```

In `live`, also upload the A1 certificate. The company is ready when `company.status` is `"ready"` and `company.setupGaps` is empty.

```ts
import { readFileSync } from "node:fs";

await corvo.certificates.upload(company.id, {
  file: readFileSync("certificado.pfx"),
  fileName: "certificado.pfx",
  password: process.env.CERT_PASSWORD!,
});
```

### Estimate the taxes before issuing

Nothing is issued, stored or charged.

```ts
const { data: estimate } = await corvo.invoices.calculate({
  companyTaxId: "11222333000181",
  service: { description: "Consultoria" },
  amount: 1500,
  competenceDate: "2026-10-16",
});
// estimate.status is "ready" or "blocked" (a fiscal gap is data, not an error)
console.log(estimate?.taxes, estimate?.netReceivableAmount);
```

### Issue an invoice

Issuing is asynchronous: a successful call means the request was accepted, not that the invoice is authorized. Follow the status with `invoices.get()` or webhooks.

```ts
const { data: invoice, error } = await corvo.invoices.create(
  {
    companyTaxId: "11222333000181", // or companyId
    customer: { taxId: "52998224725", name: "Cliente", email: "cliente@example.com" }, // optional
    service: { description: "Consultoria" }, // code and city default to the company's
    amount: 150.5,
    competenceDate: "2026-10-16",
    options: { email: { send: true } },
  },
  { idempotencyKey: "order-42" }, // retry-safe: the same key never issues twice
);
```

Use `options: { type: "SCHEDULE" }` with a future `competenceDate` to schedule the issuance.

### Walk every page

```ts
for await (const invoice of corvo.invoices.iterate({ companyId, status: "authorized" })) {
  console.log(invoice.nfseNumber);
}
```

`iterate()` is the one helper that throws: it raises the `CorvoApiError` if a page fails.

### Download the PDF or XML

The invoice must be `authorized` and have its documents ready.

```ts
import { writeFileSync } from "node:fs";

const { data: pdf, error } = await corvo.invoices.pdf(invoice.id);
if (!error) writeFileSync("nfse.pdf", pdf.buffer); // also pdf.mimeType and pdf.fileName
```

### Verify webhook signatures

```ts
import { CorvoWebhooks } from "corvo-nfse-node";

app.post("/webhooks", express.raw({ type: "application/json" }), (req, res) => {
  // Use the raw bytes: if the body is parsed and re-serialized first, the HMAC will not match.
  const signature = req.header("X-Corvo-Signature");
  if (!CorvoWebhooks.verifySignature(req.body, signature, process.env.WEBHOOK_SECRET!)) {
    return res.status(400).send("bad signature");
  }
  const event = JSON.parse(req.body.toString());
  // Deduplicate by event.id: the same event can be delivered more than once.
  res.sendStatus(204);
});
```

## Resources

| Resource | Methods |
| --- | --- |
| `corvo.companies` | `create`, `list`, `iterate`, `get`, `update`, `remove` |
| `corvo.certificates` | `upload`, `list`, `remove` |
| `corvo.invoices` | `create`, `calculate`, `list`, `iterate`, `get`, `events`, `pdf`, `xml`, `downloadUrl`, `sendEmail` |
| `corvo.webhooks` | `list`, `iterate`, `create`, `remove`, `test`, `deliveries.list`, `deliveries.iterate`, `deliveries.stats`, `deliveries.retry` |
| `corvo.credits` | `balance`, `plans`, `history`, `iterateHistory` |
| `corvo.billing` | `plan`, `usage` |
| `corvo.plans` | `list`, `get`, `quote` (public price catalog) |
| `corvo.health` | `live`, `ready` |

Changing plans and the billing portal exist only in the dashboard, so they are not in the SDK.

## CLI

```bash
corvo config set apiKey corvo_test_xxx
corvo config set baseUrl https://api.corvo.tech      # optional
corvo companies list --json
corvo invoices calculate --file nota.json
corvo invoices create --file nota.json --idempotency-key order-1 --email
corvo invoices pdf <id> -o nota.pdf
corvo webhooks deliveries stats --hours 24
corvo credits balance
corvo billing usage
corvo health live
```

Config precedence: flags (`--api-key`, `--base-url`) > env (`CORVO_API_KEY`, `CORVO_BASE_URL`) > `~/.config/corvo/config.json` (written by `corvo config set`). Every command accepts `--json` for raw output; API errors print `code`, `requestId` and field `details` to stderr and exit with code 1. Run `corvo --help` or `corvo <group> --help` for the full list.

## Behavior

- **Auth.** Every request sends `X-API-Key`. Keys are `corvo_test_...` or `corvo_live_...` and belong to one account and environment. All routes live under `/v1`.
- **Base URL.** Defaults to `https://api.corvo.tech`. Plain `http://` is only accepted for loopback and private hosts unless you pass `allowInsecureHttp: true`.
- **Responses.** Single resources and lists come back as the API's `data`; lists add `pagination`. `204 No Content` resolves to `{ data: null }`, and PDF/XML downloads resolve to `{ buffer, mimeType, fileName }`.
- **Errors.** Network failures, timeouts, non-2xx responses and malformed JSON all resolve to `{ error }`. `code` is the API's `ERROR_*` code, falling back to `http_<status>`; transport failures use `network_error`, `timeout` and `invalid_json`. On `429`, `retryAfter` holds the seconds to wait.
- **Timeout.** 30 seconds by default (`timeoutMs`).
- **Idempotency.** `invoices.create` and `invoices.sendEmail` accept `{ idempotencyKey }`, sent as the `Idempotency-Key` header.
- **Environments.** The key decides the environment (`test` or `live`).

## Development

```bash
yarn install
yarn test        # vitest
yarn typecheck   # tsc --noEmit
yarn lint        # biome check
yarn build       # tsup (ESM + CJS + types)
```

Contract tests run only when `CORVO_API_KEY` and `CORVO_BASE_URL` point to a reachable instance.

## License

MIT, see [LICENSE](LICENSE).
