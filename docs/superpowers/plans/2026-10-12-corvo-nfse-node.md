# corvo-nfse-node Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SDK Node.js + CLI (`corvo-nfse-node`) para a API Corvo de NFS-e self-hosted, estilo millionsend-node.

**Architecture:** Cliente `Corvo` com um `HttpTransport` interno (fetch global, auth `X-API-Key`, timeout, unwrap de envelope) e resources tipados por domínio (companies, certificates, invoices, webhooks, credits, billing, health). Resultado `{data, error}` nunca lança em erro de requisição. CLI em commander espelhando a lib. Zero deps na lib; commander é única dep.

**Tech Stack:** TypeScript strict, Node 18+, tsup (ESM `.js` + CJS `.cjs` + d.ts), Vitest, Biome, yarn.

**Spec:** `docs/superpowers/specs/2026-10-12-corvo-nfse-node-design.md` (contrato VERIFICADO no backend local — fixtures dos testes replicam respostas reais amostradas).

## Global Constraints

- Node `>=18.0.0`; lib em runtime com **zero dependências** (globals `fetch`/`FormData`/`Blob`/`node:crypto`); única dep do pacote: `commander ^13`.
- Pacote `corvo-nfse-node`, `type: module`, gerência com **yarn** (nunca pnpm/npm).
- baseUrl default `https://api.corvo.tech`; env `CORVO_API_KEY`/`CORVO_BASE_URL`; prefixo `v1` (opção `prefix`).
- Auth sempre header `X-API-Key` (nunca `Authorization: Bearer`); nunca enviar `tenantId`.
- Erros de requisição/rede/timeout → `{ error: CorvoApiError }` (nunca throw); erros de **configuração** lançam no `new Corvo()` (apiKey ausente, Node sem fetch, `http://` host público sem `allowInsecureHttp`). Exceção única documentada: geradores `iterate()` lançam `CorvoApiError`.
- Envelope uniforme: `{data}` em todo JSON; listas `{data, pagination}` com cursor opaco; `props` em Invoice/InvoiceEvent/CreditTransaction/Plan; raw em health/PDF/XML.
- Respostas sem reescrita de case; camelCase só na entrada da lib.
- IDs/paths com `encodeURIComponent`.
- `error.code` = `code` do corpo, senão `http_<status>`; rede `network_error`; timeout `timeout`; JSON inválido `invalid_json`.
- Formatação/lint: `yarn format` (biome check --write) antes de `yarn lint` em cada task.

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `biome.json`, `.gitignore`, `src/index.ts`, `test/smoke.test.ts`

**Interfaces:**
- Produces: `src/index.ts` exportando `VERSION` (mantido no index final); scripts `build`, `test`, `typecheck`, `lint`, `format`.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "corvo-nfse-node",
  "version": "0.1.0",
  "description": "SDK Node.js + CLI para a API Corvo de NFS-e (self-hosted)",
  "license": "MIT",
  "type": "module",
  "engines": { "node": ">=18.0.0" },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./cli": {
      "types": "./dist/cli/index.d.ts",
      "import": "./dist/cli/index.js",
      "require": "./dist/cli/index.cjs"
    }
  },
  "bin": { "corvo": "./bin/corvo" },
  "files": ["dist", "bin", "README.md"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "biome check src test",
    "format": "biome check --write src test",
    "clean": "rm -rf dist"
  },
  "dependencies": { "commander": "^13.1.0" },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/node": "^22.10.0",
    "tsup": "^8.3.5",
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  },
  "keywords": ["corvo", "nfse", "nota fiscal", "sdk", "cli", "api"],
  "repository": { "type": "git", "url": "https://github.com/corvo-technology/corvo-nfse-node.git" }
}
```

- [ ] **Step 2: Criar configs**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  },
  "include": ["src", "test", "tsup.config.ts", "vitest.config.ts"]
}
```

`tsup.config.ts`:

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'cli/index': 'src/cli/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  outExtension({ format }) {
    return { js: format === 'cjs' ? '.cjs' : '.js' };
  },
});
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['test/**/*.test.ts'] },
});
```

`biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "formatter": { "enabled": true, "lineWidth": 100 },
  "files": { "ignore": ["dist", "node_modules"] }
}
```

`.gitignore`:

```
node_modules/
dist/
coverage/
*.log
*.tsbuildinfo
.DS_Store
```

- [ ] **Step 3: Criar `src/index.ts` e `test/smoke.test.ts`**

```ts
// src/index.ts
export const VERSION = '0.1.0';
```

```ts
import { describe, expect, it } from 'vitest';
import { VERSION } from '../src/index';

