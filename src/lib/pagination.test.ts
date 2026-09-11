import { describe, expect, it } from 'vitest';
import { nextLink } from './pagination';

describe('nextLink', () => {
  it('liest die naechste Seite aus einem Link-Header', () => {
    const header =
      '<https://social.example/api/v1/items?max_id=2>; rel="next", <https://social.example/api/v1/items?since_id=4>; rel="prev"';
    expect(nextLink(header, 'https://social.example')).toBe(
      'https://social.example/api/v1/items?max_id=2',
    );
  });

  it('folgt keinem Link zu einem fremden Origin', () => {
    const header = '<https://tracker.example/collect>; rel="next"';
    expect(nextLink(header, 'https://social.example')).toBeNull();
  });

  it('behandelt fehlende Header', () => {
    expect(nextLink(null, 'https://social.example')).toBeNull();
  });
});
