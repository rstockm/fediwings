import { describe, expect, it } from 'vitest';
import { readDeepLinkHandle, shouldAutostartDeepLink } from './deepLink';

describe('readDeepLinkHandle', () => {
  it('normalizes a single handle without starting an analysis', () => {
    expect(readDeepLinkHandle('?handle=%40Alice%40Mastodon.Social')).toBe('Alice@mastodon.social');
    expect(readDeepLinkHandle('?handle=lfdi%40baw%C3%BC.social')).toBe('lfdi@xn--baw-joa.social');
    expect(readDeepLinkHandle('')).toBeNull();
  });

  it.each([
    '<img src=x onerror=alert(1)>@mastodon.social',
    'alice@mastodon.social" autofocus onfocus="alert(1)',
    'javascript:alert(1)',
    'https://mastodon.social/@alice',
    'alice@user:password@mastodon.social',
    'alice@mastodon.social:443',
    'alice@mastodon.social/path',
    'alice@mastodon.social?x=1',
    'alice@mastodon.social#fragment',
    'alice@mastodon.social\\evil',
    'alice@mastodon.social\n',
    'alice@mastodon.social\0',
    'alice%40mastodon.social',
    'alice@localhost',
    'alice@host.localhost',
    'alice@router.local',
    'alice@router.internal',
    'alice@127.0.0.1',
    'alice@127.1',
    'alice@0x7f000001',
    'alice@10.0.0.1',
    'alice@169.254.169.254',
    'alice@[::1]',
    'alice@bad..social',
    'alice@-bad.social',
    `${'a'.repeat(65)}@mastodon.social`,
    `alice@${'a'.repeat(64)}.social`,
    'a'.repeat(10000),
  ])('ignores an unsafe or malformed input: %s', (handle) => {
    expect(readDeepLinkHandle(`?handle=${encodeURIComponent(handle)}`)).toBeNull();
  });

  it('rejects ambiguity and leaves OAuth and other views alone', () => {
    for (const suffix of [
      '&handle=bob%40mastodon.social',
      '&handle=',
      '&code=oauth-code',
      '&error=access_denied',
      '&view=follower',
      '&view=methodik',
      '&view=analyse&view=follower',
    ]) {
      expect(readDeepLinkHandle(`?handle=alice%40mastodon.social${suffix}`)).toBeNull();
    }
    expect(readDeepLinkHandle('?handle=alice%40mastodon.social', '#post=shared')).toBeNull();
  });
});

describe('shouldAutostartDeepLink', () => {
  it('requires exactly one explicit flag and a valid handle', () => {
    expect(shouldAutostartDeepLink('?handle=alice%40mastodon.social&autostart=1')).toBe(true);
    for (const suffix of [
      '',
      '&autostart=0',
      '&autostart=true',
      '&autostart=01',
      '&autostart=1&autostart=1',
      '&autostart=1&autostart=0',
    ]) {
      expect(shouldAutostartDeepLink(`?handle=alice%40mastodon.social${suffix}`)).toBe(false);
    }
  });

  it('cannot bypass handle validation or OAuth/share/view precedence', () => {
    for (const query of [
      '?autostart=1',
      '?handle=alice%40127.0.0.1&autostart=1',
      '?handle=%3Cscript%3E%40mastodon.social&autostart=1',
      '?handle=alice%40mastodon.social&handle=bob%40mastodon.social&autostart=1',
      '?handle=alice%40mastodon.social&autostart=1&code=oauth',
      '?handle=alice%40mastodon.social&autostart=1&view=follower',
      '?handle=alice%40mastodon.social&autostart=1&view=methodik',
    ])
      expect(shouldAutostartDeepLink(query)).toBe(false);
    expect(
      shouldAutostartDeepLink('?handle=alice%40mastodon.social&autostart=1', '#post=shared'),
    ).toBe(false);
  });
});