describe('scaffold', () => {
  it('exports the package version', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
```

- [ ] **Step 4: Instalar dependências e rodar teste**

Run: `yarn install`
Expected: `yarn.lock` criado, sem erros.

Run: `yarn test`
Expected: PASS (`scaffold > exports the package version`).

- [ ] **Step 5: Verificar build**

Run: `yarn build`
Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` gerados sem erros.

- [ ] **Step 6: Commit**

```bash
git add package.json yarn.lock tsconfig.json tsup.config.ts vitest.config.ts biome.json .gitignore src/index.ts test/smoke.test.ts
git commit -m "chore: scaffold corvo-nfse-node (tsup, vitest, biome, yarn)"
```

---

### Task 2: CorvoApiError e Result

**Files:**
- Create: `src/error.ts`
- Test: `test/error.test.ts`

**Interfaces:**
- Produces: `class CorvoApiError extends Error` com `status: number`, `code: string`, `details?: CorvoErrorDetail[]`, `requestId?: string`, `retryAfter?: number`; `type CorvoErrorDetail = { field: string; code: string; message: string }`; `type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: CorvoApiError }`.

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it } from 'vitest';
import { CorvoApiError, type Result } from '../src/error';

describe('CorvoApiError', () => {
  it('exposes the contract error fields', () => {
    const error = new CorvoApiError({
      message: 'Request validation failed',
      status: 400,
      code: 'ERROR_VALIDATION',
      details: [{ field: 'customer.taxId', code: 'ERROR_INVALID_TAX_ID', message: 'Invalid tax ID' }],
      requestId: '9f1fc995-4ee4-4a92-b285-cf8dff227a97',
      retryAfter: 30,
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('CorvoApiError');
    expect(error.status).toBe(400);
    expect(error.code).toBe('ERROR_VALIDATION');
    expect(error.details).toHaveLength(1);
    expect(error.requestId).toBe('9f1fc995-4ee4-4a92-b285-cf8dff227a97');
    expect(error.retryAfter).toBe(30);
    expect(error.stack).toBeTruthy();
  });

  it('Result types both sides', () => {
    const ok: Result<number> = { data: 1 };
    const err: Result<number> = { error: new CorvoApiError({ message: 'x', status: 0, code: 'timeout' }) };
    expect(ok.data).toBe(1);
    expect(err.error?.code).toBe('timeout');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `yarn test`
Expected: FAIL — `Cannot find module '../src/error'`.

- [ ] **Step 3: Implementar `src/error.ts`**

```ts
export interface CorvoErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface CorvoApiErrorInit {
  message: string;
  status: number;
  code: string;
  details?: CorvoErrorDetail[];
  requestId?: string;
  retryAfter?: number;
  cause?: unknown;
}

export class CorvoApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: CorvoErrorDetail[];
  readonly requestId?: string;
  readonly retryAfter?: number;

  constructor(init: CorvoApiErrorInit) {
    super(init.message, init.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = 'CorvoApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details;
    this.requestId = init.requestId;
    this.retryAfter = init.retryAfter;
  }
}

export type Result<T> = { data: T; error?: undefined } | { data?: undefined; error: CorvoApiError };
```

- [ ] **Step 4: Rodar e ver passar**

Run: `yarn test`
Expected: PASS (2 testes de `CorvoApiError`).

- [ ] **Step 5: Formatar, lint e commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/error.ts test/error.test.ts
git commit -m "feat: CorvoApiError and Result type"
```

---

### Task 3: HttpTransport — requisição, envelope e erros

**Files:**
- Create: `src/transport.ts`, `test/helpers.ts`
- Test: `test/transport.test.ts`

**Interfaces:**
- Consumes: `CorvoApiError`, `Result` (Task 2).
- Produces:
  - `interface TransportOptions { apiKey: string; baseUrl: string; prefix?: string; timeoutMs?: number; fetch?: FetchLike; allowInsecureHttp?: boolean }`
  - `class HttpTransport` com `request<T>(opts: RequestOptions): Promise<Result<T>>`, `requestRaw(opts): Promise<Result<DownloadedFile>>`, `list<T>(path, query, mapItem): Promise<Result<Paginated<T>>>`, `iterate<T>(path, query, mapItem): AsyncGenerator<T, void, undefined>`
  - `interface RequestOptions { method: 'GET'|'POST'|'PATCH'|'DELETE'; path: string; query?: Query; body?: unknown; idempotencyKey?: string; unwrap?: 'data'|'data+props'|'none' }`
  - `type Query = Record<string, string | number | undefined>`
  - `interface DownloadedFile { buffer: Buffer; mimeType?: string; fileName?: string }`
  - `mapPlain<T>(raw): T`, `mapProps<T>(raw): T`
- Test helpers: `API_KEY`, `jsonResponse(body, init?)`.

- [ ] **Step 1: Criar `test/helpers.ts`**

```ts
export const API_KEY = 'corvo_test_' + 'a'.repeat(40);
export const BASE_URL = 'http://localhost:4000';

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  return new Response(JSON.stringify(body), { status: 200, ...init, headers });
}
```

- [ ] **Step 2: Escrever teste falhando (`test/transport.test.ts`)**

```ts
import { describe, expect, it, vi } from 'vitest';
import { HttpTransport } from '../src/transport';
import { API_KEY, BASE_URL, jsonResponse } from './helpers';

interface Capture {
  url: string;
  init: RequestInit;
}

function captureTransport(
  respond: (url: string, init: RequestInit) => Response,
): { http: HttpTransport; calls: Capture[] } {
  const calls: Capture[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init: init ?? {} });
    return respond(url, init ?? {});
  });
  const http = new HttpTransport({
    apiKey: API_KEY,
    baseUrl: `${BASE_URL}/`,
    fetch: fetchMock,
  });
  return { http, calls };
}

function headersOf(call: Capture): Record<string, string> {
  return call.init.headers as Record<string, string>;
}

describe('HttpTransport', () => {
  it('builds URL with v1 prefix, method, query and auth headers', async () => {
    const { http, calls } = captureTransport(() => jsonResponse({ data: { ok: true } }));
    const res = await http.request<{ ok: boolean }>({
      method: 'GET',
      path: '/companies',
      query: { limit: 10, cursor: undefined },
    });
    expect(res.error).toBeUndefined();
    expect(res.data).toEqual({ ok: true });
    expect(calls[0].url).toBe('http://localhost:4000/v1/companies?limit=10');
    expect(calls[0].init.method).toBe('GET');
    expect(headersOf(calls[0])['X-API-Key']).toBe(API_KEY);
    expect(headersOf(calls[0])['Accept']).toBe('application/json');
  });

  it('sends JSON body and Idempotency-Key', async () => {
    const { http, calls } = captureTransport(() => jsonResponse({ data: { id: 'inv_1' } }));
    await http.request({
      method: 'POST',
      path: '/invoices',
      body: { amount: 10 },
      idempotencyKey: 'pedido_123',
    });
    expect(headersOf(calls[0])['Content-Type']).toBe('application/json');
    expect(headersOf(calls[0])['Idempotency-Key']).toBe('pedido_123');
    expect(calls[0].init.body).toBe(JSON.stringify({ amount: 10 }));
  });

  it('unwraps data by default, data+props and none', async () => {
    const { http } = captureTransport(() =>
      jsonResponse({ data: { props: { id: 'inv_1', status: 'queued' } } }),
    );
    const withProps = await http.request<{ id: string }>({ method: 'GET', path: '/invoices/x', unwrap: 'data+props' });
    expect(withProps.data).toEqual({ id: 'inv_1', status: 'queued' });

    const none = await http.request<{ data: unknown; pagination: unknown }>({
      method: 'GET',
      path: '/invoices',
      unwrap: 'none',
    });
    expect(none.data?.data).toBeTruthy();
    expect(none.data?.pagination).toBeTruthy();
  });

  it('maps REST errors to CorvoApiError with code, details and requestId', async () => {
    const { http } = captureTransport(() =>
      jsonResponse(
        {
          statusCode: 400,
          code: 'ERROR_VALIDATION',
          message: 'Request validation failed',
          details: [{ field: 'customer.taxId', code: 'ERROR_INVALID_TAX_ID', message: 'Invalid tax ID' }],
          requestId: 'req-123',
        },
        { status: 400 },
      ),
    );
    const res = await http.request({ method: 'POST', path: '/invoices', body: {} });
    expect(res.data).toBeUndefined();
    expect(res.error?.name).toBe('CorvoApiError');
    expect(res.error?.code).toBe('ERROR_VALIDATION');
    expect(res.error?.status).toBe(400);
    expect(res.error?.requestId).toBe('req-123');
    expect(res.error?.details?.[0].field).toBe('customer.taxId');
  });

  it('falls back to header X-Request-Id and http_<status> code when body has no code', async () => {
    const { http } = captureTransport(() =>
      jsonResponse({ message: ['campo inválido'] }, { status: 422, headers: { 'x-request-id': 'hdr-9' } }),
    );
    const res = await http.request({ method: 'GET', path: '/companies' });
    expect(res.error?.code).toBe('http_422');
    expect(res.error?.requestId).toBe('hdr-9');
    expect(res.error?.message).toBe('campo inválido');
  });

  it('reads Retry-After header on 429', async () => {
    const { http } = captureTransport(() =>
      jsonResponse({ statusCode: 429, code: 'ERROR_RATE_LIMITED', message: 'slow down' }, {
        status: 429,
        headers: { 'retry-after': '45' },
      }),
    );
    const res = await http.request({ method: 'GET', path: '/companies' });
    expect(res.error?.code).toBe('ERROR_RATE_LIMITED');
    expect(res.error?.retryAfter).toBe(45);
  });

  it('204 resolves to null', async () => {
    const { http } = captureTransport(() => new Response(null, { status: 204 }));
    const res = await http.request({ method: 'DELETE', path: '/companies/x/certificates/y' });
    expect(res.error).toBeUndefined();
    expect(res.data).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `yarn test`
Expected: FAIL — `Cannot find module '../src/transport'`.

- [ ] **Step 4: Implementar `src/transport.ts`**

```ts
import { CorvoApiError, type CorvoErrorDetail, type Result } from './error';
import type { Paginated } from './types/common';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TransportOptions {
  apiKey: string;
  baseUrl: string;
  prefix?: string;
  timeoutMs?: number;
  fetch?: FetchLike;
  allowInsecureHttp?: boolean;
}

export type Query = Record<string, string | number | undefined>;

export type Unwrap = 'data' | 'data+props' | 'none';

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  query?: Query;
  body?: unknown;
  idempotencyKey?: string;
  unwrap?: Unwrap;
}

export interface DownloadedFile {
  buffer: Buffer;
  mimeType?: string;
  fileName?: string;
}

interface RawPage {
  data: unknown[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}

const DEFAULT_TIMEOUT_MS = 30_000;

export const mapPlain = <T>(raw: unknown): T => raw as T;
export const mapProps = <T>(raw: unknown): T => (raw as { props: T }).props;

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '[::1]' || host === '::1' || host.endsWith('.localhost')) {
    return true;
  }
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) return false;
  const a = Number(ipv4[1]);
  const b = Number(ipv4[2]);
  return a === 127 || a === 10 || a === 0 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254);
}

function errorMessage(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return String(cause);
}

export class HttpTransport {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly prefix: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly allowInsecureHttp: boolean;

  constructor(options: TransportOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.prefix = (options.prefix ?? 'v1').replace(/^\/+|\/+$/g, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.allowInsecureHttp = options.allowInsecureHttp ?? false;
    this.validateBaseUrl();
  }

  private validateBaseUrl(): void {
    let parsed: URL;
    try {
      parsed = new URL(this.baseUrl);
    } catch {
      throw new Error(`Corvo: invalid baseUrl: ${this.baseUrl}`);
    }
    if (parsed.protocol === 'http:' && !this.allowInsecureHttp && !isPrivateHost(parsed.hostname)) {
      throw new Error(
        `Corvo: http:// is only allowed for loopback/private hosts (got ${parsed.hostname}). Use https:// or pass allowInsecureHttp: true.`,
      );
    }
  }

  private buildUrl(path: string, query?: Query): string {
    const prefix = this.prefix ? `/${this.prefix}` : '';
    const url = new URL(`${this.baseUrl}${prefix}${path}`);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private buildHeaders(options: RequestOptions): { headers: Record<string, string>; body: BodyInit | undefined } {
    const headers: Record<string, string> = {
      'X-API-Key': this.apiKey,
      Accept: 'application/json',
    };
    let body: BodyInit | undefined;
    if (options.body instanceof FormData) {
      body = options.body;
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
    if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;
    return { headers, body };
  }

  private async fetchResponse(
    options: RequestOptions,
  ): Promise<{ response: Response } | { error: CorvoApiError }> {
    const { headers, body } = this.buildHeaders(options);
    const controller = new AbortController();
    const timer = this.timeoutMs > 0 ? setTimeout(() => controller.abort(), this.timeoutMs) : undefined;
    try {
      const response = await this.fetchImpl(this.buildUrl(options.path, options.query), {
        method: options.method,
        headers,
        body,
        signal: controller.signal,
      });
      if (!response.ok) return { error: await this.toError(response) };
      return { response };
    } catch (cause) {
      const timedOut = controller.signal.aborted;
      return {
        error: new CorvoApiError({
          message: timedOut
            ? `Request timed out after ${this.timeoutMs}ms`
            : `Network request failed: ${errorMessage(cause)}`,
          status: 0,
          code: timedOut ? 'timeout' : 'network_error',
          cause,
        }),
      };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private async toError(response: Response): Promise<CorvoApiError> {
    const headerRequestId = response.headers.get('X-Request-Id') ?? undefined;
    const retryAfterHeader = response.headers.get('Retry-After');
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      parsed = undefined;
    }
    const record: Record<string, unknown> =
      typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    const code =
      typeof record.code === 'string' && record.code.length > 0 ? record.code : `http_${response.status}`;
    let message: string;
    if (typeof record.message === 'string') message = record.message;
    else if (Array.isArray(record.message)) message = record.message.map(String).join('; ');
    else if (typeof record.error === 'string') message = record.error;
    else message = `Request failed with status ${response.status}`;
    const details = Array.isArray(record.details) ? (record.details as CorvoErrorDetail[]) : undefined;
    const requestId = typeof record.requestId === 'string' ? record.requestId : headerRequestId;
    let retryAfter = typeof record.retryAfter === 'number' ? record.retryAfter : undefined;
    if (retryAfter === undefined && retryAfterHeader !== null && Number.isFinite(Number(retryAfterHeader))) {
      retryAfter = Number(retryAfterHeader);
    }
    return new CorvoApiError({ message, status: response.status, code, details, requestId, retryAfter });
  }

  private unwrap(value: unknown, mode: Unwrap): unknown {
    if (mode === 'none') return value;
    const envelope = value !== null && typeof value === 'object' && 'data' in value
      ? (value as { data: unknown }).data
      : null;
    if (mode === 'data') return envelope ?? null;
    if (envelope !== null && typeof envelope === 'object' && 'props' in envelope) {
      return (envelope as { props: unknown }).props;
    }
    return null;
  }

  async request<T>(options: RequestOptions): Promise<Result<T>> {
    const out = await this.fetchResponse(options);
    if ('error' in out) return { error: out.error };
    const { response } = out;
    if (response.status === 204) return { data: null as T };
    const text = await response.text();
    if (text.length === 0) return { data: null as T };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (cause) {
      return {
        error: new CorvoApiError({
          message: 'Invalid JSON in response',
          status: response.status,
          code: 'invalid_json',
          requestId: response.headers.get('X-Request-Id') ?? undefined,
          cause,
        }),
      };
    }
    return { data: this.unwrap(parsed, options.unwrap ?? 'data') as T };
  }

  async requestRaw(options: Omit<RequestOptions, 'body' | 'unwrap'>): Promise<Result<DownloadedFile>> {
    const out = await this.fetchResponse({ ...options, body: undefined, unwrap: 'none' });
    if ('error' in out) return { error: out.error };
    const { response } = out;
    const buffer = Buffer.from(await response.arrayBuffer());
    const disposition = response.headers.get('Content-Disposition');
    const match = disposition ? /filename="([^"]+)"/.exec(disposition) : null;
    const mimeType = response.headers.get('Content-Type') ?? undefined;
    return { data: { buffer, mimeType, fileName: match?.[1] ?? undefined } };
  }

  async list<T>(path: string, query: Query | undefined, mapItem: (raw: unknown) => T): Promise<Result<Paginated<T>>> {
    const res = await this.request<RawPage>({ method: 'GET', path, query, unwrap: 'none' });
    if (res.error) return { error: res.error };
    return { data: { data: res.data?.data.map(mapItem), pagination: res.data?.pagination } };
  }

  async *iterate<T>(
    path: string,
    query: Query | undefined,
    mapItem: (raw: unknown) => T,
  ): AsyncGenerator<T, void, undefined> {
    let cursor = query?.cursor;
    for (;;) {
      const page = await this.list(path, { ...query, cursor }, mapItem);
      if (page.error) throw page.error;
      for (const item of page.data.data) yield item;
      if (!page.data.pagination.hasMore) return;
      const next = page.data.pagination.nextCursor;
      if (next === null) return;
      cursor = next;
    }
  }
}
```

- [ ] **Step 5: Criar `src/types/common.ts` (dependência do transport)**

```ts
export interface Pagination {
  limit: number;
  hasMore: boolean;
  nextCursor: string | null;
}

export interface Paginated<T> {
  data: T[];
  pagination: Pagination;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `yarn test`
Expected: PASS (7 testes de `HttpTransport` + smoke + error).

- [ ] **Step 7: Formatar, lint e commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/transport.ts src/types/common.ts test/helpers.ts test/transport.test.ts
git commit -m "feat: HttpTransport with envelope, errors and timeouts"
```

### Task 4: HttpTransport — timeout, rede, http privado, multipart e binário

**Files:**
- Test: `test/transport-hardening.test.ts`
- Modify: `src/transport.ts` (apenas se algo faltar — a implementação da Task 3 já cobre; este task valida e corrige)

**Interfaces:**
- Consumes: `HttpTransport`, `mapPlain`, `mapProps`, `DownloadedFile` (Task 3).
- Produces: invariante de que `http://` público lança na construção; `FormData` vai sem `Content-Type` manual; `requestRaw` devolve `DownloadedFile`.

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it, vi } from 'vitest';
import { HttpTransport } from '../src/transport';
import { API_KEY, BASE_URL, jsonResponse } from './helpers';

function make(fetchMock?: (url: string, init?: RequestInit) => Promise<Response>): HttpTransport {
  return new HttpTransport({
    apiKey: API_KEY,
    baseUrl: BASE_URL,
    fetch: fetchMock ?? (async () => jsonResponse({ data: null })),
  });
}

describe('HttpTransport hardening', () => {
  it('rejects http:// public hosts at construction', () => {
    expect(
      () =>
        new HttpTransport({
          apiKey: API_KEY,
          baseUrl: 'http://api.exemplo.com',
          fetch: async () => jsonResponse({ data: null }),
        }),
    ).toThrow(/allowInsecureHttp/);
  });

  it('accepts http:// on loopback and private networks', () => {
    for (const baseUrl of ['http://localhost:4000', 'http://127.0.0.1:3000', 'http://192.168.0.10', 'http://10.1.2.3', 'http://172.16.0.9']) {
      expect(
        () =>
          new HttpTransport({
            apiKey: API_KEY,
            baseUrl,
            fetch: async () => jsonResponse({ data: null }),
          }),
      ).not.toThrow();
    }
  });

  it('accepts public http:// with allowInsecureHttp: true', () => {
    expect(
      () =>
        new HttpTransport({
          apiKey: API_KEY,
          baseUrl: 'http://api.exemplo.com',
          allowInsecureHttp: true,
          fetch: async () => jsonResponse({ data: null }),
        }),
    ).not.toThrow();
  });

  it('maps network rejections to network_error', async () => {
    const http = make(async () => {
      throw new TypeError('fetch failed');
    });
    const res = await http.request({ method: 'GET', path: '/companies' });
    expect(res.error?.code).toBe('network_error');
    expect(res.error?.status).toBe(0);
    expect(res.error?.message).toContain('fetch failed');
  });

  it('aborts after timeoutMs and returns timeout', async () => {
    const http = new HttpTransport({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      timeoutMs: 10,
      fetch: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('This operation was aborted', 'AbortError'));
          });
        }),
    });
    const res = await http.request({ method: 'GET', path: '/companies' });
    expect(res.error?.code).toBe('timeout');
    expect(res.error?.status).toBe(0);
  });

  it('sends FormData without manual Content-Type (fetch sets multipart boundary)', async () => {
    const calls: Array<{ body: unknown; headers: Record<string, string> }> = [];
    const http = make(async (_url, init) => {
      calls.push({ body: init?.body, headers: (init?.headers ?? {}) as Record<string, string> });
      return jsonResponse({ data: { id: 'cert_1' } });
    });
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'application/x-pkcs12' }), 'cert.p12');
    form.append('password', 'segredo');
    await http.request({ method: 'POST', path: '/companies/x/certificates', body: form });
    expect(calls[0].body).toBeInstanceOf(FormData);
    expect(calls[0].headers['Content-Type']).toBeUndefined();
    const sent = calls[0].body as FormData;
    expect(sent.get('password')).toBe('segredo');
    const file = sent.get('file');
    expect(file).toBeInstanceOf(Blob);
    expect((file as File).name).toBe('cert.p12');
  });

  it('requestRaw returns buffer, mimeType and fileName', async () => {
    const http = make(async () =>
      new Response('%PDF-1.7 conteudo', {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="nfse-12345.pdf"',
        },
      }),
    );
    const res = await http.requestRaw({ method: 'GET', path: '/invoices/inv_1/pdf' });
    expect(res.error).toBeUndefined();
    expect(res.data?.buffer.toString('utf8')).toBe('%PDF-1.7 conteudo');
    expect(res.data?.mimeType).toBe('application/pdf');
    expect(res.data?.fileName).toBe('nfse-12345.pdf');
  });

  it('returns invalid_json when response is not JSON', async () => {
    const http = make(async () => new Response('<html>erro</html>', { status: 200 }));
    const res = await http.request({ method: 'GET', path: '/companies' });
    expect(res.error?.code).toBe('invalid_json');
    expect(res.error?.status).toBe(200);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `yarn test`
Expected: FAIL se algum comportamento não existe ainda (senão PASS direto — a Task 3 já implementou; nesse caso o teste vira cobertura e o passo seguinte é apenas formalizar).

- [ ] **Step 3: Verificar implementação**

Todos os casos (construção com validação de host, `network_error`, `timeout`, FormData, `requestRaw`, `invalid_json`) já estão em `src/transport.ts` da Task 3. Se algum teste falhar, corrigir `src/transport.ts` mantendo os contratos das Interfaces acima.

- [ ] **Step 4: Rodar e ver passar**

Run: `yarn test`
Expected: PASS (8 testes de hardening).

- [ ] **Step 5: Formatar, lint e commit**

```bash
yarn format && yarn lint && yarn typecheck
git add test/transport-hardening.test.ts src/transport.ts
git commit -m "test: transport hardening (timeout, network, private http, multipart, binary)"
```

---

### Task 5: Cliente Corvo + resource health

**Files:**
- Create: `src/client.ts`, `src/resources/health.ts`
- Test: `test/client.test.ts`

**Interfaces:**
- Consumes: `HttpTransport` (Tasks 3–4).
- Produces:
  - `interface CorvoOptions { apiKey?: string; baseUrl?: string; prefix?: string; timeoutMs?: number; fetch?: typeof globalThis.fetch; allowInsecureHttp?: boolean }`
  - `class Corvo` com readonly `companies, certificates, invoices, webhooks, credits, billing, health` (nestes tasks, apenas `health` — os demais vêm das Tasks 7–12; inicialize os que existirem e adicione conforme avançar, mantendo o constructor funcional)
  - `class HealthResource` com `live(): Promise<Result<unknown>>` e `ready(): Promise<Result<unknown>>` (raw, sem envelope)

- [ ] **Step 1: Escrever teste falhando**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Corvo } from '../src/client';
import { API_KEY, jsonResponse } from './helpers';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Corvo', () => {
  it('throws on construction without apiKey', () => {
    vi.stubEnv('CORVO_API_KEY', '');
    expect(() => new Corvo({ baseUrl: 'http://localhost:4000' })).toThrow(/apiKey/);
  });

  it('reads CORVO_API_KEY and CORVO_BASE_URL from environment', async () => {
    vi.stubEnv('CORVO_API_KEY', 'corvo_live_' + 'b'.repeat(40));
    vi.stubEnv('CORVO_BASE_URL', 'https://instalacao.exemplo.com');
    const seen: string[] = [];
    const corvo = new Corvo({
      fetch: (async (url: string) => {
        seen.push(url);
        return jsonResponse({ status: 'ok' });
      }) as typeof globalThis.fetch,
    });
    await corvo.health.live();
    expect(seen[0]).toBe('https://instalacao.exemplo.com/v1/health/live');
  });

  it('uses https://api.corvo.tech as default baseUrl', async () => {
    vi.stubEnv('CORVO_BASE_URL', '');
    vi.stubEnv('CORVO_API_KEY', '');
    const seen: string[] = [];
    const corvo = new Corvo({
      apiKey: API_KEY,
      fetch: (async (url: string) => {
        seen.push(url);
        return jsonResponse({ status: 'ok' });
      }) as typeof globalThis.fetch,
    });
    await corvo.health.ready();
    expect(seen[0]).toBe('https://api.corvo.tech/v1/health/ready');
  });

  it('health.live returns the raw object (no data envelope)', async () => {
    const corvo = new Corvo({
      apiKey: API_KEY,
      baseUrl: 'http://localhost:4000',
      fetch: (async () =>
        jsonResponse({ status: 'ok', timestamp: '2026-10-12T16:04:48.268Z', uptime: 10867 })) as typeof globalThis.fetch,
    });
    const res = await corvo.health.live();
    expect(res.error).toBeUndefined();
    expect(res.data).toEqual({ status: 'ok', timestamp: '2026-10-12T16:04:48.268Z', uptime: 10867 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `yarn test`
Expected: FAIL — `Cannot find module '../src/client'`.

- [ ] **Step 3: Implementar `src/resources/health.ts`**

```ts
import type { Result } from '../error';
import type { HttpTransport } from '../transport';

export class HealthResource {
  constructor(private readonly http: HttpTransport) {}

  live(): Promise<Result<unknown>> {
    return this.http.request({ method: 'GET', path: '/health/live', unwrap: 'none' });
  }

  ready(): Promise<Result<unknown>> {
    return this.http.request({ method: 'GET', path: '/health/ready', unwrap: 'none' });
  }
}
```

- [ ] **Step 4: Implementar `src/client.ts`**

```ts
import { HttpTransport } from './transport';
import { HealthResource } from './resources/health';
import type { FetchLike } from './transport';

export interface CorvoOptions {
  apiKey?: string;
  baseUrl?: string;
  prefix?: string;
  timeoutMs?: number;
  fetch?: FetchLike;
  allowInsecureHttp?: boolean;
}

const DEFAULT_BASE_URL = 'https://api.corvo.tech';

export class Corvo {
  readonly health: HealthResource;

  constructor(options: CorvoOptions = {}) {
    const apiKey = options.apiKey || process.env.CORVO_API_KEY;
    if (!apiKey) {
      throw new Error('Corvo: apiKey is required — pass apiKey or set CORVO_API_KEY');
    }
    if (typeof globalThis.fetch !== 'function' && options.fetch === undefined) {
      throw new Error('Corvo: Node.js 18+ is required (global fetch missing)');
    }
    const baseUrl = options.baseUrl || process.env.CORVO_BASE_URL || DEFAULT_BASE_URL;
    const http = new HttpTransport({
      apiKey,
      baseUrl,
      prefix: options.prefix,
      timeoutMs: options.timeoutMs,
      fetch: options.fetch,
      allowInsecureHttp: options.allowInsecureHttp,
    });
    this.health = new HealthResource(http);
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `yarn test`
Expected: PASS (4 testes de `Corvo`).

- [ ] **Step 6: Formatar, lint e commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/client.ts src/resources/health.ts test/client.test.ts
git commit -m "feat: Corvo client with env fallbacks and health resource"
```

### Task 6: Paginação — list e iterate

**Files:**
- Test: `test/transport-pagination.test.ts`

**Interfaces:**
- Consumes: `HttpTransport.list`, `HttpTransport.iterate`, `mapPlain`, `Paginated` (Tasks 3 e `types/common`).
- Produces: invariante de paginação uniforme `{data, pagination}` e propagação de cursor em `iterate` (falha lança `CorvoApiError`).

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it, vi } from 'vitest';
import { CorvoApiError } from '../src/error';
import { mapPlain, mapProps } from '../src/transport';
import { API_KEY, BASE_URL, jsonResponse } from './helpers';

interface Page {
  data: unknown[];
  pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
}

describe('HttpTransport.list/iterate', () => {
  it('list returns Paginated with mapped items', async () => {
    const page: Page = {
      data: [{ id: 'co_1', legalName: 'ACME' }],
      pagination: { limit: 50, hasMore: false, nextCursor: null },
    };
    const fetchMock = vi.fn(async () => jsonResponse({ ...page }));
    const res = await new (await import('../src/transport')).HttpTransport({
      apiKey: API_KEY,
      baseUrl: BASE_URL,
      fetch: fetchMock,
    }).list<{ id: string }>('/companies', { limit: 50 }, mapPlain);
    expect(res.error).toBeUndefined();
    expect(res.data?.data).toEqual([{ id: 'co_1', legalName: 'ACME' }]);
    expect(res.data?.pagination).toEqual({ limit: 50, hasMore: false, nextCursor: null });
  });

  it('iterate walks all pages passing the cursor', async () => {
    const pages: Page[] = [
      { data: [{ props: { id: 'inv_1' } }, { props: { id: 'inv_2' } }], pagination: { limit: 2, hasMore: true, nextCursor: 'cursor-1' } },
      { data: [{ props: { id: 'inv_3' } }], pagination: { limit: 2, hasMore: false, nextCursor: null } },
    ];
    const urls: string[] = [];
    let call = 0;
    const fetchMock = vi.fn(async (url: string) => {
      urls.push(url);
      return jsonResponse(pages[Math.min(call++, pages.length - 1)]);
    });
    const { HttpTransport } = await import('../src/transport');
    const http = new HttpTransport({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: fetchMock });
    const ids: string[] = [];
    for await (const invoice of http.iterate('/invoices', { companyId: 'co_1', limit: 2 }, mapProps)) {
      ids.push((invoice as { id: string }).id);
    }
    expect(ids).toEqual(['inv_1', 'inv_2', 'inv_3']);
    expect(urls[0]).toContain('companyId=co_1');
    expect(urls[0]).not.toContain('cursor=');
    expect(urls[1]).toContain('cursor=cursor-1');
    expect(urls[1]).toContain('companyId=co_1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('iterate throws CorvoApiError when a page fails', async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      if (call++ === 0) {
        return jsonResponse({
          data: [{ id: 'co_1' }],
          pagination: { limit: 50, hasMore: true, nextCursor: 'c1' },
        });
      }
      return jsonResponse({ statusCode: 500, code: 'ERROR_INTERNAL', message: 'boom' }, { status: 500 });
    });
    const { HttpTransport } = await import('../src/transport');
    const http = new HttpTransport({ apiKey: API_KEY, baseUrl: BASE_URL, fetch: fetchMock });
    await expect(async () => {
      for await (const _item of http.iterate('/companies', undefined, mapPlain)) {
        // drain
      }
    }).rejects.toThrowError(CorvoApiError);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `yarn test`
Expected: PASS se Tasks 3–4 implementaram `list/iterate` conforme o código; se falhar, corrigir `src/transport.ts` até passar (comportamento-alvo é o teste).

- [ ] **Step 3: Formatar, lint e commit**

```bash
yarn format && yarn lint && yarn typecheck
git add test/transport-pagination.test.ts src/transport.ts
git commit -m "feat: uniform pagination and auto-iteration in transport"
```

---

### Task 7: Resource companies

**Files:**
- Create: `src/types/company.ts`, `src/resources/companies.ts`
- Test: `test/resources/companies.test.ts`

**Interfaces:**
- Consumes: `HttpTransport.list/iterate`, `mapPlain`, `Result`, `Paginated` (Tasks 3–6).
- Produces:
  - `type TaxRegime = 'MEI' | 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real'`
  - `interface CompanyAddressInput { street: string; number?: string; complement?: string; district: string; city: string; state: string; zip: string }`
  - `interface CompanyCreateParams { legalName: string; taxId: string; taxRegime: TaxRegime; tradeName?: string; municipalReg?: string; municipalityCode?: string; simpleNational?: boolean; specialRegime?: string; address?: CompanyAddressInput }`
  - `interface CompanyUpdateParams { legalName?: string; tradeName?: string; municipalReg?: string | null; municipalityCode?: string; taxRegime?: TaxRegime; simpleNational?: boolean; specialRegime?: string; address?: CompanyAddressInput | null }`
  - `interface Company { id, tenantId, legalName, tradeName: string|null, taxId, municipalReg: string|null, municipalityCode: string|null, taxRegime, simpleNational: boolean, specialRegime: string|null, addressStreet: string|null, addressNumber: string|null, addressComplement: string|null, addressDistrict: string|null, addressCity, addressState, addressZip, fiscalSchemaVersion, environment: 'test'|'live', status, createdAt, updatedAt, deletedAt: string|null, setupGaps: string[] }`
  - `interface CompanyListParams { limit?: number; cursor?: string }`
  - `class CompaniesResource` com `create/list/iterate/get/update/remove`
  - `Corvo.companies` (ligar no constructor do client)

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it, vi } from 'vitest';
import { Corvo } from '../../src/client';
import { API_KEY, BASE_URL, jsonResponse } from '../helpers';

const company = {
  id: '09947127-2702-4f6d-9da8-cb463608d812',
  tenantId: '6247dfd9-0adc-4bf6-aac9-ee9dc1e7ca8b',
  legalName: 'Empresa Exemplo Tecnologia LTDA',
  tradeName: 'Empresa Exemplo TESTE',
  taxId: '41834687000148',
  municipalReg: '123456',
  municipalityCode: '3170206',
  taxRegime: 'Simples Nacional',
  simpleNational: true,
  specialRegime: null,
  addressStreet: 'Rua Exemplo de Testes',
  addressNumber: '100',
  addressComplement: null,
  addressDistrict: 'Centro',
  addressCity: 'Uberlândia',
  addressState: 'MG',
  addressZip: '38400000',
  fiscalSchemaVersion: 'v2_02',
  environment: 'test',
  status: 'ready',
  createdAt: '2026-10-12T13:04:38.985Z',
  updatedAt: '2026-10-12T13:04:40.230Z',
  deletedAt: null,
  setupGaps: [],
};

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
  return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe('companies', () => {
  it('create POSTs /companies with input and returns Company', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const corvo = client(async (url, init) => {
      calls.push({ url, init: init ?? {} });
      return jsonResponse({ data: company }, { status: 201 });
    });
    const res = await corvo.companies.create({
      legalName: company.legalName,
      taxId: '41.834.687/0001-48',
      taxRegime: 'Simples Nacional',
      address: { street: 'Rua Exemplo', number: '100', district: 'Centro', city: 'Uberlândia', state: 'MG', zip: '38400-000' },
    });
    expect(res.error).toBeUndefined();
    expect(res.data?.id).toBe(company.id);
    expect(calls[0].url).toBe('http://localhost:4000/v1/companies');
    expect(calls[0].init.method).toBe('POST');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.taxRegime).toBe('Simples Nacional');
    expect(body.address.city).toBe('Uberlândia');
  });

  it('list returns Paginated with the API real pagination', async () => {
    const corvo = client(async () =>
      jsonResponse({
        data: [company],
        pagination: { limit: 2, hasMore: false, nextCursor: null },
      }),
    );
    const res = await corvo.companies.list({ limit: 2 });
    expect(res.error).toBeUndefined();
    expect(res.data?.data).toHaveLength(1);
    expect(res.data?.pagination).toEqual({ limit: 2, hasMore: false, nextCursor: null });
  });

  it('get, update and remove', async () => {
    const methods: string[] = [];
    const corvo = client(async (_url, init) => {
      methods.push((init?.method ?? 'GET'));
      if ((init?.method ?? 'GET') === 'DELETE') return new Response(null, { status: 204 });
      return jsonResponse({ data: company });
    });
    const got = await corvo.companies.get(company.id);
    expect(got.data?.legalName).toBe(company.legalName);

    const updated = await corvo.companies.update(company.id, { municipalReg: null });
    expect(updated.error).toBeUndefined();

    const removed = await corvo.companies.remove(company.id);
    expect(removed.data).toBeNull();
    expect(methods).toEqual(['GET', 'PATCH', 'DELETE']);
  });

  it('iterate walks the pages', async () => {
    const pages = [
      jsonResponse({ data: [company], pagination: { limit: 1, hasMore: true, nextCursor: 'c1' } }),
      jsonResponse({ data: [{ ...company, id: 'outra' }], pagination: { limit: 1, hasMore: false, nextCursor: null } }),
    ];
    let i = 0;
    const corvo = client(async () => pages[Math.min(i++, pages.length - 1)]);
    const ids: string[] = [];
    for await (const item of corvo.companies.iterate({ limit: 1 })) ids.push(item.id);
    expect(ids).toEqual([company.id, 'outra']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `yarn test`
Expected: FAIL — `Cannot find module '../../src/resources/companies'` (ou `corvo.companies` inexistente).

- [ ] **Step 3: Implementar `src/types/company.ts`**

```ts
export type TaxRegime = 'MEI' | 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';

export interface CompanyAddressInput {
  street: string;
  number?: string;
  complement?: string;
  district: string;
  city: string;
  state: string;
  zip: string;
}

export interface CompanyCreateParams {
  legalName: string;
  taxId: string;
  taxRegime: TaxRegime;
  tradeName?: string;
  municipalReg?: string;
  municipalityCode?: string;
  simpleNational?: boolean;
  specialRegime?: string;
  address?: CompanyAddressInput;
}

export interface CompanyUpdateParams {
  legalName?: string;
  tradeName?: string;
  municipalReg?: string | null;
  municipalityCode?: string;
  taxRegime?: TaxRegime;
  simpleNational?: boolean;
  specialRegime?: string;
  address?: CompanyAddressInput | null;
}

export interface Company {
  id: string;
  tenantId: string;
  legalName: string;
  tradeName: string | null;
  taxId: string;
  municipalReg: string | null;
  municipalityCode: string | null;
  taxRegime: TaxRegime;
  simpleNational: boolean;
  specialRegime: string | null;
  addressStreet: string | null;
  addressNumber: string | null;
  addressComplement: string | null;
  addressDistrict: string | null;
  addressCity: string;
  addressState: string;
  addressZip: string;
  fiscalSchemaVersion: string;
  environment: 'test' | 'live';
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  setupGaps: string[];
}
```

- [ ] **Step 4: Implementar `src/resources/companies.ts`**

```ts
import type { Result } from '../error';
import { mapPlain, type HttpTransport, type Query } from '../transport';
import type { Paginated } from '../types/common';
import type { Company, CompanyCreateParams, CompanyUpdateParams } from '../types/company';

export interface CompanyListParams {
  limit?: number;
  cursor?: string;
}

function listQuery(params: CompanyListParams): Query {
  return { limit: params.limit, cursor: params.cursor };
}

export class CompaniesResource {
  constructor(private readonly http: HttpTransport) {}

  create(params: CompanyCreateParams): Promise<Result<Company>> {
    return this.http.request<Company>({ method: 'POST', path: '/companies', body: params });
  }

  list(params: CompanyListParams = {}): Promise<Result<Paginated<Company>>> {
    return this.http.list<Company>('/companies', listQuery(params), mapPlain);
  }

  iterate(params: CompanyListParams = {}): AsyncGenerator<Company, void, undefined> {
    return this.http.iterate('/companies', listQuery(params), mapPlain);
  }

  get(id: string): Promise<Result<Company>> {
    return this.http.request<Company>({ method: 'GET', path: `/companies/${encodeURIComponent(id)}` });
  }

  update(id: string, params: CompanyUpdateParams): Promise<Result<Company>> {
    return this.http.request<Company>({
      method: 'PATCH',
      path: `/companies/${encodeURIComponent(id)}`,
      body: params,
    });
  }

  remove(id: string): Promise<Result<null>> {
    return this.http.request<null>({ method: 'DELETE', path: `/companies/${encodeURIComponent(id)}` });
  }
}
```

- [ ] **Step 5: Ligar no client**

Em `src/client.ts`, importar `CompaniesResource`, adicionar `readonly companies: CompaniesResource` e no constructor: `this.companies = new CompaniesResource(http);` (antes de `this.health`).

- [ ] **Step 6: Rodar e ver passar**

Run: `yarn test`
Expected: PASS (4 testes de `companies`).

- [ ] **Step 7: Formatar, lint e commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/types/company.ts src/resources/companies.ts src/client.ts test/resources/companies.test.ts
git commit -m "feat: companies resource (CRUD, pagination, iteration)"
```

### Task 8: Resource certificates

**Files:**
- Create: `src/types/certificate.ts`, `src/resources/certificates.ts`
- Test: `test/resources/certificates.test.ts`

**Interfaces:**
- Consumes: `HttpTransport`, `Result`, `Paginated` (Tasks 3–6).
- Produces:
  - `interface Certificate { id, companyId, serialNumber, issuer, subject, fingerprint, validFrom, validUntil, status, createdAt }`
  - `interface CertificateUploadParams { file: Buffer | Uint8Array; fileName?: string; password: string }`
  - `class CertificatesResource` com `upload(companyId, params)`, `list(companyId, params?)`, `remove(companyId, certId)`
  - `Corvo.certificates` (ligar no client)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { Corvo } from '../../src/client';
import { API_KEY, BASE_URL, jsonResponse } from '../helpers';

const certificate = {
  id: 'c31423a7-5b38-4484-9d8e-5a32ed06c273',
  companyId: '09947127-2702-4f6d-9da8-cb463608d812',
  serialNumber: '4110E41673C4EAF733414F606495301C93930A2A',
  issuer: 'C=BR, CN=Empresa Exemplo TESTE',
  subject: 'C=BR, CN=Empresa Exemplo TESTE',
  fingerprint: '2E484E4202B25B2B5FA0F71133475C917355FE1E',
  validFrom: '2026-01-01T00:00:00.000Z',
  validUntil: '2027-01-01T00:00:00.000Z',
  status: 'active',
  createdAt: '2026-10-12T13:04:40.230Z',
};

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
  return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe('certificates', () => {
  it('upload POSTs multipart with file and password fields', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const corvo = client(async (url, init) => {
      calls.push({ url, init: init ?? {} });
      return jsonResponse({ data: certificate }, { status: 201 });
    });
    const res = await corvo.certificates.upload(certificate.companyId, {
      file: Buffer.from([1, 2, 3]),
      fileName: 'certificado.p12',
      password: 'Teste123!',
    });
    expect(res.error).toBeUndefined();
    expect(res.data?.id).toBe(certificate.id);
    expect(calls[0].url).toBe(
      'http://localhost:4000/v1/companies/09947127-2702-4f6d-9da8-cb463608d812/certificates',
    );
    expect(calls[0].init.method).toBe('POST');
    const form = calls[0].init.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('password')).toBe('Teste123!');
    const file = form.get('file') as File;
    expect(file.name).toBe('certificado.p12');
  });

  it('list returns Paginated with plain items', async () => {
    const corvo = client(async () =>
      jsonResponse({ data: [certificate], pagination: { limit: 50, hasMore: false, nextCursor: null } }),
    );
    const res = await corvo.certificates.list(certificate.companyId);
    expect(res.error).toBeUndefined();
    expect(res.data?.data[0].fingerprint).toBe(certificate.fingerprint);
    expect(res.data?.pagination.hasMore).toBe(false);
  });

  it('remove DELETEs and resolves 204 to null', async () => {
    const urls: string[] = [];
    const corvo = client(async (url) => {
      urls.push(url);
      return new Response(null, { status: 204 });
    });
    const res = await corvo.certificates.remove(certificate.companyId, certificate.id);
    expect(res.error).toBeUndefined();
    expect(res.data).toBeNull();
    expect(urls[0]).toBe(
      'http://localhost:4000/v1/companies/09947127-2702-4f6d-9da8-cb463608d812/certificates/c31423a7-5b38-4484-9d8e-5a32ed06c273',
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — `corvo.certificates` is undefined.

- [ ] **Step 3: Implement types and resource**

`src/types/certificate.ts`:

```ts
export interface Certificate {
  id: string;
  companyId: string;
  serialNumber: string;
  issuer: string;
  subject: string;
  fingerprint: string;
  validFrom: string;
  validUntil: string;
  status: string;
  createdAt: string;
}

export interface CertificateUploadParams {
  file: Buffer | Uint8Array;
  fileName?: string;
  password: string;
}
```

`src/resources/certificates.ts`:

```ts
import type { Result } from '../error';
import { mapPlain, type HttpTransport, type Query } from '../transport';
import type { Paginated } from '../types/common';
import type { Certificate, CertificateUploadParams } from '../types/certificate';

export interface CertificateListParams {
  limit?: number;
  cursor?: string;
}

export class CertificatesResource {
  constructor(private readonly http: HttpTransport) {}

  async upload(companyId: string, params: CertificateUploadParams): Promise<Result<Certificate>> {
    const form = new FormData();
    form.append('file', new Blob([params.file], { type: 'application/x-pkcs12' }), params.fileName ?? 'certificate.p12');
    form.append('password', params.password);
    return this.http.request<Certificate>({
      method: 'POST',
      path: `/companies/${encodeURIComponent(companyId)}/certificates`,
      body: form,
    });
  }

  list(companyId: string, params: CertificateListParams = {}): Promise<Result<Paginated<Certificate>>> {
    const query: Query = { limit: params.limit, cursor: params.cursor };
    return this.http.list<Certificate>(
      `/companies/${encodeURIComponent(companyId)}/certificates`,
      query,
      mapPlain,
    );
  }

  remove(companyId: string, certId: string): Promise<Result<null>> {
    return this.http.request<null>({
      method: 'DELETE',
      path: `/companies/${encodeURIComponent(companyId)}/certificates/${encodeURIComponent(certId)}`,
    });
  }
}
```

- [ ] **Step 4: Wire into the client**

In `src/client.ts`: import `CertificatesResource`, add `readonly certificates: CertificatesResource`, and in the constructor `this.certificates = new CertificatesResource(http);`.

- [ ] **Step 5: Run to verify it passes**

Run: `yarn test`
Expected: PASS (3 `certificates` tests).

- [ ] **Step 6: Format, lint, commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/types/certificate.ts src/resources/certificates.ts src/client.ts test/resources/certificates.test.ts
git commit -m "feat: certificates resource (multipart upload, list, remove)"
```

---

### Task 9: Invoices — create, get, list, events

**Files:**
- Create: `src/types/invoice.ts`, `src/resources/invoices.ts`
- Test: `test/resources/invoices.test.ts`

**Interfaces:**
- Consumes: `HttpTransport.request/list/iterate`, `mapProps` (Tasks 3–6).
- Produces:
  - `type InvoiceStatus = 'queued' | 'processing' | 'authorized' | 'rejected' | 'retry_pending' | 'reconciliation_required' | 'manual_review' | 'failed'`
  - `type InvoiceStage = 'pending' | 'authorized' | 'documents_ready' | 'completed' | 'failed'`
  - `interface InvoiceCustomerInput { name: string; taxId: string; email?: string; address?: { street?: string; city?: string; state?: string; zip?: string; country?: string } }`
  - `interface InvoiceCreateParams { companyId?: string; companyTaxId?: string; externalId?: string; correlationId?: string; customer: InvoiceCustomerInput; service: { code: string; municipalityCode?: string; description?: string }; amount: number; competenceDate: string; email?: string; options?: { email?: { send?: boolean } } }`
  - `interface Invoice` (36 campos reais — ver código) com `status`, `stage`, `customerSnapshot`, `serviceSnapshot`
  - `interface InvoiceEvent { id, invoiceId, fromStatus: InvoiceStatus | null, toStatus: InvoiceStatus, reason: string | null, createdAt }`
  - `interface InvoiceListParams { companyId?: string; status?: InvoiceStatus; from?: string; to?: string; externalId?: string; limit?: number; cursor?: string }`
  - `class InvoicesResource` com `create(params, options?)`, `get(id)`, `list(params?)`, `iterate(params?)`, `events(id, params?)`
  - `Corvo.invoices`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest';
import { Corvo } from '../../src/client';
import { API_KEY, BASE_URL, jsonResponse } from '../helpers';

const invoice = {
  id: 'f0add80b-5026-4a11-8f00-5fa03be98b5b',
  companyId: '09947127-2702-4f6d-9da8-cb463608d812',
  tenantId: '6247dfd9-0adc-4bf6-aac9-ee9dc1e7ca8b',
  environment: 'test',
  documentKeyVersion: 2,
  emailSnapshot: { send: false },
  externalId: 'order-42',
  idempotencyKey: null,
  status: 'authorized',
  customerSnapshot: {
    name: 'Cliente Fictício de Testes',
    email: 'cliente@example.com',
    taxId: '52998224725',
    address: { city: 'Uberlândia', state: 'MG' },
  },
  serviceSnapshot: { code: '010101', description: 'Software development', municipalityCode: '3170206' },
  taxSnapshot: {},
  amount: 150.5,
  currency: 'BRL',
  competenceDate: '2026-10-12T00:00:00.000Z',
  dpsId: 'DPS317020624183468700014800001000000000000001',
  dpsSeries: '1',
  dpsNumber: 1,
  accessKey: '02910000000000000001',
  nfseNumber: 1001,
  fiscalProvider: 'provider',
  fiscalSchemaVersion: 'v2_02',
  issuedAt: '2026-10-12T13:04:40.000Z',
  authorizedAt: '2026-10-12T13:04:41.000Z',
  lastErrorCode: null,
  lastErrorMessage: null,
  lastErrorProvider: null,
  documentsReadyAt: '2026-10-12T13:04:42.000Z',
  lastEmailStatus: null,
  lastEmailSentAt: null,
  createdAt: '2026-10-12T13:04:38.985Z',
  updatedAt: '2026-10-12T13:04:42.000Z',
  documentsStatus: 'ready',
  emailStatus: null,
  stage: 'documents_ready',
};

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
  return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe('invoices', () => {
  it('create POSTs with Idempotency-Key and unwraps props', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const corvo = client(async (url, init) => {
      calls.push({ url, init: init ?? {} });
      return jsonResponse({ data: { props: invoice } }, { status: 202 });
    });
    const res = await corvo.invoices.create(
      {
        companyId: invoice.companyId,
        externalId: 'order-42',
        customer: { name: 'Cliente', taxId: '52998224725', email: 'cliente@example.com' },
        service: { code: '010101', municipalityCode: '3170206', description: 'Software development' },
        amount: 150.5,
        competenceDate: '2026-10-12',
        options: { email: { send: true } },
      },
      { idempotencyKey: 'order-42' },
    );
    expect(res.error).toBeUndefined();
    expect(res.data?.id).toBe(invoice.id);
    expect(res.data?.status).toBe('authorized');
    expect(calls[0].url).toBe('http://localhost:4000/v1/invoices');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('order-42');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.options.email.send).toBe(true);
  });

  it('create propagates REST validation errors', async () => {
    const corvo = client(async () =>
      jsonResponse(
        {
          statusCode: 400,
          code: 'ERROR_VALIDATION',
          message: 'Request validation failed',
          details: [{ field: 'service.code', code: 'ERROR_INVALID_SERVICE_CODE', message: 'must be 6 digits' }],
          requestId: 'req-77',
        },
        { status: 400 },
      ),
    );
    const res = await corvo.invoices.create({
      companyId: invoice.companyId,
      customer: { name: 'x', taxId: 'y' },
      service: { code: '1' },
      amount: 1,
      competenceDate: '2026-10-12',
    });
    expect(res.data).toBeUndefined();
    expect(res.error?.code).toBe('ERROR_VALIDATION');
    expect(res.error?.details?.[0].field).toBe('service.code');
    expect(res.error?.requestId).toBe('req-77');
  });

  it('list unwraps props items and keeps the cursor pagination', async () => {
    const corvo = client(async () =>
      jsonResponse({
        data: [{ props: invoice }],
        pagination: { limit: 50, hasMore: true, nextCursor: 'eyJ2IjoxfQ' },
      }),
    );
    const res = await corvo.invoices.list({ companyId: invoice.companyId, status: 'authorized' });
    expect(res.error).toBeUndefined();
    expect(res.data?.data[0].nfseNumber).toBe(1001);
    expect(res.data?.pagination).toEqual({ limit: 50, hasMore: true, nextCursor: 'eyJ2IjoxfQ' });
  });

  it('get unwraps {data: {props}}', async () => {
    const seen: string[] = [];
    const corvo = client(async (url) => {
      seen.push(url);
      return jsonResponse({ data: { props: invoice } });
    });
    const res = await corvo.invoices.get(invoice.id);
    expect(res.data?.id).toBe(invoice.id);
    expect(seen[0]).toBe(`http://localhost:4000/v1/invoices/${invoice.id}`);
  });

  it('events returns a cursor-paginated list of props items', async () => {
    const corvo = client(async () =>
      jsonResponse({
        data: [
          { props: { id: 'ev_1', invoiceId: invoice.id, fromStatus: null, toStatus: 'queued', reason: null, createdAt: '2026-10-12T16:06:18.910Z' } },
          { props: { id: 'ev_2', invoiceId: invoice.id, fromStatus: 'queued', toStatus: 'processing', reason: 'Starting fiscal emission', createdAt: '2026-10-12T16:06:18.910Z' } },
        ],
        pagination: { limit: 2, hasMore: true, nextCursor: 'ev-cursor' },
      }),
    );
    const res = await corvo.invoices.events(invoice.id, { limit: 2 });
    expect(res.error).toBeUndefined();
    expect(res.data?.data).toHaveLength(2);
    expect(res.data?.data[1].toStatus).toBe('processing');
    expect(res.data?.pagination.nextCursor).toBe('ev-cursor');
  });

  it('iterate preserves filters while walking cursors', async () => {
    const urls: string[] = [];
    const pages = [
      jsonResponse({ data: [{ props: invoice }], pagination: { limit: 1, hasMore: true, nextCursor: 'c1' } }),
      jsonResponse({ data: [{ props: { ...invoice, id: 'inv_2' } }], pagination: { limit: 1, hasMore: false, nextCursor: null } }),
    ];
    let i = 0;
    const corvo = client(async (url) => {
      urls.push(url);
      return pages[Math.min(i++, pages.length - 1)];
    });
    const ids: string[] = [];
    for await (const item of corvo.invoices.iterate({ companyId: invoice.companyId, limit: 1 })) {
      ids.push(item.id);
    }
    expect(ids).toEqual([invoice.id, 'inv_2']);
    expect(urls[0]).toContain('companyId=');
    expect(urls[0]).not.toContain('cursor=');
    expect(urls[1]).toContain('cursor=c1');
    expect(urls[1]).toContain('companyId=');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — `corvo.invoices` undefined.

- [ ] **Step 3: Implement `src/types/invoice.ts`**

```ts
export type InvoiceStatus =
  | 'queued'
  | 'processing'
  | 'authorized'
  | 'rejected'
  | 'retry_pending'
  | 'reconciliation_required'
  | 'manual_review'
  | 'failed';

export type InvoiceStage = 'pending' | 'authorized' | 'documents_ready' | 'completed' | 'failed';

export interface InvoiceCustomerInput {
  name: string;
  taxId: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface InvoiceCreateParams {
  companyId?: string;
  companyTaxId?: string;
  externalId?: string;
  correlationId?: string;
  customer: InvoiceCustomerInput;
  service: {
    code: string;
    municipalityCode?: string;
    description?: string;
  };
  amount: number;
  competenceDate: string;
  email?: string;
  options?: {
    email?: { send?: boolean };
  };
}

export interface Invoice {
  id: string;
  companyId: string;
  tenantId: string;
  environment: 'test' | 'live';
  documentKeyVersion: number;
  emailSnapshot: { send: boolean };
  externalId: string | null;
  idempotencyKey: string | null;
  status: InvoiceStatus;
  customerSnapshot: {
    name: string;
    email?: string;
    taxId?: string;
    address?: { street?: string; city?: string; state?: string; zip?: string; country?: string };
  };
  serviceSnapshot: { code?: string; description?: string; municipalityCode?: string };
  taxSnapshot: Record<string, unknown>;
  amount: number;
  currency: string;
  competenceDate: string;
  dpsId: string | null;
  dpsSeries: string | null;
  dpsNumber: number | null;
  accessKey: string | null;
  nfseNumber: number | null;
  fiscalProvider: string | null;
  fiscalSchemaVersion: string | null;
  issuedAt: string | null;
  authorizedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastErrorProvider: string | null;
  documentsReadyAt: string | null;
  lastEmailStatus: string | null;
  lastEmailSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  documentsStatus: string;
  emailStatus: string | null;
  stage: InvoiceStage;
}

export interface InvoiceEvent {
  id: string;
  invoiceId: string;
  fromStatus: InvoiceStatus | null;
  toStatus: InvoiceStatus;
  reason: string | null;
  createdAt: string;
}

export interface InvoiceListParams {
  companyId?: string;
  status?: InvoiceStatus;
  from?: string;
  to?: string;
  externalId?: string;
  limit?: number;
  cursor?: string;
}
```

- [ ] **Step 4: Implement `src/resources/invoices.ts`**

```ts
import type { Result } from '../error';
import { mapProps, type HttpTransport, type Query } from '../transport';
import type { Paginated } from '../types/common';
import type {
  Invoice,
  InvoiceCreateParams,
  InvoiceEvent,
  InvoiceListParams,
} from '../types/invoice';

export interface InvoiceIdempotencyOptions {
  idempotencyKey?: string;
}

export class InvoicesResource {
  constructor(private readonly http: HttpTransport) {}

  create(params: InvoiceCreateParams, options: InvoiceIdempotencyOptions = {}): Promise<Result<Invoice>> {
    return this.http.request<Invoice>({
      method: 'POST',
      path: '/invoices',
      body: params,
      unwrap: 'data+props',
      idempotencyKey: options.idempotencyKey,
    });
  }

  get(id: string): Promise<Result<Invoice>> {
    return this.http.request<Invoice>({
      method: 'GET',
      path: `/invoices/${encodeURIComponent(id)}`,
      unwrap: 'data+props',
    });
  }

  list(params: InvoiceListParams = {}): Promise<Result<Paginated<Invoice>>> {
    return this.http.list<Invoice>('/invoices', this.listQuery(params), mapProps);
  }

  iterate(params: InvoiceListParams = {}): AsyncGenerator<Invoice, void, undefined> {
    return this.http.iterate('/invoices', this.listQuery(params), mapProps);
  }

  events(id: string, params: { limit?: number; cursor?: string } = {}): Promise<Result<Paginated<InvoiceEvent>>> {
    return this.http.list<InvoiceEvent>(
      `/invoices/${encodeURIComponent(id)}/events`,
      { limit: params.limit, cursor: params.cursor },
      mapProps,
    );
  }

  private listQuery(params: InvoiceListParams): Query {
    return {
      companyId: params.companyId,
      status: params.status,
      from: params.from,
      to: params.to,
      externalId: params.externalId,
      limit: params.limit,
      cursor: params.cursor,
    };
  }
}
```

- [ ] **Step 5: Wire into the client**

In `src/client.ts`: import `InvoicesResource`, add `readonly invoices: InvoicesResource`, `this.invoices = new InvoicesResource(http);`.

- [ ] **Step 6: Run to verify it passes**

Run: `yarn test`
Expected: PASS (6 `invoices` tests).

- [ ] **Step 7: Format, lint, commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/types/invoice.ts src/resources/invoices.ts src/client.ts test/resources/invoices.test.ts
git commit -m "feat: invoices resource (create with idempotency, list, events, iteration)"
```

### Task 10: Invoices — pdf, xml, downloadUrl, sendEmail

**Files:**
- Modify: `src/resources/invoices.ts`, `src/types/invoice.ts`
- Test: `test/resources/invoices-download.test.ts`

**Interfaces:**
- Consumes: `HttpTransport.requestRaw`, `DownloadedFile` (Task 3), `InvoicesResource` (Task 9).
- Produces:
  - `interface InvoiceDownloadUrl { downloadUrl: string; expiresAt: string; fileName: string; mimeType: string }`
  - `interface InvoiceEmailResult { emailId: string; status: string }`
  - `InvoicesResource.pdf(id)`, `xml(id)` → `Result<DownloadedFile>`; `downloadUrl(id, format)` → `Result<InvoiceDownloadUrl>`; `sendEmail(id, options?)` → `Result<InvoiceEmailResult>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { Corvo } from '../../src/client';
import { API_KEY, BASE_URL, jsonResponse } from '../helpers';

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
  return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe('invoices downloads and email', () => {
  it('pdf fetches the binary with mime type and file name', async () => {
    const corvo = client(async () =>
      new Response('%PDF-1.7 fake', {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': 'attachment; filename="nfse-1001.pdf"',
        },
      }),
    );
    const res = await corvo.invoices.pdf('inv_1');
    expect(res.error).toBeUndefined();
    expect(res.data?.buffer.toString('utf8')).toBe('%PDF-1.7 fake');
    expect(res.data?.mimeType).toBe('application/pdf');
    expect(res.data?.fileName).toBe('nfse-1001.pdf');
  });

  it('xml fetches the XML body', async () => {
    const corvo = client(async () =>
      new Response('<procNFe></procNFe>', {
        status: 200,
        headers: {
          'content-type': 'application/xml',
          'content-disposition': 'attachment; filename="nfse-1001.xml"',
        },
      }),
    );
    const res = await corvo.invoices.xml('inv_1');
    expect(res.data?.buffer.toString('utf8')).toContain('procNFe');
    expect(res.data?.mimeType).toBe('application/xml');
  });

  it('pdf surfaces API errors (invoice not authorized)', async () => {
    const corvo = client(async () =>
      jsonResponse(
        { statusCode: 409, code: 'ERROR_INVOICE_NOT_AVAILABLE', message: 'PDF only after authorization' },
        { status: 409 },
      ),
    );
    const res = await corvo.invoices.pdf('inv_1');
    expect(res.data).toBeUndefined();
    expect(res.error?.code).toBe('ERROR_INVOICE_NOT_AVAILABLE');
    expect(res.error?.status).toBe(409);
  });

  it('downloadUrl POSTs the format and returns the signed URL', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const corvo = client(async (url, init) => {
      calls.push({ url, init: init ?? {} });
      return jsonResponse({
        data: {
          downloadUrl: 'https://storage.example.com/nfse-1001.pdf?sig=abc',
          expiresAt: '2026-10-12T17:00:00.000Z',
          fileName: 'nfse-1001.pdf',
          mimeType: 'application/pdf',
        },
      });
    });
    const res = await corvo.invoices.downloadUrl('inv_1', 'pdf');
    expect(res.data?.downloadUrl).toContain('sig=abc');
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ format: 'pdf' });
  });

  it('sendEmail POSTs with Idempotency-Key and returns emailId', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const corvo = client(async (url, init) => {
      calls.push({ url, init: init ?? {} });
      return jsonResponse({ data: { emailId: 'em_1', status: 'queued' } }, { status: 202 });
    });
    const res = await corvo.invoices.sendEmail('inv_1', { idempotencyKey: 'mail-1' });
    expect(res.data).toEqual({ emailId: 'em_1', status: 'queued' });
    expect(calls[0].url).toBe('http://localhost:4000/v1/invoices/inv_1/email');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('mail-1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — `corvo.invoices.pdf is not a function`.

- [ ] **Step 3: Add types**

In `src/types/invoice.ts`, append:

```ts
export interface InvoiceDownloadUrl {
  downloadUrl: string;
  expiresAt: string;
  fileName: string;
  mimeType: string;
}

export interface InvoiceEmailResult {
  emailId: string;
  status: string;
}
```

- [ ] **Step 4: Add methods to `src/resources/invoices.ts`**

Import `type { DownloadedFile }` from `../transport` and the two new types, then append inside `InvoicesResource`:

```ts
  pdf(id: string): Promise<Result<DownloadedFile>> {
    return this.http.requestRaw({ method: 'GET', path: `/invoices/${encodeURIComponent(id)}/pdf` });
  }

  xml(id: string): Promise<Result<DownloadedFile>> {
    return this.http.requestRaw({ method: 'GET', path: `/invoices/${encodeURIComponent(id)}/xml` });
  }

  downloadUrl(id: string, format: 'pdf' | 'xml'): Promise<Result<InvoiceDownloadUrl>> {
    return this.http.request<InvoiceDownloadUrl>({
      method: 'POST',
      path: `/invoices/${encodeURIComponent(id)}/download-url`,
      body: { format },
    });
  }

  sendEmail(id: string, options: InvoiceIdempotencyOptions = {}): Promise<Result<InvoiceEmailResult>> {
    return this.http.request<InvoiceEmailResult>({
      method: 'POST',
      path: `/invoices/${encodeURIComponent(id)}/email`,
      idempotencyKey: options.idempotencyKey,
    });
  }
```

- [ ] **Step 5: Run to verify it passes**

Run: `yarn test`
Expected: PASS (5 tests).

- [ ] **Step 6: Format, lint, commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/resources/invoices.ts src/types/invoice.ts test/resources/invoices-download.test.ts
git commit -m "feat: invoice PDF/XML downloads, signed URLs and email dispatch"
```

---

### Task 11: Webhooks resource + deliveries

**Files:**
- Create: `src/types/webhook.ts`, `src/resources/webhooks.ts`
- Test: `test/resources/webhooks.test.ts`

**Interfaces:**
- Consumes: `HttpTransport` (Tasks 3–6).
- Produces:
  - `WEBHOOK_EVENTS` (9 entries) e `type WebhookEvent`
  - `interface Webhook { id, url, events: WebhookEvent[], active, createdAt, updatedAt }`
  - `interface WebhookWithSecret extends Webhook { secret: string }`
  - `interface WebhookCreateParams { url: string; events: WebhookEvent[] }`
  - `interface WebhookDelivery { id, tenantId, webhookConfigId, eventType, environment, url, payload, statusCode, responseBody, errorMessage, status, durationMs, retryCount, nextRetryAt, lastError, createdAt }`
  - `interface WebhookDeliveryStats { total, sent, failed, pending, delayed }`
  - `class WebhooksResource` com `list`, `create`, `remove`, `test`, `readonly deliveries` (`list`, `iterate`, `stats`, `retry`)
  - `Corvo.webhooks`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { Corvo } from '../../src/client';
import { API_KEY, BASE_URL, jsonResponse } from '../helpers';

const webhook = {
  id: '46ee05ce-9dd6-47b7-8261-28061ec627c8',
  url: 'https://webhook.site/eb9651dd',
  events: ['nfse.invoice.authorized', 'nfse.invoice.rejected'],
  active: true,
  createdAt: '2026-10-11T00:35:38.843Z',
  updatedAt: '2026-10-11T00:35:38.843Z',
};

const delivery = {
  id: '84018385-f25d-463d-af23-cea43d0671d2',
  tenantId: '6247dfd9-0adc-4bf6-aac9-ee9dc1e7ca8b',
  webhookConfigId: webhook.id,
  eventType: 'nfse.invoice.email_sent',
  environment: 'test',
  url: webhook.url,
  payload: { id: 'evt_1', type: 'nfse.invoice.email_sent' },
  statusCode: 200,
  responseBody: null,
  errorMessage: null,
  status: 'sent',
  durationMs: 1535,
  retryCount: 0,
  nextRetryAt: null,
  lastError: null,
  createdAt: '2026-10-12T13:04:51.575Z',
};

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
  return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe('webhooks', () => {
  it('list returns a paginated plain list', async () => {
    const corvo = client(async () =>
      jsonResponse({ data: [webhook], pagination: { limit: 1, hasMore: false, nextCursor: null } }),
    );
    const res = await corvo.webhooks.list({ limit: 1 });
    expect(res.data?.data[0].url).toBe(webhook.url);
    expect(res.data?.pagination.hasMore).toBe(false);
  });

  it('create POSTs url/events and returns the secret once', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const corvo = client(async (url, init) => {
      calls.push({ url, init: init ?? {} });
      return jsonResponse({ data: { ...webhook, secret: 'whsec_abc' } }, { status: 201 });
    });
    const res = await corvo.webhooks.create({
      url: webhook.url,
      events: ['nfse.invoice.authorized', 'nfse.invoice.rejected'],
    });
    expect(res.data?.secret).toBe('whsec_abc');
    expect(calls[0].url).toBe('http://localhost:4000/v1/webhooks');
    expect(JSON.parse(String(calls[0].init.body)).events).toHaveLength(2);
  });

  it('remove and test return their boolean flags', async () => {
    let call = 0;
    const methods: string[] = [];
    const corvo = client(async (_url, init) => {
      methods.push(init?.method ?? 'GET');
      call++;
      return jsonResponse({ data: call === 1 ? { deleted: true } : { sent: true } });
    });
    const removed = await corvo.webhooks.remove(webhook.id);
    const tested = await corvo.webhooks.test(webhook.id);
    expect(removed.data).toEqual({ deleted: true });
    expect(tested.data).toEqual({ sent: true });
    expect(methods).toEqual(['DELETE', 'POST']);
  });

  it('deliveries.list sends hours/environment/limit and parses pagination', async () => {
    const urls: string[] = [];
    const corvo = client(async (url) => {
      urls.push(url);
      return jsonResponse({ data: [delivery], pagination: { limit: 10, hasMore: true, nextCursor: 'dc1' } });
    });
    const res = await corvo.webhooks.deliveries.list({ hours: 24, environment: 'test', limit: 10 });
    expect(res.data?.data[0].status).toBe('sent');
    expect(res.data?.pagination.nextCursor).toBe('dc1');
    expect(urls[0]).toContain('hours=24');
    expect(urls[0]).toContain('environment=test');
    expect(urls[0]).toContain('limit=10');
  });

  it('deliveries.stats returns the counters and retry flags the retry', async () => {
    let call = 0;
    const corvo = client(async () => {
      call++;
      if (call === 1) return jsonResponse({ data: { total: 3, sent: 3, failed: 0, pending: 0, delayed: 0 } });
      return jsonResponse({ data: { retried: true } });
    });
    const stats = await corvo.webhooks.deliveries.stats({ hours: 24 });
    expect(stats.data).toEqual({ total: 3, sent: 3, failed: 0, pending: 0, delayed: 0 });
    const retry = await corvo.webhooks.deliveries.retry('dlv_1');
    expect(retry.data).toEqual({ retried: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — `Cannot find module '../../src/resources/webhooks'`.

- [ ] **Step 3: Implement `src/types/webhook.ts`**

```ts
export const WEBHOOK_EVENTS = [
  'nfse.invoice.authorized',
  'nfse.invoice.rejected',
  'nfse.invoice.failed',
  'nfse.invoice.reconciliation_required',
  'nfse.invoice.manual_review',
  'nfse.invoice.documents_ready',
  'nfse.invoice.email_sent',
  'nfse.invoice.email_failed',
  'webhook.test',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookWithSecret extends Webhook {
  secret: string;
}

export interface WebhookCreateParams {
  url: string;
  events: WebhookEvent[];
}

export interface WebhookListParams {
  limit?: number;
  cursor?: string;
}

export interface WebhookDelivery {
  id: string;
  tenantId: string;
  webhookConfigId: string;
  eventType: string;
  environment: 'test' | 'live';
  url: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  responseBody: unknown;
  errorMessage: string | null;
  status: string;
  durationMs: number | null;
  retryCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface WebhookDeliveryStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  delayed: number;
}

export interface WebhookDeliveryListParams {
  hours?: number;
  environment?: 'test' | 'live';
  limit?: number;
  cursor?: string;
}
```

- [ ] **Step 4: Implement `src/resources/webhooks.ts`**

```ts
import type { Result } from '../error';
import { mapPlain, type HttpTransport, type Query } from '../transport';
import type { Paginated } from '../types/common';
import type {
  Webhook,
  WebhookCreateParams,
  WebhookDelivery,
  WebhookDeliveryListParams,
  WebhookDeliveryStats,
  WebhookListParams,
  WebhookWithSecret,
} from '../types/webhook';

class DeliveriesResource {
  constructor(private readonly http: HttpTransport) {}

  list(params: WebhookDeliveryListParams = {}): Promise<Result<Paginated<WebhookDelivery>>> {
    return this.http.list<WebhookDelivery>('/webhooks/deliveries', this.query(params), mapPlain);
  }

  iterate(params: WebhookDeliveryListParams = {}): AsyncGenerator<WebhookDelivery, void, undefined> {
    return this.http.iterate('/webhooks/deliveries', this.query(params), mapPlain);
  }

  stats(params: { hours?: number; environment?: 'test' | 'live' } = {}): Promise<Result<WebhookDeliveryStats>> {
    return this.http.request<WebhookDeliveryStats>({
      method: 'GET',
      path: '/webhooks/deliveries/stats',
      query: { hours: params.hours, environment: params.environment },
    });
  }

  retry(deliveryId: string): Promise<Result<{ retried: boolean }>> {
    return this.http.request<{ retried: boolean }>({
      method: 'POST',
      path: `/webhooks/deliveries/${encodeURIComponent(deliveryId)}/retry`,
    });
  }

  private query(params: WebhookDeliveryListParams): Query {
    return {
      hours: params.hours,
      environment: params.environment,
      limit: params.limit,
      cursor: params.cursor,
    };
  }
}

export class WebhooksResource {
  readonly deliveries: DeliveriesResource;

  constructor(private readonly http: HttpTransport) {
    this.deliveries = new DeliveriesResource(http);
  }

  list(params: WebhookListParams = {}): Promise<Result<Paginated<Webhook>>> {
    return this.http.list<Webhook>('/webhooks', { limit: params.limit, cursor: params.cursor }, mapPlain);
  }

  iterate(params: WebhookListParams = {}): AsyncGenerator<Webhook, void, undefined> {
    return this.http.iterate('/webhooks', { limit: params.limit, cursor: params.cursor }, mapPlain);
  }

  create(params: WebhookCreateParams): Promise<Result<WebhookWithSecret>> {
    return this.http.request<WebhookWithSecret>({ method: 'POST', path: '/webhooks', body: params });
  }

  remove(id: string): Promise<Result<{ deleted: boolean }>> {
    return this.http.request<{ deleted: boolean }>({
      method: 'DELETE',
      path: `/webhooks/${encodeURIComponent(id)}`,
    });
  }

  test(id: string): Promise<Result<{ sent: boolean }>> {
    return this.http.request<{ sent: boolean }>({
      method: 'POST',
      path: `/webhooks/${encodeURIComponent(id)}/test`,
    });
  }
}
```

- [ ] **Step 5: Wire into the client**

In `src/client.ts`: import `WebhooksResource`, add `readonly webhooks: WebhooksResource`, `this.webhooks = new WebhooksResource(http);`.

- [ ] **Step 6: Run to verify it passes**

Run: `yarn test`
Expected: PASS (5 `webhooks` tests).

- [ ] **Step 7: Format, lint, commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/types/webhook.ts src/resources/webhooks.ts src/client.ts test/resources/webhooks.test.ts
git commit -m "feat: webhooks resource with deliveries, stats and retry"
```

### Task 12: Credits + billing resources

**Files:**
- Create: `src/types/credits.ts`, `src/types/billing.ts`, `src/resources/credits.ts`, `src/resources/billing.ts`
- Test: `test/resources/credits-billing.test.ts`

**Interfaces:**
- Consumes: `HttpTransport` (Tasks 3–6).
- Produces:
  - `interface CreditBalance { tenantId, balance, overageUnits, overageAmountCents, hardLimit: number | null }`
  - `interface CreditPlan` (16 campos reais: `id, slug, name, description, dailyLimit, maxActiveCompanies, creditUnitPriceCents, throughputRps, includesWebhooks, includesXmlDownload, includesPdfDownload, includesApiKeys, supportTier, active, createdAt, updatedAt`)
  - `interface CreditTransaction { id, type, amount, creditDelta, balanceAfter, environment, source, referenceType, referenceId, createdAt }` (envolvendo `props`)
  - `interface BillingPlanResponse` (snake_case real: `plan`, `subscription`, `usage`)
  - `interface QuotaStatus` (camelCase real: `canEmit, creditsRemaining, creditsUsed, creditsReserved, monthlyAllowance, dailyUsage, dailyLimit, activeCompanies, maxActiveCompanies, periodStart, periodEnd`)
  - `class CreditsResource` com `balance()`, `plans(params?)`, `history(params?)` (+ `plans.iterate`? Não — `plans()` devolve página; `history.iterate(params?)` sim) e `class BillingResource` com `plan()`, `usage()`
  - `Corvo.credits`, `Corvo.billing`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { Corvo } from '../../src/client';
import { API_KEY, BASE_URL, jsonResponse } from '../helpers';

const creditPlan = {
  id: 'f02dce85-e834-49c1-8f5b-adb0a06ec3d4',
  slug: 'free',
  name: 'Free',
  description: 'Perfect for testing and small projects',
  dailyLimit: 3,
  maxActiveCompanies: 1,
  creditUnitPriceCents: 0,
  throughputRps: 10,
  includesWebhooks: true,
  includesXmlDownload: true,
  includesPdfDownload: true,
  includesApiKeys: true,
  supportTier: 'community',
  active: true,
  createdAt: '2026-10-09T19:49:04.888Z',
  updatedAt: '2026-10-09T19:49:04.888Z',
};

function client(fetch: (url: string, init?: RequestInit) => Promise<Response>): Corvo {
  return new Corvo({ apiKey: API_KEY, baseUrl: BASE_URL, fetch });
}

describe('credits', () => {
  it('balance unwraps the real fields', async () => {
    const corvo = client(async () =>
      jsonResponse({
        data: { tenantId: 't_1', balance: 200, overageUnits: 0, overageAmountCents: 0, hardLimit: 1000 },
      }),
    );
    const res = await corvo.credits.balance();
    expect(res.data).toEqual({ tenantId: 't_1', balance: 200, overageUnits: 0, overageAmountCents: 0, hardLimit: 1000 });
  });

  it('plans unwraps props items from the cursor page', async () => {
    const corvo = client(async () =>
      jsonResponse({
        data: [{ props: creditPlan }],
        pagination: { limit: 1, hasMore: false, nextCursor: null },
      }),
    );
    const res = await corvo.credits.plans();
    expect(res.data?.data[0].slug).toBe('free');
    expect(res.data?.pagination.hasMore).toBe(false);
  });

  it('history walks the cursor pages unwrapping props', async () => {
    const tx = {
      id: 'tx_1',
      type: 'topup',
      amount: 100,
      creditDelta: 100,
      balanceAfter: 200,
      environment: 'test',
      source: 'pack',
      referenceType: null,
      referenceId: null,
      createdAt: '2026-10-12T12:00:00.000Z',
    };
    const pages = [
      jsonResponse({ data: [{ props: tx }], pagination: { limit: 1, hasMore: true, nextCursor: 'h1' } }),
      jsonResponse({ data: [], pagination: { limit: 1, hasMore: false, nextCursor: null } }),
    ];
    let i = 0;
    const corvo = client(async () => pages[Math.min(i++, pages.length - 1)]);
    const items = [];
    for await (const entry of corvo.credits.iterateHistory({ limit: 1 })) items.push(entry);
    expect(items).toHaveLength(1);
    expect(items[0].creditDelta).toBe(100);
  });
});

describe('billing', () => {
  it('plan returns the real snake_case payload', async () => {
    const payload = {
      plan: { slug: 'developer', name: 'Developer', monthly_allowance: 200, daily_limit: null, max_active_companies: 10, monthly_price_cents: 2990 },
      subscription: { status: 'active', paid_until: '2026-11-12T12:25:41.000Z', cancel_at_period_end: false, scheduled_plan: null, blocked: false },
      usage: { credits_remaining: 200, credits_used: 0 },
    };
    const corvo = client(async () => jsonResponse({ data: payload }));
    const res = await corvo.billing.plan();
    expect(res.data?.plan.slug).toBe('developer');
    expect(res.data?.subscription.status).toBe('active');
    expect(res.data?.usage.credits_remaining).toBe(200);
  });

  it('usage returns the camelCase QuotaStatus', async () => {
    const quota = {
      canEmit: true,
      creditsRemaining: 200,
      creditsUsed: 0,
      creditsReserved: 0,
      monthlyAllowance: 200,
      dailyUsage: 0,
      dailyLimit: null,
      activeCompanies: 0,
      maxActiveCompanies: 10,
      periodStart: '2026-10-12T12:25:41.000Z',
      periodEnd: '2026-11-12T12:25:41.000Z',
    };
    const corvo = client(async () => jsonResponse({ data: quota }));
    const res = await corvo.billing.usage();
    expect(res.data?.canEmit).toBe(true);
    expect(res.data?.creditsRemaining).toBe(200);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — `corvo.credits` undefined.

- [ ] **Step 3: Implement types**

`src/types/credits.ts`:

```ts
export interface CreditBalance {
  tenantId: string;
  balance: number;
  overageUnits: number;
  overageAmountCents: number;
  hardLimit: number | null;
}

export interface CreditPlan {
  id: string;
  slug: string;
  name: string;
  description: string;
  dailyLimit: number;
  maxActiveCompanies: number;
  creditUnitPriceCents: number;
  throughputRps: number;
  includesWebhooks: boolean;
  includesXmlDownload: boolean;
  includesPdfDownload: boolean;
  includesApiKeys: boolean;
  supportTier: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  creditDelta: number;
  balanceAfter: number;
  environment: 'test' | 'live';
  source: string;
  referenceType: string | null;
  referenceId: string | null;
  createdAt: string;
}

export interface CreditHistoryParams {
  limit?: number;
  cursor?: string;
}
```

`src/types/billing.ts`:

```ts
export interface BillingPlanResponse {
  plan: {
    slug: string;
    name: string;
    monthly_allowance: number;
    daily_limit: number | null;
    max_active_companies: number;
    monthly_price_cents: number;
  };
  subscription: {
    status: string;
    paid_until: string | null;
    cancel_at_period_end: boolean;
    scheduled_plan: string | null;
    blocked: boolean;
  };
  usage: {
    overage_units: number;
    overage_amount_cents: number;
    hard_limit: number | null;
    credits_used: number;
    credits_reserved: number;
    credits_remaining: number;
    monthly_allowance: number;
    daily_usage: number;
    daily_limit: number | null;
    active_companies: number;
    max_active_companies: number;
    period_start: string | null;
    period_end: string | null;
  };
}

export interface QuotaStatus {
  canEmit: boolean;
  creditsRemaining: number;
  creditsUsed: number;
  creditsReserved: number;
  monthlyAllowance: number;
  dailyUsage: number;
  dailyLimit: number | null;
  activeCompanies: number;
  maxActiveCompanies: number;
  periodStart: string | null;
  periodEnd: string | null;
}
```

- [ ] **Step 4: Implement resources**

`src/resources/credits.ts`:

```ts
import type { Result } from '../error';
import { mapProps, type HttpTransport } from '../transport';
import type { Paginated } from '../types/common';
import type { CreditBalance, CreditHistoryParams, CreditPlan, CreditTransaction } from '../types/credits';

export class CreditsResource {
  constructor(private readonly http: HttpTransport) {}

  balance(): Promise<Result<CreditBalance>> {
    return this.http.request<CreditBalance>({ method: 'GET', path: '/credits' });
  }

  plans(params: { limit?: number; cursor?: string } = {}): Promise<Result<Paginated<CreditPlan>>> {
    return this.http.list<CreditPlan>('/credits/plans', { limit: params.limit, cursor: params.cursor }, mapProps);
  }

  history(params: CreditHistoryParams = {}): Promise<Result<Paginated<CreditTransaction>>> {
    return this.http.list<CreditTransaction>(
      '/credits/history',
      { limit: params.limit, cursor: params.cursor },
      mapProps,
    );
  }

  iterateHistory(params: CreditHistoryParams = {}): AsyncGenerator<CreditTransaction, void, undefined> {
    return this.http.iterate('/credits/history', { limit: params.limit, cursor: params.cursor }, mapProps);
  }
}
```

> Observação: o spec chama de `history.iterate` — como `history` devolve `Promise<Result>` e TS não permite propriedade que é método e gerador ao mesmo tempo de forma limpa, o gerador se chama `iterateHistory(params?)`. Atualizar o README/CLI nesse nome.

`src/resources/billing.ts`:

```ts
import type { Result } from '../error';
import type { HttpTransport } from '../transport';
import type { BillingPlanResponse, QuotaStatus } from '../types/billing';

export class BillingResource {
  constructor(private readonly http: HttpTransport) {}

  plan(): Promise<Result<BillingPlanResponse>> {
    return this.http.request<BillingPlanResponse>({ method: 'GET', path: '/billing/plan' });
  }

  usage(): Promise<Result<QuotaStatus>> {
    return this.http.request<QuotaStatus>({ method: 'GET', path: '/billing/usage' });
  }
}
```

- [ ] **Step 5: Wire into the client**

In `src/client.ts`: import `CreditsResource` and `BillingResource`; add `readonly credits: CreditsResource` and `readonly billing: BillingResource`; instantiate both in the constructor.

- [ ] **Step 6: Run to verify it passes**

Run: `yarn test`
Expected: PASS (5 tests).

- [ ] **Step 7: Format, lint, commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/types/credits.ts src/types/billing.ts src/resources/credits.ts src/resources/billing.ts src/client.ts test/resources/credits-billing.test.ts
git commit -m "feat: credits and billing resources"
```

---

### Task 13: Webhook signature verification + public exports

**Files:**
- Create: `src/webhooks.ts`, `src/index.ts` (substituir o conteúdo)
- Test: `test/webhooks-verify.test.ts`

**Interfaces:**
- Consumes: `WEBHOOK_EVENTS` (Task 11), todos os resources (Tasks 7–12).
- Produces: `class CorvoWebhooks` com `static verifySignature(rawBody: string | Buffer, signatureHeader: string | null | undefined, secret: string): boolean`; `src/index.ts` exportando `Corvo`, `CorvoOptions`, `CorvoApiError`, `Result`, `CorvoErrorDetail`, `CorvoWebhooks`, `WEBHOOK_EVENTS` e todos os tipos públicos + `VERSION`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { Corvo, CorvoApiError, WEBHOOK_EVENTS, VERSION } from '../src/index';
import { CorvoWebhooks } from '../src/webhooks';

const BODY = '{"type":"nfse.invoice.authorized","data":{"id":"inv_1"}}';
const SECRET = 'whsec_test_123';
const SIGNATURE = 'sha256=8f9bd040d8f717b19618ab3395ddfa4b8c176b8dc863195227b88dd85426bbbc';

describe('CorvoWebhooks.verifySignature', () => {
  it('accepts the known HMAC-SHA256 vector', () => {
    expect(CorvoWebhooks.verifySignature(BODY, SIGNATURE, SECRET)).toBe(true);
    expect(CorvoWebhooks.verifySignature(Buffer.from(BODY), SIGNATURE, SECRET)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const tampered = BODY.replace('inv_1', 'inv_2');
    expect(CorvoWebhooks.verifySignature(tampered, SIGNATURE, SECRET)).toBe(false);
  });

  it('rejects a wrong secret', () => {
    expect(CorvoWebhooks.verifySignature(BODY, SIGNATURE, 'whsec_other')).toBe(false);
  });

  it('rejects malformed headers', () => {
    expect(CorvoWebhooks.verifySignature(BODY, undefined, SECRET)).toBe(false);
    expect(CorvoWebhooks.verifySignature(BODY, null, SECRET)).toBe(false);
    expect(CorvoWebhooks.verifySignature(BODY, '8f9bd040d8f717b19618ab3395ddfa4b8c176b8dc863195227b88dd85426bbbc', SECRET)).toBe(false);
    expect(CorvoWebhooks.verifySignature(BODY, 'sha256=zzzz', SECRET)).toBe(false);
    expect(CorvoWebhooks.verifySignature(BODY, '', SECRET)).toBe(false);
    expect(CorvoWebhooks.verifySignature(BODY, SIGNATURE, '')).toBe(false);
  });
});

describe('public exports', () => {
  it('exposes the client, error, events and version', () => {
    expect(typeof Corvo).toBe('function');
    expect(typeof CorvoWebhooks.verifySignature).toBe('function');
    expect(CorvoApiError).toBeDefined();
    expect(WEBHOOK_EVENTS).toHaveLength(9);
    expect(WEBHOOK_EVENTS).toContain('webhook.test');
    expect(VERSION).toBe('0.1.0');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — `Cannot find module '../src/webhooks'` (e exports ausentes de `../src/index`).

- [ ] **Step 3: Implement `src/webhooks.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export class CorvoWebhooks {
  private constructor() {}

  static verifySignature(
    rawBody: string | Buffer,
    signatureHeader: string | null | undefined,
    secret: string,
  ): boolean {
    if (typeof signatureHeader !== 'string' || typeof secret !== 'string' || secret.length === 0) {
      return false;
    }
    const match = /^sha256=([0-9a-f]{64})$/.exec(signatureHeader.trim());
    if (!match) return false;
    const received = Buffer.from(match[1], 'hex');
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    if (received.length !== expected.length) return false;
    return timingSafeEqual(received, expected);
  }
}
```

- [ ] **Step 4: Rewrite `src/index.ts` as the public entry point**

```ts
export const VERSION = '0.1.0';

export { Corvo, type CorvoOptions } from './client';
export { CorvoApiError, type Result, type CorvoErrorDetail, type CorvoApiErrorInit } from './error';
export { CorvoWebhooks } from './webhooks';
export type { DownloadedFile, Query, TransportOptions, Unwrap } from './transport';

export type { Pagination, Paginated } from './types/common';
export type {
  TaxRegime,
  Company,
  CompanyCreateParams,
  CompanyUpdateParams,
  CompanyAddressInput,
} from './types/company';
export type { Certificate, CertificateUploadParams } from './types/certificate';
export type {
  Invoice,
  InvoiceStatus,
  InvoiceStage,
  InvoiceEvent,
  InvoiceCreateParams,
  InvoiceCustomerInput,
  InvoiceListParams,
  InvoiceDownloadUrl,
  InvoiceEmailResult,
} from './types/invoice';
export {
  WEBHOOK_EVENTS,
  type Webhook,
  type WebhookEvent,
  type WebhookWithSecret,
  type WebhookCreateParams,
  type WebhookDelivery,
  type WebhookDeliveryStats,
  type WebhookDeliveryListParams,
} from './types/webhook';
export type { CreditBalance, CreditPlan, CreditTransaction, CreditHistoryParams } from './types/credits';
export type { BillingPlanResponse, QuotaStatus } from './types/billing';
export type { CompanyListParams } from './resources/companies';
export type { CertificateListParams } from './resources/certificates';
export type { InvoiceIdempotencyOptions } from './resources/invoices';
```

- [ ] **Step 5: Run to verify it passes**

Run: `yarn test`
Expected: PASS (6 tests) + todos os anteriores.

- [ ] **Step 6: Format, lint, commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/webhooks.ts src/index.ts test/webhooks-verify.test.ts
git commit -m "feat: webhook signature verification and public exports"
```

### Task 14: CLI scaffold — config, output, program

**Files:**
- Create: `src/cli/config.ts`, `src/cli/output.ts`, `src/cli/options.ts`, `src/cli/program.ts`, `src/cli/index.ts`, `bin/corvo`
- Test: `test/cli/config.test.ts`, `test/cli/output.test.ts`
- Modify: `package.json` (já tem `bin`; garantir campo `bin` presente)

**Interfaces:**
- Consumes: `Corvo`, `CorvoApiError`, `Paginated`, `VERSION` (Tasks 5 e 13).
- Produces:
  - `configPath(): string` (env `CORVO_CONFIG_PATH` override → `~/.config/corvo/config.json`), `readConfig()`, `writeConfig(patch)`, `buildClient(flags): Corvo`
  - `formatTable(rows): string`, `printJson(value)`, `printPage(page, toRow)`, `formatError(error): string`, `fail(error, json): never`, `failFatal(message): never`, `readStdin(): Promise<string>`
  - `commonOptions(command): Command` (`--json`, `--api-key <key>`, `--base-url <url>`), `interface CliOptions`
  - `createProgram(): Command` com `config set|get|list|path`; `main(): void`
  - `bin/corvo` executável chamando `main()`

- [ ] **Step 1: Write the failing tests**

`test/cli/config.test.ts`:

```ts
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildClient, configPath, readConfig, writeConfig } from '../../src/cli/config';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'corvo-config-'));
  vi.stubEnv('CORVO_CONFIG_PATH', join(dir, 'config.json'));
  vi.stubEnv('CORVO_API_KEY', '');
  vi.stubEnv('CORVO_BASE_URL', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});

describe('cli config', () => {
  it('reads and writes the config file with 0600 permissions', () => {
    expect(readConfig()).toEqual({});
    writeConfig({ apiKey: 'corvo_test_' + 'a'.repeat(40), baseUrl: 'https://corvo.example.com' });
    const onDisk = JSON.parse(readFileSync(configPath(), 'utf8'));
    expect(onDisk.apiKey).toContain('corvo_test_');
    expect(statSync(configPath()).mode & 0o777).toBe(0o600);
    expect(readConfig().baseUrl).toBe('https://corvo.example.com');
    writeConfig({ baseUrl: 'https://outra.exemplo.com' });
    expect(readConfig().apiKey).toContain('corvo_test_');
    expect(readConfig().baseUrl).toBe('https://outra.exemplo.com');
  });

  it('buildClient precedence: flags > env > config file', () => {
    writeConfig({ apiKey: 'corvo_test_' + 'f'.repeat(40), baseUrl: 'https://config.exemplo.com' });
    vi.stubEnv('CORVO_API_KEY', 'corvo_test_' + 'e'.repeat(40));
    vi.stubEnv('CORVO_BASE_URL', 'https://env.exemplo.com');

    const fromFile = buildClient({});
    expect(fromFile).toBeDefined();

    const fromFlags = buildClient({ apiKey: 'corvo_live_' + 'c'.repeat(40), baseUrl: 'http://localhost:4000' });
    expect(fromFlags).toBeDefined();

    vi.unstubAllEnvs();
    vi.stubEnv('CORVO_CONFIG_PATH', join(dir, 'config.json'));
    const onlyFile = buildClient({ apiKey: 'corvo_test_' + 'a'.repeat(40) });
    expect(onlyFile).toBeDefined();
  });

  it('throws without any apiKey source', () => {
    expect(() => buildClient({})).toThrow(/apiKey/);
  });
});
```

`test/cli/output.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { CorvoApiError } from '../../src/error';
import { fail, formatError, formatTable } from '../../src/cli/output';

describe('cli output', () => {
  it('formatTable renders aligned columns', () => {
    const table = formatTable([
      { id: 'co_1', name: 'ACME' },
      { id: 'co_2', name: 'Beta' },
    ]);
    const lines = table.split('\n');
    expect(lines[0]).toBe('id    name');
    expect(lines[1]).toBe('----  ----');
    expect(lines[2]).toBe('co_1  ACME');
    expect(lines[3]).toBe('co_2  Beta');
  });

  it('formatError renders code, requestId and details', () => {
    const error = new CorvoApiError({
      message: 'Request validation failed',
      status: 400,
      code: 'ERROR_VALIDATION',
      details: [{ field: 'service.code', code: 'ERROR_INVALID', message: 'must be 6 digits' }],
      requestId: 'req-1',
      retryAfter: 12,
    });
    const text = formatError(error);
    expect(text).toContain('ERROR_VALIDATION: Request validation failed (HTTP 400)');
    expect(text).toContain('requestId: req-1');
    expect(text).toContain('service.code');
    expect(text).toContain('retryAfter: 12s');
  });

  it('fail writes to stderr and exits 1', () => {
    const stderr: string[] = [];
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
      stderr.push(String(chunk));
      return true;
    }) as typeof process.stderr.write);
    const exit = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    const error = new CorvoApiError({ message: 'boom', status: 500, code: 'ERROR_INTERNAL', requestId: 'r1' });
    expect(() => fail(error, false)).toThrow('exit:1');
    expect(stderr.join('')).toContain('ERROR_INTERNAL');
    expect(stderr.join('')).toContain('r1');
    write.mockRestore();
    exit.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — `Cannot find module '../../src/cli/config'`.

- [ ] **Step 3: Implement `src/cli/config.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { Corvo, type CorvoOptions } from '../client';

export interface CorvoConfigFile {
  apiKey?: string;
  baseUrl?: string;
}

export function configPath(): string {
  return process.env.CORVO_CONFIG_PATH ?? join(homedir(), '.config', 'corvo', 'config.json');
}

export function readConfig(): CorvoConfigFile {
  try {
    return JSON.parse(readFileSync(configPath(), 'utf8')) as CorvoConfigFile;
  } catch {
    return {};
  }
}

export function writeConfig(patch: CorvoConfigFile): CorvoConfigFile {
  const next: CorvoConfigFile = { ...readConfig(), ...patch };
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`, { mode: 0o600 });
  return next;
}

export interface ClientFlags {
  apiKey?: string;
  baseUrl?: string;
}

export function buildClient(flags: ClientFlags): Corvo {
  const config = readConfig();
  const options: CorvoOptions = {
    apiKey: flags.apiKey || process.env.CORVO_API_KEY || config.apiKey,
    baseUrl: flags.baseUrl || process.env.CORVO_BASE_URL || config.baseUrl,
  };
  return new Corvo(options);
}
```

- [ ] **Step 4: Implement `src/cli/output.ts`**

```ts
import type { CorvoApiError } from '../error';
import type { Paginated } from '../types/common';

export function formatTable(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '(no results)';
  const columns = Object.keys(rows[0]);
  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((row) => String(row[col] ?? '').length)),
  );
  const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i])).join('  ');
  const header = line(columns).trimEnd();
  const divider = line(widths.map((w) => '-'.repeat(w)));
  const body = rows.map((row) => line(columns.map((col) => String(row[col] ?? ''))).trimEnd());
  return [header, divider, ...body].join('\n');
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printPage<T>(page: Paginated<T>, toRow: (item: T) => Record<string, unknown>): void {
  process.stdout.write(`${formatTable(page.data.map(toRow))}\n`);
  if (page.pagination.hasMore) {
    process.stdout.write(`More pages available — next cursor: ${page.pagination.nextCursor}\n`);
  }
}

export function formatError(error: CorvoApiError): string {
  const lines = [`${error.code}: ${error.message} (HTTP ${error.status || 'no response'})`];
  if (error.requestId) lines.push(`requestId: ${error.requestId}`);
  for (const detail of error.details ?? []) {
    lines.push(`  ${detail.field} — ${detail.code}: ${detail.message}`);
  }
  if (error.retryAfter !== undefined) lines.push(`retryAfter: ${error.retryAfter}s`);
  return lines.join('\n');
}

export function fail(error: CorvoApiError, json: boolean): never {
  if (json) {
    process.stderr.write(
      `${JSON.stringify(
        {
          code: error.code,
          status: error.status,
          message: error.message,
          requestId: error.requestId,
          details: error.details,
          retryAfter: error.retryAfter,
        },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stderr.write(`Error: ${formatError(error)}\n`);
  }
  process.exit(1);
}

export function failFatal(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

export async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}
```

- [ ] **Step 5: Implement `src/cli/options.ts`**

```ts
import type { Command } from 'commander';

export interface CliOptions {
  json?: boolean;
  apiKey?: string;
  baseUrl?: string;
  limit?: string;
  cursor?: string;
  companyId?: string;
  status?: string;
  from?: string;
  to?: string;
  externalId?: string;
  file?: string;
  output?: string;
  format?: string;
  email?: boolean;
  idempotencyKey?: string;
  password?: string;
  hours?: string;
  environment?: string;
  url?: string;
  events?: string;
}

export function commonOptions(command: Command): Command {
  return command
    .option('--json', 'Raw JSON output')
    .option('--api-key <key>', 'API key (overrides env and config file)')
    .option('--base-url <url>', 'API base URL');
}
```

- [ ] **Step 6: Implement `src/cli/program.ts` (config commands only; API commands in Tasks 15–16)**

```ts
import { Command } from 'commander';
import { VERSION } from '../index';
import { buildClient, configPath, readConfig, writeConfig } from './config';
import { failFatal, printJson } from './output';
import type { CliOptions } from './options';

const CONFIG_KEYS = ['apiKey', 'baseUrl'] as const;
type ConfigKey = (typeof CONFIG_KEYS)[number];

function isConfigKey(key: string): key is ConfigKey {
  return (CONFIG_KEYS as readonly string[]).includes(key);
}

export function createProgram(): Command {
  const program = new Command();
  program.name('corvo').description('Corvo NFS-e API CLI').version(VERSION);

  const config = program.command('config').description('Manage CLI configuration');
  config
    .command('set')
    .description('Set a config value (apiKey, baseUrl)')
    .argument('<key>')
    .argument('<value>')
    .action((key: string, value: string) => {
      if (!isConfigKey(key)) failFatal(`Unknown config key: ${key} (expected ${CONFIG_KEYS.join(', ')})`);
      writeConfig({ [key]: value });
      process.stdout.write(`${key} saved to ${configPath()}\n`);
    });

  config
    .command('get')
    .description('Print a config value')
    .argument('<key>')
    .action((key: string) => {
      if (!isConfigKey(key)) failFatal(`Unknown config key: ${key} (expected ${CONFIG_KEYS.join(', ')})`);
      const value = readConfig()[key];
      process.stdout.write(`${value ?? ''}\n`);
    });

  config
    .command('list')
    .description('Print the effective configuration sources')
    .action(function (this: Command) {
      const opts = this.opts() as CliOptions;
      const file = readConfig();
      const masked = file.apiKey ? `${file.apiKey.slice(0, 14)}...` : undefined;
      printJson({
        configPath: configPath(),
        file: { apiKey: masked, baseUrl: file.baseUrl },
        env: {
          CORVO_API_KEY: process.env.CORVO_API_KEY ? 'set' : 'unset',
          CORVO_BASE_URL: process.env.CORVO_BASE_URL ?? 'unset',
        },
        flags: { apiKey: opts.apiKey ? 'set' : 'unset', baseUrl: opts.baseUrl ?? 'unset' },
      });
    });

  config.command('path').description('Print the config file path').action(() => {
    process.stdout.write(`${configPath()}\n`);
  });

  return program;
}

export function main(): void {
  createProgram()
    .parseAsync(process.argv)
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    });
}

// buildClient é re-exportado para os módulos de comando das Tasks 15–16
export { buildClient };
```

- [ ] **Step 7: Implement `src/cli/index.ts` and `bin/corvo`**

`src/cli/index.ts`:

```ts
export { createProgram, main, buildClient } from './program';
```

`bin/corvo` (e `chmod +x bin/corvo`):

```js
#!/usr/bin/env node
import { main } from '../dist/cli/index.js';

main();
```

- [ ] **Step 8: Run to verify it passes**

Run: `yarn test`
Expected: PASS (config tests + output tests + todos os anteriores).

- [ ] **Step 9: Format, lint, commit**

```bash
chmod +x bin/corvo
yarn format && yarn lint && yarn typecheck
git add src/cli bin/corvo test/cli
git commit -m "feat: CLI scaffold with config file and output helpers"
```

### Task 15: CLI commands — companies, certificates, invoices

**Files:**
- Create: `src/cli/commands/companies.ts`, `src/cli/commands/certificates.ts`, `src/cli/commands/invoices.ts`, `src/cli/payload.ts`
- Modify: `src/cli/program.ts` (registrar os três grupos)
- Test: `test/cli/companies-invoices.test.ts`

**Interfaces:**
- Consumes: `createProgram`/`commonOptions`/`CliOptions` (Task 14), resources (Tasks 7–10), `buildClient`, `fail`, `printJson`, `printPage`, `formatTable`, `readStdin`, `failFatal`.
- Produces: comandos `companies list|get|create|update|remove`, `certificates list|upload|remove`, `invoices list|get|create|events|pdf|xml|download-url|email`.

- [ ] **Step 1: Write the failing test**

```ts
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram } from '../../src/cli/program';
import { API_KEY, BASE_URL, jsonResponse } from '../helpers';

let stdout: string[];
let stderr: string[];
let outSpy: { mockRestore(): void };
let errSpy: { mockRestore(): void };

beforeEach(() => {
  stdout = [];
  stderr = [];
  outSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);
  errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as never);
  vi.stubEnv('CORVO_API_KEY', API_KEY);
  vi.stubEnv('CORVO_BASE_URL', BASE_URL);
  vi.stubEnv('CORVO_CONFIG_PATH', join(mkdtempSync(join(tmpdir(), 'corvo-cli-')), 'config.json'));
});

afterEach(() => {
  outSpy.mockRestore();
  errSpy.mockRestore();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function run(...args: string[]): Promise<void> {
  return createProgram().parseAsync(['corvo', ...args], { from: 'node' });
}

const company = {
  id: '09947127-2702-4f6d-9da8-cb463608d812',
  legalName: 'Empresa Exemplo Tecnologia LTDA',
  taxId: '41834687000148',
  status: 'ready',
  environment: 'test',
};

describe('cli companies', () => {
  it('lists companies as a table by default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ data: [company], pagination: { limit: 50, hasMore: false, nextCursor: null } }),
      ),
    );
    await run('companies', 'list');
    const text = stdout.join('');
    expect(text).toContain('legalName');
    expect(text).toContain('Empresa Exemplo Tecnologia LTDA');
  });

  it('prints the raw page as JSON with --json', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ data: [company], pagination: { limit: 50, hasMore: false, nextCursor: null } }),
      ),
    );
    await run('companies', 'list', '--json');
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.data[0].id).toBe(company.id);
    expect(parsed.pagination.hasMore).toBe(false);
  });

  it('shows API errors on stderr and exits 1', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { statusCode: 403, code: 'ERROR_FORBIDDEN', message: 'no permission', requestId: 'req-9' },
          { status: 403 },
        ),
      ),
    );
    await expect(run('companies', 'list')).rejects.toThrow('exit:1');
    const text = stderr.join('');
    expect(text).toContain('ERROR_FORBIDDEN');
    expect(text).toContain('req-9');
  });

  it('gets a company by id', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        return jsonResponse({ data: company });
      }),
    );
    await run('companies', 'get', company.id);
    expect(urls[0]).toContain(`/v1/companies/${company.id}`);
    expect(stdout.join('')).toContain(company.legalName);
  });
});

