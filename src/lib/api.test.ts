import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAccount, getPixelfedStatuses, getStatuses } from './api';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const account = {
  id: '784530047819622583',
  username: 'rstockm',
  acct: 'rstockm',
  display_name: 'Ralf Stockmann',
  url: 'https://pixelfed.social/rstockm',
  avatar_static: 'https://pixelfed.social/avatar.png',
  followers_count: 67,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getAccount', () => {
  it('findet Pixelfed-Accounts ueber den lokalen Namen, wenn der volle Handle abgelehnt wird', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        if (url.includes('acct=rstockm%40pixelfed.social')) {
          return Promise.resolve(jsonResponse({ error: 'Record not found' }, 400));
        }
        return Promise.resolve(jsonResponse(account));
      }),
    );

    const result = await getAccount('https://pixelfed.social', 'rstockm@pixelfed.social');

    expect(result.followers_count).toBe(67);
    expect(calls).toEqual([
      'https://pixelfed.social/api/v1/accounts/lookup?acct=rstockm%40pixelfed.social',
      'https://pixelfed.social/api/v1/accounts/lookup?acct=rstockm',
    ]);
  });

  it('wirft Fehler ohne Handle-Fallback weiter', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ error: 'Record not found' }, 400))),
    );

    await expect(getAccount('https://test.social', 'alice')).rejects.toThrow(
      'Die Instanz antwortete mit HTTP 400.',
    );
  });

  it('explains why anonymous API restrictions are not bypassed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(jsonResponse({ error: 'Unauthorized' }, 401))),
    );

    await expect(getAccount('https://test.social', 'alice')).rejects.toThrow(
      'Deshalb versuchen wir nicht, diese Einschränkung technisch zu umgehen',
    );
  });
});

describe.each([
  ['Mastodon', getStatuses, '/api/v1/accounts/account-1/statuses'],
  ['Pixelfed', getPixelfedStatuses, '/api/pixelfed/v1/accounts/account-1/statuses'],
] as const)('%s status filtering', (_, loadStatuses, endpoint) => {
  it('behaelt Originale und Selbst-Threads, aber entfernt Antworten an andere Accounts', async () => {
    const calls: string[] = [];
    const baseStatus = {
      created_at: '2026-09-10T10:00:00Z',
      url: 'https://test.social/@alice/status',
      content: '',
      spoiler_text: '',
      visibility: 'public',
      favourites_count: 0,
      reblogs_count: 0,
      replies_count: 0,
      media_attachments: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        return Promise.resolve(
          jsonResponse([
            {
              ...baseStatus,
              id: 'original',
              in_reply_to_id: null,
              in_reply_to_account_id: null,
            },
            {
              ...baseStatus,
              id: 'self-reply',
              in_reply_to_id: 'original',
              in_reply_to_account_id: 'account-1',
            },
            {
              ...baseStatus,
              id: 'foreign-reply',
              in_reply_to_id: 'remote-status',
              in_reply_to_account_id: 'remote-account',
            },
          ]),
        );
      }),
    );

    const result = await loadStatuses('https://test.social', 'account-1');

    expect(result.statuses.map((status) => status.id)).toEqual(['original', 'self-reply']);
    expect(result.historyComplete).toBe(true);
    expect(result.oldestFetchedAt).toBe('2026-09-10T10:00:00Z');
    expect(calls[0]).toContain(endpoint);
    if (endpoint.includes('/api/v1/accounts/')) {
      expect(calls[0]).toContain('exclude_replies=true');
    }
  });
});
