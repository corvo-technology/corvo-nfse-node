# corvo-nfse-node

**The Node.js SDK and CLI for the Corvo NFS-e API — built for self-hosted installs, zero runtime dependencies, and errors that never throw.**

Issue, list, download, and reconcile Brazilian electronic service invoices (NFS-e) from a Node 18+ app. No wrapper frameworks, no global fetch polyfill, no `try/catch` around every call.

## Why corvo-nfse-node

- **Self-hosted first.** Point it at your own Corvo instance with `baseUrl`; the default `https://api.corvo.tech` only applies when you don't.
- **Zero runtime dependencies.** `fetch`, `FormData`, `Blob`, and `node:crypto` are built-in. Your lockfile stays clean.
- **Errors that never throw.** API, network, and timeout failures return `{ error: CorvoApiError }` with the server's stable `code`, HTTP `status`, `requestId`, and field-level `details`. Throw it yourself if you prefer.
- **Pagination you don't have to think about.** Every list returns `{ data, pagination: { limit, hasMore, nextCursor } }`. Need every page? `await corvo.invoices.iterate({...})` walks them for you.

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
  apiKey: "corvo_live_xxx",          // or set CORVO_API_KEY
  baseUrl: "https://api.corvo.tech", // or CORVO_BASE_URL for your self-hosted install
});

const { data, error } = await corvo.companies.list({ limit: 10 });
if (error) {
  // CorvoApiError: code, status, requestId, details, retryAfter
  console.error(error.code, error.status, error.requestId, error.details);
} else {
  console.log(data.data, data.pagination);
}
```

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
  { idempotencyKey: "order-42" }, // safe to retry without double-issuing
);
```

### Walk every page without thinking about cursors

```ts
for await (const invoice of corvo.invoices.iterate({ companyId, status: "authorized" })) {
  console.log(invoice.nfseNumber);
}
```

### Download the PDF or XML of an authorized invoice

```ts
const { data: pdf } = await corvo.invoices.pdf(invoice.id);
writeFileSync("nfse.pdf", pdf.buffer); // buffer, mimeType, fileName included
```

### Verify webhook signatures

```ts
import { CorvoWebhooks } from "corvo-nfse-node";

app.post("/webhooks", (req, res) => {
  // Use the raw bytes — JSON.parse first and the HMAC will never match.
  const signature = req.header("X-Corvo-Signature");
  if (!CorvoWebhooks.verifySignature(req.rawBody, signature, secret)) {
    return res.status(400).send("bad signature");
  }
  handleEvent(req.body);
  res.sendStatus(204);
});
```

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

Config precedence: flags (`--api-key`, `--base-url`) > env (`CORVO_API_KEY`, `CORVO_BASE_URL`) > `~/.config/corvo/config.json` (written by `corvo config set`). Every command accepts `--json` for raw output; API errors print `code`, `requestId`, and field `details` to stderr with exit code 1.

Run `corvo --help` or `corvo <group> --help` for the full command list.

## Development

```bash
yarn install
yarn test        # vitest
yarn typecheck   # tsc --noEmit
yarn lint        # biome check
yarn build       # tsup (ESM + CJS + types)
```

Contract tests run only when `CORVO_API_KEY` and `CORVO_BASE_URL` are set against a reachable instance.

## License

MIT — see [LICENSE](LICENSE).