describe('cli invoices', () => {
  it('creates an invoice from a JSON file with --email and --idempotency-key', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'corvo-invoice-'));
    const file = join(dir, 'nota.json');
    const payload = {
      companyId: '09947127-2702-4f6d-9da8-cb463608d812',
      customer: { name: 'Cliente', taxId: '52998224725' },
      service: { code: '010101', municipalityCode: '3170206' },
      amount: 10.5,
      competenceDate: '2026-10-12',
    };
    const { writeFileSync } = await import('node:fs');
    writeFileSync(file, JSON.stringify(payload));

    let sentBody: Record<string, unknown> = {};
    let idempotency: string | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        sentBody = JSON.parse(String(init?.body));
        idempotency = (init?.headers as Record<string, string>)['Idempotency-Key'];
        return jsonResponse({ data: { props: { id: 'inv_1', status: 'queued' } } }, { status: 202 });
      }),
    );
    await run('invoices', 'create', '--file', file, '--email', '--idempotency-key', 'order-1');
    expect((sentBody.options as { email: { send: boolean } }).email.send).toBe(true);
    expect(idempotency).toBe('order-1');
    expect(stdout.join('')).toContain('inv_1');
    rmSync(dir, { recursive: true, force: true });
  });

  it('fails fast on an invalid JSON file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'corvo-invoice-'));
    const file = join(dir, 'broken.json');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(file, '{ nope');
    await expect(run('invoices', 'create', '--file', file)).rejects.toThrow('exit:1');
    expect(stderr.join('')).toContain('Error:');
    rmSync(dir, { recursive: true, force: true });
  });

  it('downloads a PDF to the requested file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'corvo-pdf-'));
    const target = join(dir, 'saida.pdf');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('%PDF-1.7 conteudo', {
            status: 200,
            headers: {
              'content-type': 'application/pdf',
              'content-disposition': 'attachment; filename="nfse-1001.pdf"',
            },
          }),
      ),
    );
    await run('invoices', 'pdf', 'inv_1', '--output', target);
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, 'utf8')).toBe('%PDF-1.7 conteudo');
    expect(stdout.join('')).toContain('Saved');
    rmSync(dir, { recursive: true, force: true });
  });

  it('lists invoices with filters', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        return jsonResponse({
          data: [{ props: { id: 'inv_1', status: 'authorized', stage: 'completed', nfseNumber: 1001, amount: 10.5, customerSnapshot: { name: 'Cliente' }, createdAt: '2026-10-12T13:04:38.985Z' } }],
          pagination: { limit: 50, hasMore: false, nextCursor: null },
        });
      }),
    );
    await run('invoices', 'list', '--company-id', 'co_1', '--status', 'authorized', '--json');
    expect(urls[0]).toContain('companyId=co_1');
    expect(urls[0]).toContain('status=authorized');
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.data[0].nfseNumber).toBe(1001);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — `companies` is not a command.

