# corvo-nfse-python Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Idiomatic Python SDK for the Corvo NFS-e API — 28 ops + 2 health, tuple result-style, async-first.

**Architecture:** Single `corvo_nfse` package. `client.Corvo` composes 7 resource namespaces (companies, certificates, invoices, webhooks, credits, billing, health) over one `transport` module (httpx + envelope unwrap + error mapping). `result = (data, error)` — exactly one `None`. `iterate()` is an async generator; only it raises `CorvoApiError`.

**Tech Stack:** Python 3.10+, `httpx` (async), `pytest` + `pytest-asyncio` + `respx`, `mypy --strict`, PyPI.

**Spec:** `docs/superpowers/specs/2026-10-13-corvo-nfse-python-design.md` (references the shared spec `2026-10-13-corvo-nfse-shared-design.md`).

## Global Constraints

- Python `>=3.10`; package `corvo-nfse`, module `corvo_nfse`; runtime deps: `httpx` only.
- Auth via `X-API-Key` header. Base URL default `https://api.corvo.tech`; env `CORVO_API_KEY`/`CORVO_BASE_URL`; `prefix` default `v1`.
- Result is always a 2-tuple `(data, error)`; exactly one is `None`. **Never raise** for API/network/timeout. Only `iterate()` raises `CorvoApiError`.
- 28 ops + 2 health, per the shared spec resource table. No extras.
- Envelope: `{data}` → data; `{data: {props: X}}` → X; list → `(data: list[X], pagination: Pagination)`; `204` → `None`.
- Types mirror the Node SDK's `src/types/*.ts` (verified wire format), NOT the stale backend docs.
- HMAC known vector: body `{"type":"nfse.invoice.authorized","data":{"id":"inv_1"}}`, secret `whsec_test_123`, sig `sha256=8f9bd040d8f717b19618ab3395ddfa4b8c176b8dc863195227b88dd85426bbbc`.

---

### Task 1: Scaffold

**Files:** `pyproject.toml`, `src/corvo_nfse/__init__.py`, `test/test_smoke.py`, `LICENSE`, `.gitignore`, `.github/workflows/ci.yml`.

**Steps:** Create the manifest with `requires-python = ">=3.10"`, dep `httpx>=0.27`, dev deps `pytest`, `pytest-asyncio`, `respx`, `mypy`. Layout `src/corvo_nfse/`, `test/`. `__init__.py` exports `VERSION = "0.1.0"`. `test/test_smoke.py` asserts `from corvo_nfse import VERSION; assert VERSION == "0.1.0"`. Run `pytest -q` (pass). Commit `chore: scaffold corvo-nfse-python`.

### Task 2: Error + Result

**Files:** `src/corvo_nfse/error.py`, `test/test_error.py`.

```python
from dataclasses import dataclass, field

@dataclass
class CorvoApiError:
    status: int
    code: str
    message: str
    details: list[dict] = field(default_factory=list)
    request_id: str | None = None
    retry_after: int | None = None
```

Test: construct with `status=400, code="ERROR_VALIDATION"`, assert fields; assert `request_id`/`details` default to `None`/`[]`. `mypy --strict` clean. Commit `feat: CorvoApiError dataclass`.

### Task 3: Transport + envelope + error mapping

**Files:** `src/corvo_nfse/transport.py`, `test/test_transport.py`.

```python
import httpx

class Transport:
    def __init__(self, api_key, base_url, prefix="v1", timeout=30.0, client: httpx.AsyncClient | None = None):
        self._client = client or httpx.AsyncClient(timeout=timeout)
        self._base = f"{base_url.rstrip('/')}/{prefix}"
        self._headers = {"X-API-Key": api_key, "Accept": "application/json"}

    def _unwrap(self, body, mode="data"):
        if mode == "none": return body
        data = (body or {}).get("data")
        if mode == "data": return data
        return (data or {}).get("props") if isinstance(data, dict) else None

    async def request(self, method, path, *, json=None, query=None, idempotency_key=None, unwrap="data"):
        headers = dict(self._headers)
        if idempotency_key: headers["Idempotency-Key"] = idempotency_key
        resp = await self._client.request(method, f"{self._base}{path}", json=json, params=query, headers=headers)
        if resp.status_code == 204: return (None, None)
        if resp.status_code >= 400: return (None, self._to_error(resp))
        return (self._unwrap(resp.json(), unwrap), None)

    def _to_error(self, resp) -> CorvoApiError:
        b = resp.json() if resp.headers.get("content-type","").startswith("application/json") else {}
        return CorvoApiError(status=resp.status_code, code=b.get("code", f"http_{resp.status_code}"), message=b.get("message",""), details=b.get("details") or [], request_id=b.get("requestId") or resp.headers.get("X-Request-Id"))
```

