export interface LastAccount {
  handle: string;
  acct: string;
  origin: string;
  followers: number;
  platformId: string;
  platformName: string;
  source: 'analyse' | 'follower';
  savedAt: string;
}

export const LAST_ACCOUNT_KEY = 'fediscope:last-account-v1';

export function readLastAccount(): LastAccount | null {
  try {
    const raw = sessionStorage.getItem(LAST_ACCOUNT_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as LastAccount).handle !== 'string' ||
      typeof (parsed as LastAccount).acct !== 'string' ||
      typeof (parsed as LastAccount).origin !== 'string' ||
      typeof (parsed as LastAccount).followers !== 'number' ||
      typeof (parsed as LastAccount).platformId !== 'string' ||
      typeof (parsed as LastAccount).platformName !== 'string' ||
      ((parsed as LastAccount).source !== 'analyse' &&
        (parsed as LastAccount).source !== 'follower')
    ) {
      return null;
    }
    return parsed as LastAccount;
  } catch {
    return null;
  }
}

export function writeLastAccount(account: Omit<LastAccount, 'savedAt'>): void {
  try {
    sessionStorage.setItem(
      LAST_ACCOUNT_KEY,
      JSON.stringify({ ...account, savedAt: new Date().toISOString() }),
    );
  } catch {
    // Sitzungsspeicher nicht verfuegbar: die Vorauswahl entfällt.
  }
}