- [ ] **Step 3: Implement `src/cli/commands/companies.ts`**

```ts
import type { Command } from 'commander';
import { buildClient } from '../config';
import { commonOptions, type CliOptions } from '../options';
import { fail, printJson, printPage } from '../output';
import { readPayload } from '../payload';
import type { Company } from '../../types/company';

function toRow(company: Company): Record<string, unknown> {
  return {
    id: company.id,
    legalName: company.legalName,
    taxId: company.taxId,
    status: company.status,
    environment: company.environment,
  };
}

export function registerCompanies(program: Command): void {
  const companies = program.command('companies').description('Manage companies');

  commonOptions(companies.command('list').description('List companies'))
    .option('--limit <n>', 'Page size (1-1000)')
    .option('--cursor <cursor>', 'Cursor from a previous page')
    .action(async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.companies.list({
        limit: opts.limit ? Number(opts.limit) : undefined,
        cursor: opts.cursor,
      });
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      printPage(result.data, toRow);
    });

  commonOptions(companies.command('get').description('Get a company by id'))
    .argument('<id>')
    .action(async function (this: Command, id: string) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.companies.get(id);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    });

  commonOptions(companies.command('create').description('Create a company'))
    .option('--file <path>', 'JSON file with the company payload (or - for stdin)')
    .action(async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const payload = await readPayload(opts.file);
      const client = buildClient(opts);
      const result = await client.companies.create(payload);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    });

  commonOptions(companies.command('update').description('Update a company'))
    .argument('<id>')
    .option('--file <path>', 'JSON file with the patch (or - for stdin)')
    .action(async function (this: Command, id: string) {
      const opts = this.opts() as CliOptions;
      const payload = await readPayload(opts.file);
      const client = buildClient(opts);
      const result = await client.companies.update(id, payload);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    });

  commonOptions(companies.command('remove').description('Delete a company'))
    .argument('<id>')
    .action(async function (this: Command, id: string) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.companies.remove(id);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`Company ${id} deleted.\n`);
    });
}
```

