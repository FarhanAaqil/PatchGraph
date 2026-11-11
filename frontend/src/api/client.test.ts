import { afterEach, describe, expect, it, vi } from 'vitest';
import { PatchGraphApiClient } from './generated';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'x',
    json: async () => body,
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
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
});
