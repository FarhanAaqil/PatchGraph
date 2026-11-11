import { describe, expect, it } from 'vitest';
import { isSessionExpired, type UserSession } from './session';

const session: UserSession = {
  userId: 'u1',
  email: 'a@example.com',
  projectId: 'p1',
  role: 'viewer',
  expiresAt: 10_000,
};

describe('isSessionExpired', () => {
  it('is false before the expiry time', () => {
    expect(isSessionExpired(session, 9_999)).toBe(false);
  });

  it('is true at and after the expiry time', () => {
    expect(isSessionExpired(session, 10_000)).toBe(true);
    expect(isSessionExpired(session, 20_000)).toBe(true);
  });
});