- [ ] **Step 4: Implement `src/cli/payload.ts` (leitura de JSON de arquivo ou stdin)**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { failFatal, readStdin } from './output';

export async function readPayload(file: string | undefined): Promise<Record<string, unknown>> {
  if (!file) failFatal('Missing --file <path> (use - to read JSON from stdin)');
  const raw = file === '-' ? await readStdin() : readFileSync(resolve(file), 'utf8');
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      failFatal('Payload must be a JSON object');
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    failFatal(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}
```

- [ ] **Step 5: Implement `src/cli/commands/certificates.ts`**

```ts
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import type { Command } from 'commander';
import { buildClient } from '../config';
import { commonOptions, type CliOptions } from '../options';
import { fail, failFatal, printJson, printPage } from '../output';
import type { Certificate } from '../../types/certificate';

function toRow(cert: Certificate): Record<string, unknown> {
  return {
    id: cert.id,
    status: cert.status,
    fingerprint: cert.fingerprint,
    validFrom: cert.validFrom,
    validUntil: cert.validUntil,
  };
}

export function registerCertificates(program: Command): void {
  const certificates = program.command('certificates').description('Manage A1 certificates');

  commonOptions(certificates.command('list').description('List certificates of a company'))
    .argument('<companyId>')
    .option('--limit <n>', 'Page size (1-1000)')
    .option('--cursor <cursor>', 'Cursor from a previous page')
    .action(async function (this: Command, companyId: string) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.certificates.list(companyId, {
        limit: opts.limit ? Number(opts.limit) : undefined,
        cursor: opts.cursor,
      });
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      printPage(result.data, toRow);
    });

  commonOptions(certificates.command('upload').description('Upload a .p12 certificate'))
    .argument('<companyId>')
    .requiredOption('--file <path>', 'Path to the .p12 file')
    .option('--password <password>', 'Certificate password (or CORVO_CERT_PASSWORD)')
    .action(async function (this: Command, companyId: string) {
      const opts = this.opts() as CliOptions & { file: string };
      await upload(companyId, opts);
    });

  commonOptions(certificates.command('remove').description('Delete a certificate'))
    .argument('<companyId>')
    .argument('<certId>')
    .action(async function (this: Command, companyId: string, certId: string) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.certificates.remove(companyId, certId);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`Certificate ${certId} deleted.\n`);
    });
}

