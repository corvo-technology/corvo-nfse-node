# corvo-nfse-node

Node.js SDK + CLI for the [Corvo](https://api.corvo.tech) self-hosted NFS-e API. Auth by API key, `{ data, error }` results, zero runtime dependencies (Node 18+).

## Install

```bash
yarn add corvo-nfse-node
# or globally for the CLI
yarn global add corvo-nfse-node
```

## SDK quickstart

```ts
import { Corvo } from "corvo-nfse-node";

const corvo = new Corvo({
  apiKey: "corvo_live_xxx",        // or CORVO_API_KEY
  baseUrl: "https://api.corvo.tech", // default; or CORVO_BASE_URL (self-hosted)
});

const { data, error } = await corvo.companies.list({ limit: 10 });
if (error) {
  console.error(error.code, error.status, error.requestId, error.details);
} else {
  console.log(data.data, data.pagination);
}
```

Errors never throw — API, network and timeout failures come back as `{ error: CorvoApiError }`. Throw it yourself if you prefer exceptions.

### Issue an invoice

```ts
const { data: invoice, error } = await corvo.invoices.create(
  {
    companyId: "...",
    customer: { name: "Customer", taxId: "52998224725", email: "a@b.com" },
    service: { code: "010101", municipalityCode: "3170206", description: "Services" },
    amount: 150.5,
    competenceDate: "2026-10-12",
  },
  { idempotencyKey: "order-42" },
);
```

### Pagination

Every list returns `{ data, pagination: { limit, hasMore, nextCursor } }`. Walk all pages with an async generator:

```ts
for await (const invoice of corvo.invoices.iterate({ companyId, status: "authorized" })) {
  console.log(invoice.nfseNumber);
}
```

### Downloads

```ts
const { data: pdf } = await corvo.invoices.pdf(invoice.id);
writeFileSync("nfse.pdf", pdf.buffer);
```

### Verifying webhooks

```ts
import { CorvoWebhooks } from "corvo-nfse-node";

app.post("/webhooks", (req, res) => {
  const signature = req.header("X-Corvo-Signature");
  if (!CorvoWebhooks.verifySignature(req.rawBody, signature, secret)) {
    return res.status(400).send("bad signature");
  }
  // handle event
});
```

Use the raw request body — parsing JSON first breaks the HMAC.

## CLI

```bash
corvo config set apiKey corvo_live_xxx --base-url https://corvo.example.com
corvo companies list --json
corvo invoices create --file nota.json --idempotency-key order-1 --email
corvo invoices pdf <id> -o nota.pdf
corvo webhooks deliveries stats --hours 24
corvo credits balance
corvo billing usage
corvo health live
```

Config precedence: flags (`--api-key`, `--base-url`) > env (`CORVO_API_KEY`,
`CORVO_BASE_URL`) > `~/.config/corvo/config.json` (written by `corvo config set`).
Every command accepts `--json` for raw output; errors print `code`, `requestId`
and field `details` to stderr with exit code 1.

Run `corvo --help` or `corvo <group> --help` for the full command list.

## Development

```bash
yarn install
yarn test        # vitest
yarn typecheck   # tsc --noEmit
yarn lint        # biome check
yarn build       # tsup (ESM + CJS + types)
```

Contract tests run only when `CORVO_API_KEY` and `CORVO_BASE_URL` are set.

## License

MIT
