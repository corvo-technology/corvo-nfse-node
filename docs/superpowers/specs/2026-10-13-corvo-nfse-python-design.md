# corvo-nfse-python Design

Date: 2026-10-13. References: `2026-10-13-corvo-nfse-shared-design.md`, `corvo-nfse-node`, `MillionSend/millionsend-python`.

## Goal

Idiomatic Python SDK (3.10+) for the Corvo NFS-e API. Library only; no CLI.

## Package

- **PyPI name**: `corvo-nfse`. Module: `corvo_nfse`.
- **Manifest**: `pyproject.toml` (PEP 621). `requires-python = ">=3.10"`.
- **Runtime deps**: `httpx` (async HTTP), `anyio` (transport backend compat).
- **Dev deps**: `pytest`, `pytest-asyncio`, `respx` (httpx mock), `mypy --strict`.

## Idiom

- **HTTP**: `httpx.AsyncClient`; connection pooling, 30s default timeout, abort signal.
- **Async**: `asyncio`. Public API is async-only: `async with Corvo(...) as c: ...`. A `CorvoSync` thin wrapper over `httpx.Client` is optional (YAGNI for now).
- **Result**: `(data, error)` tuple. Exactly one is `None`. Type alias `Result = tuple[Data | None, CorvoApiError | None]`. `CorvoApiError` is a `@dataclass` with `status`, `code`, `message`, `details`, `request_id`, `retry_after`.
- **Construction**: `Corvo(api_key=..., base_url=...)`. Raises `ValueError` on missing key / http public host.

## Layout

```
src/corvo_nfse/
  __init__.py        # public exports: Corvo, CorvoApiError, CorvoWebhooks, WEBHOOK_EVENTS, types
  client.py          # Corvo class
  transport.py       # unwrap(), to_error(), HTTP request/iterate helpers
  error.py           # CorvoApiError dataclass
  webhooks.py        # CorvoWebhooks.verify_signature(raw_body, header, secret)
  resources/
    companies.py
    certificates.py
    invoices.py
    webhooks.py
    credits.py
    billing.py
    health.py
  types/             # dataclasses mirroring the wire format
test/
  test_transport.py
  test_webhooks.py
  test_resources/
  contract/          # skipped without env
```

## Testing

Three layers per the shared spec. `respx` mocks httpx; tests assert method/path/headers/body/unwrapped result/error/pagination. HMAC known vector (same body/secret/sig as the shared). `pytest-asyncio` mode `auto`. `mypy --strict` clean.

## Distribution

- Build: `python -m build` (wheel + sdist). Publish to PyPI via trusted publishing on GitHub Actions.
- Versioning: synchronized with the 7 other SDKs.
- README: install, quickstart, downloads, webhook verification, link to `corvo-nfse-node` for the CLI.

## Out of scope

CLI, `billing/upgrade|downgrade|checkout|portal`, `credits/purchase/preview`, automatic OpenAPI codegen.
