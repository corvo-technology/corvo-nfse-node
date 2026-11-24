# Corvo public API contract

`openapi.json` (and the same document as `openapi.yaml`) is the contract of the **public API**: the routes a customer calls with an API key. The SDK repositories (`corvo-nfse-node`, `-python`, `-php`, `-ruby`, `-java`, `-dotnet`, `-go`, `-elixir`, `-rust`) are updated from it.

- Download: <https://corvo.tech/openapi.json> (same file as `docs/openapi/openapi.json`).
- Production base URL: `https://api.corvo.tech/v1`. A self-hosted instance uses its own address (`PUBLIC_API_URL`, path `/v1`).
- Version of the contract: `0.3.0`. What changed since the SDKs' `0.2.0` is in [CHANGELOG.md](./CHANGELOG.md), with the breaking changes first.

## How to use it

1. Generate the client, or compare your hand-written one, from `openapi.json`.
2. Name each method after the `operationId` (`resource_action`, for example `invoices_create`, `customers_search`, `cnpj_lookup`, `serviceFavorites_list`). The ids are stable: a route can move or change, the id stays. A removed id is announced in the changelog.
3. Send the key in the `x-api-key` header: `corvo_test_...` for the test environment, `corvo_live_...` for live. A key only sees its own environment.

## Conventions the SDKs must follow

| Topic | Rule |
| --- | --- |
| Success | `{ "data": ... }`. Binary routes (PDF, XML, ZIP, CSV) answer the file itself. `204` has no body. |
| Lists | `{ "data": [...], "pagination": { "limit", "hasMore", "nextCursor" } }`. Pass `nextCursor` as `cursor`. `limit` is 1 to 1000 (50 by default); a few routes have a lower maximum, stated on the parameter. |
| Errors | `{ "statusCode", "code", "message", "details"?, "requestId" }`. Branch on `code` (it starts with `ERROR_`; the list grows, so an unknown code is its HTTP status). Quote `requestId` to support. |
| Field names | `camelCase`, except billing (`/billing/plan`), schedules and imports, which answer in `snake_case`. Both are kept as they are. |
| Idempotency | `Idempotency-Key` header on `POST /invoices`, `POST /invoices/{id}/email` and `POST /invoices/{id}/substitute`. The batch takes an `idempotencyKey` per item instead. |
| Rate limit | `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset` (epoch seconds) on every answer; on 429, `Retry-After` in seconds. |
| Asynchronous | `POST /invoices` answers `202` with the invoice `queued`; follow it by `GET /invoices/{id}` or webhook until `status` is final. |
| Permissions | Each operation lists the permission the key needs in `x-required-permissions` (one of them is enough). |

## What is in the document

Included: every operation marked `@ApiKeyEndpoint()` in the API (usable with `x-api-key`) plus `GET /health/live`, the only route that needs no key.

Left out on purpose:

| Excluded | Why |
| --- | --- |
| `/auth/*`, `/session`, magic link, OAuth, OTP, Turnstile, `/public-config` | Browser session of the dashboard. |
| `/api-keys` | Keys are managed in the dashboard, never with a key. |
| `/mcp`, `/.well-known/*`, MCP connections | Protocol of AI assistants (OAuth), not the REST API. |
| `/platform/*` | Platform administration. |
| `/billing/checkout`, `/billing/subscribe`, `/billing/portal`, `/billing/payments`, `/billing/pix/*` | Payment screens of the dashboard. `GET /billing/plan` and `/billing/usage` are included. |
| `GET /customers/registry/{cnpj}` | Session-only duplicate of `GET /cnpj/{cnpj}`. |
| `/webhooks/stripe`, `/webhooks/woovi`, `/integrations/inbound/*` | Inbound webhooks, signed by the payment provider. |
| `/invoice-package-links/{token}` | Link opened from an e-mail, valid only for the package its token names. |
| `/plans`, `/plans/{slug}`, `/plans/recommend` | Public price catalog without a key; it feeds the pricing page. The plan data a key can read is in `/billing/plan` and `/credits/plans`. |
| `GET /health/ready` | Reports internal dependencies (database, Redis, storage). |
| `POST /credits/purchase/confirm` | Retired (always `410 Gone`). |

On a self-hosted instance (`DEPLOYMENT_MODE=self_hosted`) there is no billing: `/credits/*` is not mounted and `/billing/*` answers as disabled.

## Regenerating

The file is generated from the controllers, never edited by hand:

```bash
cd api
yarn openapi:generate
```

The command builds the API, boots only the public controllers with empty stubs (no database, no Redis) and writes `docs/openapi/openapi.{json,yaml}`, `web/public/openapi.json` and the route table below. CI runs it and fails when the committed files differ ("run `yarn openapi:generate`").

Where each part lives:

- `api/src/infra/openapi/public-operations.ts`: `operationId`, tag, description and response schema of each route. A new `@ApiKeyEndpoint()` route without an entry there breaks the generator.
- `api/src/infra/openapi/public-schemas.ts`: response schemas that have no DTO class.
- Request bodies and query parameters come from the DTO classes (`@ApiProperty` and `class-validator`).
- `api/src/infra/openapi/public-contract.spec.ts` lints the committed file (ids, schemas, enums, excluded routes).

## Routes

`Since` is the contract version in which the route appeared (`0.2.0`: already in the SDKs).

<!-- routes:start -->

| operationId | Method | Path | Since | Summary |
| --- | --- | --- | --- | --- |
| **Invoices** | | | | |
| `fiscalPortal_status` | GET | `/fiscal-portal/status` | 0.3.0 | Whether the national NFS-e portal is answering for this environment |
| `invoicePackage_download` | GET | `/companies/{companyId}/invoice-package` | 0.3.0 | Download the month package (ZIP with xml/, pdf/ and resumo.csv) |
| `invoicePackage_summary` | GET | `/companies/{companyId}/invoice-package/summary` | 0.3.0 | Count and total of the month package, without building it |
| `invoices_calculate` | POST | `/invoices/calculate` | 0.2.0 | Calculate taxes before issuing an invoice |
| `invoices_cancel` | POST | `/invoices/{id}/cancel` | 0.2.0 | Cancel an invoice |
| `invoices_createBatch` | POST | `/invoices/batches` | 0.2.0 | Emit up to 50 NFS-e in one request |
| `invoices_createDownloadUrl` | POST | `/invoices/{id}/download-url` | 0.2.0 | Get a signed download URL for invoice PDF or XML |
| `invoices_create` | POST | `/invoices` | 0.2.0 | Issue an invoice, or schedule one |
| `invoices_downloadPdf` | GET | `/invoices/{id}/pdf` | 0.2.0 | Download invoice PDF |
| `invoices_downloadXml` | GET | `/invoices/{id}/xml` | 0.2.0 | Download invoice XML |
| `invoices_get` | GET | `/invoices/{id}` | 0.2.0 | Get invoice by ID |
| `invoices_listEvents` | GET | `/invoices/{id}/events` | 0.2.0 | Get invoice status transition events |
| `invoices_list` | GET | `/invoices` | 0.2.0 | List invoices for the tenant |
| `invoices_overview` | GET | `/invoices/overview` | 0.2.0 | Get invoice overview for the tenant and execution environment |
| `invoices_review` | POST | `/invoices/review` | 0.3.0 | Resolve invoices in manual review (up to 100): retry or discard |
| `invoices_sendEmail` | POST | `/invoices/{id}/email` | 0.2.0 | Request invoice email to customer |
| `invoices_substitute` | POST | `/invoices/{id}/substitute` | 0.3.0 | Substitute an authorized invoice with a corrected one |
| **Companies** | | | | |
| `accountantPackage_get` | GET | `/companies/{companyId}/accountant-package` | 0.3.0 | Accountant e-mail of the monthly package |
| `accountantPackage_listSends` | GET | `/companies/{companyId}/accountant-package/sends` | 0.3.0 | Last 12 attempts to send the package to the accountant |
| `accountantPackage_send` | POST | `/companies/{companyId}/accountant-package/send` | 0.3.0 | Send the package of a month to the accountant now |
| `accountantPackage_update` | PUT | `/companies/{companyId}/accountant-package` | 0.3.0 | Set the accountant e-mail (null turns the monthly send off) |
| `companies_create` | POST | `/companies` | 0.2.0 | Create a new NFS-e company |
| `companies_delete` | DELETE | `/companies/{id}` | 0.2.0 | Delete a company (soft delete) |
| `companies_get` | GET | `/companies/{id}` | 0.2.0 | Get a company by ID |
| `companies_list` | GET | `/companies` | 0.2.0 | List companies for the current tenant |
| `companies_update` | PATCH | `/companies/{id}` | 0.2.0 | Update a company |
| `dpsSequence_get` | GET | `/companies/{id}/dps-sequence` | 0.3.0 | Get the DPS numbering of a company |
| `dpsSequence_set` | PUT | `/companies/{id}/dps-sequence` | 0.3.0 | Continue the DPS numbering from the last note issued elsewhere |
| `fiscalProfiles_approve` | POST | `/companies/{id}/fiscal-profile/{profileId}/approve` | 0.2.0 | Approve a fiscal profile of the company |
| `fiscalProfiles_list` | GET | `/companies/{id}/fiscal-profile` | 0.2.0 | List the fiscal profile history of the company |
| `fiscalProfiles_upsert` | PUT | `/companies/{id}/fiscal-profile` | 0.2.0 | Create a fiscal profile validity period (idempotent for an identical desired state) |
| `serviceTaxProfiles_approve` | POST | `/companies/{id}/service-tax-profiles/{serviceId}/approve` | 0.2.0 | Approve the saved service tax classification for this company |
| `serviceTaxProfiles_create` | POST | `/companies/{id}/service-tax-profiles` | 0.2.0 | Create a service tax profile in the company catalog |
| `serviceTaxProfiles_delete` | DELETE | `/companies/{id}/service-tax-profiles/{serviceId}` | 0.2.0 | Delete an expired, not yet approved service tax profile |
| `serviceTaxProfiles_list` | GET | `/companies/{id}/service-tax-profiles` | 0.2.0 | List service tax profiles effective on the informed date |
| `serviceTaxProfiles_update` | PATCH | `/companies/{id}/service-tax-profiles/{serviceId}` | 0.2.0 | Update a service tax profile of the company catalog |
| **Certificates** | | | | |
| `certificates_list` | GET | `/companies/{companyId}/certificates` | 0.2.0 | List certificates for a company |
| `certificates_revoke` | DELETE | `/companies/{companyId}/certificates/{certId}` | 0.2.0 | Revoke and delete a certificate |
| `certificates_upload` | POST | `/companies/{companyId}/certificates` | 0.2.0 | Upload a PKCS#12 certificate for NFS-e |
| **Customers** | | | | |
| `cnpj_lookup` | GET | `/cnpj/{cnpj}` | 0.3.0 | Look up the registration data of a CNPJ |
| `customers_delete` | DELETE | `/customers/{taxId}` | 0.3.0 | Forget a saved customer (issued invoices are not changed) |
| `customers_get` | GET | `/customers/{taxId}` | 0.3.0 | Get a saved customer by CPF or CNPJ |
| `customers_search` | GET | `/customers` | 0.3.0 | List saved customers, most recently used first |
| `customers_update` | PATCH | `/customers/{taxId}` | 0.3.0 | Correct the name or the email of a saved customer |
| **Service favorites** | | | | |
| `serviceFavorites_create` | POST | `/companies/{companyId}/service-favorites` | 0.3.0 | Save a favorite service for the company |
| `serviceFavorites_delete` | DELETE | `/companies/{companyId}/service-favorites/{favoriteId}` | 0.3.0 | Remove a favorite service |
| `serviceFavorites_list` | GET | `/companies/{companyId}/service-favorites` | 0.3.0 | List the favorite services of a company |
| **Schedules** | | | | |
| `schedules_cancel` | POST | `/schedules/{id}/cancel` | 0.3.0 | Cancel a schedule (final) |
| `schedules_get` | GET | `/schedules/{id}` | 0.3.0 | Get a schedule |
| `schedules_listRuns` | GET | `/schedules/{id}/runs` | 0.3.0 | Log of every attempt to run a schedule, newest first |
| `schedules_list` | GET | `/schedules` | 0.3.0 | List scheduled and recurring invoices |
| `schedules_pause` | POST | `/schedules/{id}/pause` | 0.3.0 | Pause a schedule |
| `schedules_resume` | POST | `/schedules/{id}/resume` | 0.3.0 | Resume a paused schedule at its next occurrence |
| `schedules_update` | PATCH | `/schedules/{id}` | 0.3.0 | Change a schedule; applies to the next runs only |
| **Imports** | | | | |
| `imports_discard` | DELETE | `/imports/{id}` | 0.3.0 | Discard an import that has not been emitted |
| `imports_downloadErrors` | GET | `/imports/{id}/errors.csv` | 0.3.0 | CSV with the rows that need attention, streamed |
| `imports_downloadTemplate` | GET | `/imports/template` | 0.3.0 | Download the spreadsheet template |
| `imports_emit` | POST | `/imports/{id}/emit` | 0.3.0 | Emit every valid row of the import |
| `imports_get` | GET | `/imports/{id}` | 0.3.0 | Status and counters of an import |
| `imports_listRows` | GET | `/imports/{id}/rows` | 0.3.0 | Rows of an import, one page at a time (default 50, at most 200) |
| `imports_list` | GET | `/imports` | 0.3.0 | Recent imports with their counters (newest first, at most 20) |
| `imports_start` | POST | `/imports` | 0.3.0 | Import invoices from a CSV or Excel spreadsheet |
| `imports_updateRow` | PATCH | `/imports/{id}/rows/{line}` | 0.3.0 | Correct one row and check it again (only while the import is ready) |
| **Webhooks** | | | | |
| `webhookDeliveries_list` | GET | `/webhooks/deliveries` | 0.2.0 | List recent webhook deliveries (last 24h) |
| `webhookDeliveries_retry` | POST | `/webhooks/deliveries/{id}/retry` | 0.2.0 | Manual retry webhook delivery |
| `webhookDeliveries_stats` | GET | `/webhooks/deliveries/stats` | 0.2.0 | Get webhook delivery stats |
| `webhooks_create` | POST | `/webhooks` | 0.2.0 | Register webhook |
| `webhooks_delete` | DELETE | `/webhooks/{id}` | 0.2.0 | Delete webhook |
| `webhooks_list` | GET | `/webhooks` | 0.2.0 | List webhooks |
| `webhooks_test` | POST | `/webhooks/{id}/test` | 0.2.0 | Send test event |
| **Credits and billing** | | | | |
| `billing_getPlan` | GET | `/billing/plan` | 0.2.0 | Get the current plan, subscription and usage |
| `billing_getUsage` | GET | `/billing/usage` | 0.2.0 | Get the quota status of the period |
| `credits_getBalance` | GET | `/credits` | 0.2.0 | Get current credit balance |
| `credits_listHistory` | GET | `/credits/history` | 0.2.0 | Get credit transaction history |
| `credits_listPlans` | GET | `/credits/plans` | 0.2.0 | List all plans (free + paid tiers) |
| `credits_previewPurchase` | GET | `/credits/purchase/preview` | 0.3.0 | Price a one-off purchase of N notes (R$ 0,99 each) |
| **Integrations** | | | | |
| `integrationConnections_activate` | POST | `/integrations/connections/{id}/activate` | 0.3.0 | Start issuing invoices automatically |
| `integrationConnections_create` | POST | `/integrations/connections` | 0.3.0 | Create a connection |
| `integrationConnections_disconnect` | POST | `/integrations/connections/{id}/disconnect` | 0.3.0 | Disconnect for good |
| `integrationConnections_get` | GET | `/integrations/connections/{id}` | 0.3.0 | Get a connection |
| `integrationConnections_listEvents` | GET | `/integrations/connections/{id}/events` | 0.3.0 | Recent events received for a connection |
| `integrationConnections_listOperations` | GET | `/integrations/connections/{id}/operations` | 0.3.0 | Recent operations (sales) and their invoice status |
| `integrationConnections_listRules` | GET | `/integrations/connections/{id}/rules` | 0.3.0 | List the rules of a connection |
| `integrationConnections_list` | GET | `/integrations/connections` | 0.3.0 | List connections |
| `integrationConnections_pause` | POST | `/integrations/connections/{id}/pause` | 0.3.0 | Stop issuing; events are still recorded |
| `integrationConnections_replaceRules` | PUT | `/integrations/connections/{id}/rules` | 0.3.0 | Replace the rules of a connection |
| `integrationConnections_updateCredentials` | PUT | `/integrations/connections/{id}/credentials` | 0.3.0 | Replace credentials (for example a rotated API key) |
| `integrationConnections_validate` | POST | `/integrations/connections/{id}/validate` | 0.3.0 | Check the credentials and identify the external account |
| `integrationOperations_completeCustomer` | PATCH | `/integrations/operations/{id}/customer` | 0.3.0 | Fill in the customer of an operation waiting for it |
| `integrationOperations_retry` | POST | `/integrations/operations/{id}/retry` | 0.3.0 | Try to issue the invoice of an operation again |
| `integrations_listProviders` | GET | `/integrations/providers` | 0.3.0 | List the payment platforms Corvo can connect to |
| **Health** | | | | |
| `health_live` | GET | `/health/live` | 0.3.0 | Liveness check |

<!-- routes:end -->