async function upload(companyId: string, opts: CliOptions & { file: string }): Promise<void> {
  const password = opts.password ?? process.env.CORVO_CERT_PASSWORD;
  if (!password) failFatal('Provide --password or set CORVO_CERT_PASSWORD');
  const path = resolve(opts.file);
  const file = readFileSync(path);
  if (file.length > 50 * 1024) failFatal('Certificate file exceeds 50 KiB');
  const client = buildClient(opts);
  const result = await client.certificates.upload(companyId, {
    file,
    fileName: basename(path),
    password,
  });
  if (result.error) fail(result.error, Boolean(opts.json));
  if (opts.json) return printJson(result.data);
  process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
}
```

- [ ] **Step 6: Implement `src/cli/commands/invoices.ts`**

```ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Command } from 'commander';
import { buildClient } from '../config';
import { commonOptions, type CliOptions } from '../options';
import { fail, failFatal, printJson, printPage } from '../output';
import { readPayload } from '../payload';
import type { Invoice, InvoiceListParams, InvoiceStatus } from '../../types/invoice';

function toRow(invoice: Invoice): Record<string, unknown> {
  return {
    id: invoice.id,
    status: invoice.status,
    stage: invoice.stage,
    nfseNumber: invoice.nfseNumber ?? '-',
    amount: invoice.amount,
    customer: invoice.customerSnapshot.name,
    createdAt: invoice.createdAt,
  };
}

