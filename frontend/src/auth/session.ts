export interface UserSession {
  userId: string;
  email: string;
  projectId: string;
  role: 'viewer' | 'analyst' | 'approver' | 'admin';
  expiresAt: number;
}

export function isSessionExpired(session: UserSession, nowMs: number = Date.now()): boolean {
  return session.expiresAt <= nowMs;
}
