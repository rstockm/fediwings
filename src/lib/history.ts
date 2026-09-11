export interface SavedHandle {
  handle: string;
  savedAt: string;
}

const STORAGE_KEY = 'fediscope:hidden-handles-v1';
const MAX_HIDDEN_HANDLES = 3;

/**
 * Stores the three most recently analysed handles in localStorage.
 * Only the handle and a timestamp are persisted; no tokens, no profile data.
 *
 * localStorage is a deliberate, ADR-documented deviation from the
 * recommended IndexedDB/Dexie approach, chosen for its minimal footprint.
 */
export function loadSavedHandles(): SavedHandle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry): entry is SavedHandle =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as SavedHandle).handle === 'string' &&
          typeof (entry as SavedHandle).savedAt === 'string',
      )
      .slice(0, MAX_HIDDEN_HANDLES);
  } catch {
    return [];
  }
}

export function saveHandleToHistory(handle: string): SavedHandle[] {
  const normalized = handle.trim().replace(/^@/, '');
  if (!normalized) return loadSavedHandles();

  const next: SavedHandle[] = [
    { handle: normalized, savedAt: new Date().toISOString() },
    ...loadSavedHandles().filter((entry) => entry.handle !== normalized),
  ].slice(0, MAX_HIDDEN_HANDLES);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode, quota): silently skip persistence.
  }
  return next;
}