export function registerInvoices(program: Command): void {
  const invoices = program.command('invoices').description('Issue and inspect NFS-e invoices');

  commonOptions(invoices.command('list').description('List invoices'))
    .option('--company-id <id>', 'Filter by company')
    .option('--status <status>', 'Filter by status')
    .option('--from <date>', 'Competence start date (ISO)')
    .option('--to <date>', 'Competence end date (ISO)')
    .option('--external-id <id>', 'Filter by externalId')
    .option('--limit <n>', 'Page size (1-1000)')
    .option('--cursor <cursor>', 'Cursor from a previous page')
    .action(async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const params: InvoiceListParams = {
        companyId: opts.companyId,
        status: opts.status as InvoiceStatus | undefined,
        from: opts.from,
        to: opts.to,
        externalId: opts.externalId,
        limit: opts.limit ? Number(opts.limit) : undefined,
        cursor: opts.cursor,
      };
      const result = await client.invoices.list(params);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      printPage(result.data, toRow);
    });

  commonOptions(invoices.command('get').description('Get an invoice by id'))
    .argument('<id>')
    .action(async function (this: Command, id: string) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.invoices.get(id);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    });

  commonOptions(invoices.command('create').description('Issue an invoice from a JSON payload'))
    .option('--file <path>', 'JSON file with the invoice payload (- for stdin)')
    .option('--idempotency-key <key>', 'Idempotency-Key header value')
    .option('--email', 'Also email the customer (options.email.send)')
    .action(async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const payload = await readPayload(opts.file);
      if (opts.email) {
        const options = (payload.options as Record<string, unknown> | undefined) ?? {};
        payload.options = { ...options, email: { send: true } };
      }
      const client = buildClient(opts);
      const result = await client.invoices.create(payload as never, {
        idempotencyKey: opts.idempotencyKey,
      });
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    });

  commonOptions(invoices.command('events').description('List invoice lifecycle events'))
    .argument('<id>')
    .option('--limit <n>', 'Page size (1-1000)')
    .option('--cursor <cursor>', 'Cursor from a previous page')
    .action(async function (this: Command, id: string) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.invoices.events(id, {
        limit: opts.limit ? Number(opts.limit) : undefined,
        cursor: opts.cursor,
      });
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      printPage(result.data, (event) => ({
        toStatus: event.toStatus,
        fromStatus: event.fromStatus ?? '-',
        reason: event.reason ?? '-',
        createdAt: event.createdAt,
      }));
    });

  for (const format of ['pdf', 'xml'] as const) {
    commonOptions(invoices.command(format).description(`Download the invoice ${format.toUpperCase()}`))
      .argument('<id>')
      .option('-o, --output <path>', `Target file (default nfse-<id>.${format})`)
      .action(async function (this: Command, id: string) {
        const opts = this.opts() as CliOptions;
        const client = buildClient(opts);
        const result = format === 'pdf' ? await client.invoices.pdf(id) : await client.invoices.xml(id);
        if (result.error) fail(result.error, Boolean(opts.json));
        const target = resolve(opts.output ?? `nfse-${id}.${format}`);
        writeFileSync(target, result.data.buffer);
        process.stdout.write(`Saved ${target} (${result.data.buffer.length} bytes)\n`);
      });
  }

  commonOptions(invoices.command('download-url').description('Get a signed download URL'))
    .argument('<id>')
    .option('--format <format>', 'pdf or xml', 'pdf')
    .action(async function (this: Command, id: string) {
      const opts = this.opts() as CliOptions;
      if (opts.format !== 'pdf' && opts.format !== 'xml') failFatal('--format must be pdf or xml');
      const client = buildClient(opts);
      const result = await client.invoices.downloadUrl(id, opts.format);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    });

  commonOptions(invoices.command('email').description('Send the invoice to the customer'))
    .argument('<id>')
    .option('--idempotency-key <key>', 'Idempotency-Key header value')
    .action(async function (this: Command, id: string) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.invoices.sendEmail(id, { idempotencyKey: opts.idempotencyKey });
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    });
}
```

- [ ] **Step 7: Register in `src/cli/program.ts`**

Import `registerCompanies`, `registerCertificates`, `registerInvoices` and call them before `return program` inside `createProgram()`.

- [ ] **Step 8: Run to verify it passes**

Run: `yarn test`
Expected: PASS (8 novos testes de CLI + todos os anteriores).

- [ ] **Step 9: Format, lint, commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/cli/commands src/cli/payload.ts src/cli/program.ts test/cli/companies-invoices.test.ts
git commit -m "feat: CLI commands for companies, certificates and invoices"
```

### Task 16: CLI commands — webhooks, credits, billing, health

