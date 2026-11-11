import { useSyncExternalStore } from 'react';

export type ThemeChoice = 'silver' | 'ink' | 'system';

const THEME_KEY = 'pg.theme';
const MOTION_KEY = 'pg.motion';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the choice just will not persist */
  }
}

export function getTheme(): ThemeChoice {
  const stored = read(THEME_KEY);
  return stored === 'ink' || stored === 'system' ? stored : 'silver';
}

export function applyTheme(choice: ThemeChoice): void {
  const resolved =
    choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'ink' : 'silver') : choice;
  document.documentElement.dataset.theme = resolved;
  write(THEME_KEY, choice);
}

export function getReducedMotion(): boolean {
  return read(MOTION_KEY) === 'reduced';
}

export function applyReducedMotion(reduced: boolean): void {
  if (reduced) document.documentElement.dataset.motion = 'reduced';
  else delete document.documentElement.dataset.motion;
  write(MOTION_KEY, reduced ? 'reduced' : 'full');
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}

/** The theme actually in effect ("silver" or "ink"), updating whenever it changes anywhere in the app. */
export function useResolvedTheme(): string {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.dataset.theme ?? 'silver',
    () => 'silver',
  );
}
