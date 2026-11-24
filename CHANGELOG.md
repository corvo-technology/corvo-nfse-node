# Changelog

## 0.3.0 (2026-11-24)

Updates the SDK to the public API contract 0.3.0 (`spec/openapi.json`, 92 operations).

### Breaking

- Plan slugs: `developer`, `growth`, `scale` and `volume` are gone; they are now `free`, `solo`, `equipe`, `empresa`, `escala` (and `self-hosted`).
- `invoices.create` with `options.type` `SCHEDULE` (and the new `RECURRING`) returns a `Schedule` (snake_case), not an `Invoice`. The method is overloaded by `options.type`; use `isSchedule()` when it is not known.
- `credits.balance()`: removed `overageUnits` and `overageAmountCents`; added `planRemaining` and `avulsoBalance` (`balance` includes the loose notes). `tenantId` is no longer returned.
- `billing.plan()`: removed `usage.overage_units` and `usage.overage_amount_cents`; added `usage.avulso_balance` and `subscription.stripe_portal_available`, `stripe_subscription`, `pix_subscription`. A workspace without plan answers `404` `NO_PLAN_ASSIGNED`.
- Credit purchase preview is `credits.previewPurchase(units)` (`GET /credits/purchase/preview`).
- Types follow the contract exactly (see `src/types/openapi.ts`): the `Invoice` fields `documentsReadyAt`, `documentsStatus`, `emailStatus`, `lastEmailStatus`, `stage`; 12 webhook events (`nfse.invoice.taker_rejected` added); `Webhook.environment`; `webhooks.test()` returns `{ sent: false, error, statusCode }` on a failed delivery.
- A test key can no longer manage live webhooks, and webhook URLs on private networks are refused (API behavior).

### Added

- Resources: `customers`, `cnpj`, `schedules`, `imports`, `integrations` (providers, connections, operations), `fiscalPortal`.
- Under `companies`: `accountantPackage`, `invoicePackage` (summary and ZIP), `dpsSequence`, `fiscalProfiles`, `serviceTaxProfiles`, `serviceFavorites`.
- `invoices.substitute`, `invoices.overview`, `invoices.review`; `invoices.list({ customerTaxId })`; `invoices.sendEmail(id, { email })`.
- Request fields: `RECURRING` with `recurrence`, `purchaseOrder`, `notes`, `customer.foreign`, `service.fiscal`.
- CLI: `cnpj`, `customers`, `schedules`, `imports`, `package`, `credits preview`, `invoices substitute|overview|review`, `invoices list --customer-tax-id`, `invoices email --to`.
- `User-Agent: corvo-nfse-node/<version>` on every request; `PUT` in the transport.
- `spec/openapi.json` (vendored contract), `scripts/gen-types.mjs` (`yarn gen:types`) and `test/contract/coverage.test.ts` (every operationId must be implemented and hit the contract's method and path).
- GitHub Actions: `ci.yml` (lint, typecheck, test, build on Node 18, 20, 22) and `publish.yml` (tag `v*`, npm with provenance).

### Changed

- `companies.remove` and `customers.remove` resolve to the response `data` (`null` or an object).
- `TaxRegime` accepts `Lucro Presumido` and `Lucro Real` as in the contract.

## 0.2.0

First contract the SDK was written for.
