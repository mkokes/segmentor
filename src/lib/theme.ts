export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_STORAGE_KEY = 'segmentor-theme';
export const THEME_COLORS = { light: '#F6EFE4', dark: '#1C1410' } as const;

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Storage can be unavailable in private browsing.
  }
  return 'system';
}

function applyPreference(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === 'system') {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = preference;
  }
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLORS[preference === 'system' ? scheme : preference];
  });
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } else {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // Still apply for this session.
  }
  applyPreference(preference);
  listeners.forEach((listener) => listener());
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getThemePreference = readPreference;
export const getServerThemePreference = (): ThemePreference => 'system';
