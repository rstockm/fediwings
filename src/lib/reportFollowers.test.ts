import { describe, expect, it } from 'vitest';
import { reportFollowerHistory } from './reportFollowers';

describe('reportFollowerHistory', () => {
  it('übernimmt die bereits berechneten Follow- und Kurvenwerte ins passende Jahr', () => {
    const result = reportFollowerHistory(
      {
        monthly: [
          { month: '2025-12', count: 5 },
          { month: '2026-01', count: 3 },
          { month: '2026-03', count: 2 },
        ],
        anchored: {
          months: ['2025-12', '2026-01', '2026-03'],
          points: [90, 95, 98, 100],
          start: 90,
          current: 100,
          totalFollows: 10,
          historyIncomplete: false,
        },
        partial: false,
      },
      2026,
    );
    expect(result.followers.slice(0, 3)).toEqual([98, 98, 100]);
    expect(result.follows.slice(0, 3)).toEqual([3, 0, 2]);
  });
});
