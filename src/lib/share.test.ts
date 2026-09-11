import { describe, expect, it } from 'vitest';
import {
  createSharedThreadUrl,
  decodeSharedPost,
  hasSharedThreadHash,
  parseSharedPostUrl,
} from './share';

const postUrl = 'https://example.social/@alice/114000000000000001';

describe('Share-Links', () => {
  it('liest Instanz und Status-ID aus einer öffentlichen Beitrags-URL', () => {
    expect(parseSharedPostUrl(`${postUrl}?tracking=test#fragment`)).toEqual({
      url: postUrl,
      origin: 'https://example.social',
      statusId: '114000000000000001',
    });
  });

  it('überträgt ausschließlich die Beitrags-URL im Fragment', () => {
    const sharedUrl = createSharedThreadUrl(
      postUrl,
      'https://fediwings.example/app/?source=test#old',
    );
    const url = new URL(sharedUrl);

    expect(url.search).toBe('');
    expect(decodeURIComponent(url.hash)).toBe(`#share=${postUrl}`);
    expect(sharedUrl.length).toBeLessThan(160);
  });

  it('dekodiert das Fragment zu einem Analyseziel', () => {
    const hash = `#share=${encodeURIComponent(postUrl)}`;

    expect(hasSharedThreadHash(hash)).toBe(true);
    expect(decodeSharedPost(hash)).toEqual({
      url: postUrl,
      origin: 'https://example.social',
      statusId: '114000000000000001',
    });
  });

  it('weist unsichere und unvollständige Beitrags-URLs zurück', () => {
    expect(() => parseSharedPostUrl('http://example.social/@alice/123')).toThrow('HTTPS');
    expect(() => parseSharedPostUrl('https://example.social/@alice')).toThrow('Beitrags-ID');
    expect(() => decodeSharedPost('#share=%E0%A4%A')).toThrow();
    expect(() => decodeSharedPost('#other=value')).toThrow('ungültig');
  });

  it('teilt keinen Beitrag ohne öffentliche URL', () => {
    expect(() => createSharedThreadUrl(null, 'https://fediwings.example/')).toThrow(
      'keine öffentliche URL',
    );
  });
});