Test with `respx`: assert URL `{base}/v1/companies?limit=10`, header `X-API-Key`, `Idempotency-Key` passed, envelope `{data}` → `data`, `{data: {props}}` → props, `204` → `None`, 400 → `error.status==400` and `.code=="ERROR_VALIDATION"`. `mypy --strict`. Commit `feat: httpx transport with envelope and error mapping`.

### Task 4: Client + construction validation

**Files:** `src/corvo_nfse/client.py`, `test/test_client.py`. `Corvo(api_key=..., base_url=..., prefix=...)` wires `Transport` + 7 resource namespaces. `ValueError` on missing api_key / public http base_url. `health.live()/ready()` return `(raw, None)`. Test: missing key raises; env fallback `CORVO_API_KEY`; default base `https://api.corvo.tech`; health live passes through raw body. Commit `feat: Corvo client with env fallbacks and health`.

### Task 5: Companies resource (pattern)

**Files:** `src/corvo_nfse/resources/companies.py`, `test/test_companies.py`.

```python
class Companies:
    def __init__(self, transport): self._t = transport
    async def list(self, *, limit=None, cursor=None):
        q = {k: v for k, v in {"limit": limit, "cursor": cursor}.items() if v is not None}
        return await self._t.request("GET", "/companies", query=q, unwrap="none")
    async def create(self, params): return await self._t.request("POST", "/companies", json=params)
    async def get(self, id): return await self._t.request("GET", f"/companies/{id}")
    async def update(self, id, params): return await self._t.request("PATCH", f"/companies/{id}", json=params)
    async def remove(self, id): return await self._t.request("DELETE", f"/companies/{id}")
    async def iterate(self, **params):
        cursor = params.get("cursor")
        while True:
            page, err = await self.list(**{**params, "cursor": cursor})
            if err: raise err
            for item in page["data"]: yield item
            if not page["pagination"]["hasMore"]: return
            cursor = page["pagination"]["nextCursor"]
```

Test: `create` posts camelCase body → `(Company, None)`; `list` returns `{data, pagination}`; `iterate` walks 2 pages (asserts cursor passed on page 2); `remove` 204 → `None`. Commit `feat: companies resource`.

### Task 6: Certificates + invoices

**Files:** `src/corvo_nfse/resources/certificates.py`, `invoices.py`, tests.

- `certificates.upload(company_id, file: bytes, password, file_name="certificate.p12")` → `POST /companies/{id}/certificates` with `files={"file": (name, file)}, data={"password": password}`; assert `Content-Type: multipart/form-data` set by httpx. `list`, `remove`.
- `invoices`: `create(params, idempotency_key=None)` → `(Invoice, None)` unwrap `data+props`; `get`; `list`; `iterate`; `events(id)`; `pdf(id)`/`xml(id)` → binary; `download_url(id, fmt)` → POST; `send_email(id, idempotency_key=None)`.

Method signatures table (unwrap mode in parens): `create(data+props)`, `get(data+props)`, `list(none)`, `events(none)`, `pdf(raw)`, `xml(raw)`, `download_url(data)`, `send_email(data)`. Tests per the Node SDK's `invoices.test.ts` + `invoices-download.test.ts`. Commit `feat: certificates and invoices resources`.

### Task 7: Webhooks + deliveries + credits + billing

**Files:** `resources/webhooks.py` (with nested `deliveries`), `resources/credits.py`, `resources/billing.py`, `webhooks.py` (verify), tests.

- `webhooks.list/create/remove/test`, `webhooks.deliveries.list/iterate/stats/retry`.
- `credits.balance/plans/history/iterate_history`.
- `billing.plan/usage`.
- `CorvoWebhooks.verify_signature(raw_body, header, secret) -> bool` with `hmac.compare_digest`.
- `WEBHOOK_EVENTS` constant (9 entries).

Test: `verify_signature` with the known vector → True; tampered → False. Commit `feat: webhooks, credits, billing and signature verification`.

### Task 8: Public exports + README + contract test

**Files:** `__init__.py` re-exports; `README.md` (English, same tone as `corvo-nfse-node`); `test/contract/contract_test.py` (skipped without env). `mypy --strict`, `pytest`, `respx` all green. Commit `docs: README and public exports`.

**Handoff:** create repo `corvo-technology/corvo-nfse-python`, push, publish to PyPI via trusted publishing.
