import { describe, expect, it } from 'vitest';
import { readDeepLinkHandle } from './deepLink';

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