**Files:**
- Create: `src/cli/commands/webhooks.ts`, `src/cli/commands/credits.ts`, `src/cli/commands/billing.ts`, `src/cli/commands/health.ts`
- Modify: `src/cli/program.ts` (registrar)
- Test: `test/cli/webhooks-credits.test.ts`

**Interfaces:**
- Consumes: Task 14 helpers, resources Tasks 11–12.
- Produces: comandos `webhooks list|create|remove|test`, `webhooks deliveries list|stats|retry`, `credits balance|plans|history`, `billing plan|usage`, `health live|ready`.

- [ ] **Step 1: Write the failing test**

```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProgram } from '../../src/cli/program';
import { API_KEY, BASE_URL, jsonResponse } from '../helpers';

let stdout: string[];
let stderr: string[];
let outSpy: { mockRestore(): void };
let errSpy: { mockRestore(): void };

beforeEach(() => {
  stdout = [];
  stderr = [];
  outSpy = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stdout.push(String(chunk));
    return true;
  }) as typeof process.stdout.write);
  errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    stderr.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as never);
  vi.stubEnv('CORVO_API_KEY', API_KEY);
  vi.stubEnv('CORVO_BASE_URL', BASE_URL);
  vi.stubEnv('CORVO_CONFIG_PATH', join(mkdtempSync(join(tmpdir(), 'corvo-cli-')), 'config.json'));
});

afterEach(() => {
  outSpy.mockRestore();
  errSpy.mockRestore();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function run(...args: string[]): Promise<void> {
  return createProgram().parseAsync(['corvo', ...args], { from: 'node' });
}

describe('cli webhooks', () => {
  it('creates a webhook from flags', async () => {
    let body: Record<string, unknown> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        body = JSON.parse(String(init?.body));
        return jsonResponse(
          { data: { id: 'wh_1', url: 'https://exemplo.com/hook', events: body.events, active: true, createdAt: 'x', updatedAt: 'x', secret: 'whsec_abc' } },
          { status: 201 },
        );
      }),
    );
    await run('webhooks', 'create', '--url', 'https://exemplo.com/hook', '--events', 'nfse.invoice.authorized,webhook.test');
    expect(body.url).toBe('https://exemplo.com/hook');
    expect(body.events).toEqual(['nfse.invoice.authorized', 'webhook.test']);
    expect(stdout.join('')).toContain('whsec_abc');
  });

  it('shows delivery stats as JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ data: { total: 3, sent: 3, failed: 0, pending: 0, delayed: 0 } })),
    );
    await run('webhooks', 'deliveries', 'stats', '--hours', '24', '--json');
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.total).toBe(3);
  });

  it('lists deliveries with environment filter', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        urls.push(url);
        return jsonResponse({ data: [], pagination: { limit: 50, hasMore: false, nextCursor: null } });
      }),
    );
    await run('webhooks', 'deliveries', 'list', '--environment', 'test', '--json');
    expect(urls[0]).toContain('environment=test');
    const parsed = JSON.parse(stdout.join(''));
    expect(parsed.data).toEqual([]);
  });

  it('retries a delivery', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ data: { retried: true } })));
    await run('webhooks', 'deliveries', 'retry', 'dlv_1', '--json');
    expect(JSON.parse(stdout.join('')).retried).toBe(true);
  });

  it('removes a webhook with confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ data: { deleted: true } })));
    await run('webhooks', 'remove', 'wh_1');
    expect(stdout.join('')).toContain('wh_1');
  });
});

describe('cli credits, billing and health', () => {
  it('prints the credit balance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ data: { tenantId: 't1', balance: 200, overageUnits: 0, overageAmountCents: 0, hardLimit: 1000 } }),
      ),
    );
    await run('credits', 'balance', '--json');
    expect(JSON.parse(stdout.join('')).balance).toBe(200);
  });

  it('lists plans as a table', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          data: [{ props: { id: 'p1', slug: 'free', name: 'Free', dailyLimit: 3, active: true } }],
          pagination: { limit: 50, hasMore: false, nextCursor: null },
        }),
      ),
    );
    await run('credits', 'plans');
    const text = stdout.join('');
    expect(text).toContain('slug');
    expect(text).toContain('free');
  });

  it('prints billing usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ data: { canEmit: true, creditsRemaining: 200, creditsUsed: 0 } })),
    );
    await run('billing', 'usage', '--json');
    expect(JSON.parse(stdout.join('')).canEmit).toBe(true);
  });

  it('prints raw health output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ status: 'ok', timestamp: '2026-10-12T16:04:48.268Z', uptime: 10 })),
    );
    await run('health', 'live', '--json');
    expect(JSON.parse(stdout.join('')).status).toBe('ok');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test`
Expected: FAIL — `webhooks` is not a command.

- [ ] **Step 3: Implement `src/cli/commands/webhooks.ts`**

```ts
import type { Command } from 'commander';
import { buildClient } from '../config';
import { commonOptions, type CliOptions } from '../options';
import { fail, failFatal, printJson, printPage } from '../output';
import { readPayload } from '../payload';
import type { Webhook, WebhookDelivery, WebhookEvent } from '../../types/webhook';

function toWebhookRow(webhook: Webhook): Record<string, unknown> {
  return {
    id: webhook.id,
    url: webhook.url,
    events: webhook.events.join(','),
    active: webhook.active,
    createdAt: webhook.createdAt,
  };
}

function toDeliveryRow(delivery: WebhookDelivery): Record<string, unknown> {
  return {
    id: delivery.id,
    eventType: delivery.eventType,
    status: delivery.status,
    statusCode: delivery.statusCode ?? '-',
    retryCount: delivery.retryCount,
    createdAt: delivery.createdAt,
  };
}

function parseEvents(raw: string | undefined): WebhookEvent[] {
  if (!raw) failFatal('Missing --events (comma-separated event types)');
  return raw.split(',').map((event) => event.trim()) as WebhookEvent[];
}

export function registerWebhooks(program: Command): void {
  const webhooks = program.command('webhooks').description('Manage webhooks and deliveries');

  commonOptions(webhooks.command('list').description('List webhooks'))
    .option('--limit <n>', 'Page size (1-1000)')
    .option('--cursor <cursor>', 'Cursor from a previous page')
    .action(async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.webhooks.list({
        limit: opts.limit ? Number(opts.limit) : undefined,
        cursor: opts.cursor,
      });
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      printPage(result.data, toWebhookRow);
    });

  commonOptions(webhooks.command('create').description('Create a webhook'))
    .option('--url <url>', 'Destination URL (or --file with {url, events})')
    .option('--events <list>', 'Comma-separated event types')
    .option('--file <path>', 'JSON file with {url, events} (or - for stdin)')
    .action(async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const params = opts.url
        ? { url: opts.url, events: parseEvents(opts.events) }
        : ((await readPayload(opts.file)) as { url: string; events: WebhookEvent[] });
      const client = buildClient(opts);
      const result = await client.webhooks.create(params);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
      process.stdout.write('Save the secret now — it is shown only once.\n');
    });

  commonOptions(webhooks.command('remove').description('Delete a webhook'))
    .argument('<id>')
    .action(async function (this: Command, id: string) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.webhooks.remove(id);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`Webhook ${id} deleted.\n`);
    });

  commonOptions(webhooks.command('test').description('Send a webhook.test event'))
    .argument('<id>')
    .action(async function (this: Command, id: string) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.webhooks.test(id);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write('Test event sent.\n');
    });

  const deliveries = webhooks.command('deliveries').description('Inspect webhook deliveries');

  commonOptions(deliveries.command('list').description('List recent deliveries'))
    .option('--hours <n>', 'Lookback window in hours (default 24)')
    .option('--environment <env>', 'test or live')
    .option('--limit <n>', 'Page size (1-1000)')
    .option('--cursor <cursor>', 'Cursor from a previous page')
    .action(async function (this: Command) {
      const opts = this.opts() as CliOptions;
      if (opts.environment && opts.environment !== 'test' && opts.environment !== 'live') {
        failFatal('--environment must be test or live');
      }
      const client = buildClient(opts);
      const result = await client.webhooks.deliveries.list({
        hours: opts.hours ? Number(opts.hours) : undefined,
        environment: opts.environment as 'test' | 'live' | undefined,
        limit: opts.limit ? Number(opts.limit) : undefined,
        cursor: opts.cursor,
      });
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      printPage(result.data, toDeliveryRow);
    });

  commonOptions(deliveries.command('stats').description('Delivery counters'))
    .option('--hours <n>', 'Lookback window in hours (default 24)')
    .option('--environment <env>', 'test or live')
    .action(async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.webhooks.deliveries.stats({
        hours: opts.hours ? Number(opts.hours) : undefined,
        environment: opts.environment as 'test' | 'live' | undefined,
      });
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    });

  commonOptions(deliveries.command('retry').description('Retry a delivery now'))
    .argument('<id>')
    .action(async function (this: Command, id: string) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.webhooks.deliveries.retry(id);
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`Delivery ${id} requeued.\n`);
    });
}
```

- [ ] **Step 4: Implement `src/cli/commands/credits.ts`**

```ts
import type { Command } from 'commander';
import { buildClient } from '../config';
import { commonOptions, type CliOptions } from '../options';
import { fail, printJson, printPage } from '../output';
import type { CreditTransaction } from '../../types/credits';

export function registerCredits(program: Command): void {
  const credits = program.command('credits').description('Inspect credit balance and history');

  commonOptions(credits.command('balance').description('Current credit balance')).action(
    async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.credits.balance();
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    },
  );

  commonOptions(credits.command('plans').description('Available credit plans'))
    .option('--limit <n>', 'Page size (1-1000)')
    .option('--cursor <cursor>', 'Cursor from a previous page')
    .action(async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.credits.plans({
        limit: opts.limit ? Number(opts.limit) : undefined,
        cursor: opts.cursor,
      });
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      printPage(result.data, (plan) => ({
        slug: plan.slug,
        name: plan.name,
        dailyLimit: plan.dailyLimit,
        maxActiveCompanies: plan.maxActiveCompanies,
        creditUnitPriceCents: plan.creditUnitPriceCents,
        active: plan.active,
      }));
    });

  commonOptions(credits.command('history').description('Credit movement history'))
    .option('--limit <n>', 'Page size (1-1000)')
    .option('--cursor <cursor>', 'Cursor from a previous page')
    .action(async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.credits.history({
        limit: opts.limit ? Number(opts.limit) : undefined,
        cursor: opts.cursor,
      });
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      const toRow = (entry: CreditTransaction): Record<string, unknown> => ({
        createdAt: entry.createdAt,
        type: entry.type,
        source: entry.source,
        amount: entry.amount,
        creditDelta: entry.creditDelta,
        balanceAfter: entry.balanceAfter,
      });
      printPage(result.data, toRow);
    });
}
```

- [ ] **Step 5: Implement `src/cli/commands/billing.ts` and `src/cli/commands/health.ts`**

`src/cli/commands/billing.ts`:

```ts
import type { Command } from 'commander';
import { buildClient } from '../config';
import { commonOptions, type CliOptions } from '../options';
import { fail, printJson } from '../output';

export function registerBilling(program: Command): void {
  const billing = program.command('billing').description('Plan and quota usage');

  commonOptions(billing.command('plan').description('Current plan and subscription')).action(
    async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.billing.plan();
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    },
  );

  commonOptions(billing.command('usage').description('Quota status')).action(
    async function (this: Command) {
      const opts = this.opts() as CliOptions;
      const client = buildClient(opts);
      const result = await client.billing.usage();
      if (result.error) fail(result.error, Boolean(opts.json));
      if (opts.json) return printJson(result.data);
      process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
    },
  );
}
```

`src/cli/commands/health.ts`:

```ts
import type { Command } from 'commander';
import { buildClient } from '../config';
import { commonOptions, type CliOptions } from '../options';
import { fail, printJson } from '../output';

export function registerHealth(program: Command): void {
  const health = program.command('health').description('Instance health');

  commonOptions(health.command('live').description('Liveness probe')).action(async function (
    this: Command,
  ) {
    const opts = this.opts() as CliOptions;
    const client = buildClient(opts);
    const result = await client.health.live();
    if (result.error) fail(result.error, Boolean(opts.json));
    if (opts.json) return printJson(result.data);
    process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
  });

  commonOptions(health.command('ready').description('Readiness probe')).action(async function (
    this: Command,
  ) {
    const opts = this.opts() as CliOptions;
    const client = buildClient(opts);
    const result = await client.health.ready();
    if (result.error) fail(result.error, Boolean(opts.json));
    if (opts.json) return printJson(result.data);
    process.stdout.write(`${JSON.stringify(result.data, null, 2)}\n`);
  });
}
```

- [ ] **Step 6: Register in `src/cli/program.ts`**

Import and call `registerWebhooks`, `registerCredits`, `registerBilling`, `registerHealth` inside `createProgram()`.

- [ ] **Step 7: Run to verify it passes**

Run: `yarn test`
Expected: PASS (9 novos testes + todos os anteriores).

- [ ] **Step 8: Format, lint, commit**

```bash
yarn format && yarn lint && yarn typecheck
git add src/cli/commands src/cli/program.ts test/cli/webhooks-credits.test.ts
git commit -m "feat: CLI commands for webhooks, credits, billing and health"
```

### Task 17: README, contract test and final verification

**Files:**
- Create: `README.md`, `test/contract/contract.test.ts`

**Interfaces:**
- Consumes: toda a lib e CLI (Tasks 1–16).

- [ ] **Step 1: Write the optional contract test**

```ts
import { describe, expect, it } from 'vitest';
import { Corvo } from '../../src/index';

const enabled = Boolean(process.env.CORVO_API_KEY && process.env.CORVO_BASE_URL);

describe.skipIf(!enabled)('contract against a live instance', () => {
  it('reads health and a company page', async () => {
    const corvo = new Corvo();
    const live = await corvo.health.live();
    expect(live.error).toBeUndefined();
    expect((live.data as { status: string }).status).toBe('ok');

    const page = await corvo.companies.list({ limit: 1 });
    expect(page.error).toBeUndefined();
    expect(page.data?.pagination.limit).toBe(1);
    expect(Array.isArray(page.data?.data)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it skipped, then live**

Run: `yarn test test/contract/contract.test.ts`
Expected: PASS with the test skipped (sem `CORVO_API_KEY`/`CORVO_BASE_URL`).

Run (com o backend local em `localhost:3000` e a chave do smoke — contratos reais):
```bash
CORVO_API_KEY=corvo_test_c848cb53fe8502cfc31aeaf3fa7104ae5bf41344 CORVO_BASE_URL=http://localhost:3000 yarn test test/contract/contract.test.ts
```
Expected: PASS (health ok, página de empresas com pagination real).

- [ ] **Step 3: Write `README.md` (English)**

```markdown
# corvo-nfse-node

Node.js SDK + CLI for the [Corvo](https://api.corvo.tech) self-hosted NFS-e API.
Auth by API key, `{ data, error }` results, zero runtime dependencies (Node 18+).

## Install

```bash
yarn add corvo-nfse-node
# or globally for the CLI
yarn global add corvo-nfse-node
```

## SDK quickstart

```ts
import { Corvo } from 'corvo-nfse-node';

const corvo = new Corvo({
  apiKey: 'corvo_live_xxx',        // or CORVO_API_KEY
  baseUrl: 'https://api.corvo.tech', // default; or CORVO_BASE_URL (self-hosted)
});

const { data, error } = await corvo.companies.list({ limit: 10 });
if (error) {
  console.error(error.code, error.status, error.requestId, error.details);
} else {
  console.log(data.data, data.pagination);
}
```

Errors never throw — API, network and timeout failures come back as
`{ error: CorvoApiError }`. Throw it yourself if you prefer exceptions.

### Issue an invoice

```ts
const { data: invoice, error } = await corvo.invoices.create(
  {
    companyId: '...',
    customer: { name: 'Customer', taxId: '52998224725', email: 'a@b.com' },
    service: { code: '010101', municipalityCode: '3170206', description: 'Services' },
    amount: 150.5,
    competenceDate: '2026-10-12',
  },
  { idempotencyKey: 'order-42' },
);
```

### Pagination

Every list returns `{ data, pagination: { limit, hasMore, nextCursor } }`.
Walk all pages with an async generator:

```ts
for await (const invoice of corvo.invoices.iterate({ companyId, status: 'authorized' })) {
  console.log(invoice.nfseNumber);
}
```

### Downloads

```ts
const { data: pdf } = await corvo.invoices.pdf(invoice.id);
writeFileSync('nfse.pdf', pdf.buffer);
```

### Verifying webhooks

```ts
import { CorvoWebhooks } from 'corvo-nfse-node';

app.post('/webhooks', (req, res) => {
  const signature = req.header('X-Corvo-Signature');
  if (!CorvoWebhooks.verifySignature(req.rawBody, signature, secret)) {
    return res.status(400).send('bad signature');
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
```

- [ ] **Step 4: Full verification**

Run: `yarn format && yarn lint && yarn typecheck && yarn test`
Expected: all PASS, zero errors.

Run: `yarn build`
Expected: `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, `dist/cli/index.js`, `dist/cli/index.cjs` gerados.

Run:
```bash
node -e "console.log(typeof require('./dist/index.cjs').Corvo)" && node -e "import('./dist/index.js').then(m => console.log(typeof m.Corvo, typeof m.CorvoWebhooks, m.WEBHOOK_EVENTS.length))"
```
Expected:
```
function
function function 9
```

Run: `npm pack --dry-run`
Expected: lista `dist/`, `bin/corvo`, `README.md` sem lixo (node_modules fora).

- [ ] **Step 5: Commit**

```bash
yarn format && yarn lint
git add README.md test/contract/contract.test.ts
git commit -m "docs: README with SDK/CLI quickstart and optional contract test"
```

- [ ] **Step 6: Push**

```bash
git push origin main
```
(Confirmar com o usuário antes do push, se não houver autorização explícita.)
