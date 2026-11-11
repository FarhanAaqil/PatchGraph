import { describe, expect, it } from 'vitest';
import { APP_ROUTES, findRouteByPath } from './routes';

describe('route map', () => {
  it('has unique ids and paths', () => {
    expect(new Set(APP_ROUTES.map((r) => r.id)).size).toBe(APP_ROUTES.length);
    expect(new Set(APP_ROUTES.map((r) => r.path)).size).toBe(APP_ROUTES.length);
  });

  it('finds a route by exact path', () => {
    expect(findRouteByPath('/health').id).toBe('data-health');
  });

  it('maps finding detail URLs to the finding-detail route', () => {
    expect(findRouteByPath('/findings/finding_seed_01').id).toBe('finding-detail');
  });

  it('falls back to the first route for unknown paths', () => {
    expect(findRouteByPath('/nope')).toBe(APP_ROUTES[0]);
  });
});
