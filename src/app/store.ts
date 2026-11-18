// Small helpers for what is kept on this device. Every call is wrapped so the app
// keeps working when browser storage is switched off, full or unavailable.

export const KEYS = {
  lang: 'name-check.language',
  recent: 'name-check.recent-names',
  shortlist: 'name-check.shortlist',
} as const;

export function load(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

export function save(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: nothing is remembered */ }
}

export function remove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

/** Removes anything after "#" from the address, without adding a step to the back button. */
export function clearHash(): void {
  try {
    if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
  } catch { /* some embedded views do not allow it */ }
}

export function reducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
