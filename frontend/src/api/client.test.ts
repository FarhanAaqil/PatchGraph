import { afterEach, describe, expect, it, vi } from 'vitest';
import { PatchGraphApiClient, toQuery } from './generated';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    json: async () => body,
    blob: async () => new Blob(['x']),
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toQuery', () => {
  it('skips empty, false and undefined values', () => {
    expect(toQuery({ q: 'a b', kev_only: true, environment: '', limit: 10, offset: 0, x: undefined, y: false })).toBe(
      '?q=a+b&kev_only=true&limit=10&offset=0',
    );
    expect(toQuery()).toBe('');
  });
});

describe('PatchGraphApiClient', () => {
  it('prefixes /api/v1 and sends identity headers by default', async () => {
    const fetchFn = mockFetch(200, { items: [] });
    await new PatchGraphApiClient().listAuditLogs();
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toMatch(/^\/api\/v1\/audit/);
    expect(init.headers['X-Project-Id']).toBeTruthy();
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('adds a bearer token when one is supplied', async () => {
    const fetchFn = mockFetch(200, { items: [] });
    await new PatchGraphApiClient({ token: 'abc.def' }).listAuditLogs();
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe('Bearer abc.def');
  });

  it('sends paging, search and filters as query parameters', async () => {
    const fetchFn = mockFetch(200, { items: [], total: 0 });
    await new PatchGraphApiClient().listFindings({ q: 'lib', kev_only: true, limit: 10, offset: 20 });
    expect(String(fetchFn.mock.calls[0][0])).toBe('/api/v1/findings?q=lib&kev_only=true&limit=10&offset=20');
  });

  it('throws the API error envelope on non-2xx responses', async () => {
    mockFetch(403, { code: 'INSUFFICIENT_ROLE', message: 'nope', field_errors: [], request_id: 'r1' });
    await expect(new PatchGraphApiClient().listAuditLogs()).rejects.toMatchObject({ code: 'INSUFFICIENT_ROLE' });
  });

  it('does not force a JSON content type on file uploads so the multipart boundary survives', async () => {
    const fetchFn = mockFetch(200, { ok: true });
    await new PatchGraphApiClient({ token: 't' }).uploadSbomFile(new File(['{}'], 'sbom.json'));
    const headers = fetchFn.mock.calls[0][1].headers;
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers['x-filename']).toBe('sbom.json');
    expect(headers.Authorization).toBe('Bearer t');
  });

  it('downloads the audit export as a blob with the same identity', async () => {
    const fetchFn = mockFetch(200, {});
    const blob = await new PatchGraphApiClient({ token: 't' }).exportAuditLogs('csv');
    expect(blob).toBeInstanceOf(Blob);
    expect(String(fetchFn.mock.calls[0][0])).toBe('/api/v1/audit/export?format=csv');
    expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe('Bearer t');
  });
});
