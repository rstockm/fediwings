import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadSavedHandles, saveHandleToHistory } from './history';

const KEY = 'fediscope:hidden-handles-v1';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe('saveHandleToHistory', () => {
  it('speichert einen neuen Handle', () => {
    const result = saveHandleToHistory('@alice@example.social');
    expect(result).toHaveLength(1);
    expect(result[0].handle).toBe('alice@example.social');
    expect(localStorage.getItem(KEY)).toContain('alice@example.social');
  });

  it('behaelt nur die letzten drei und vermeidet Duplikate', () => {
    saveHandleToHistory('@a@one.social');
    saveHandleToHistory('@b@two.social');
    saveHandleToHistory('@c@three.social');
    const result = saveHandleToHistory('@d@four.social');
    expect(result.map((entry) => entry.handle)).toEqual([
      'd@four.social',
      'c@three.social',
      'b@two.social',
    ]);
  });

  it('verschiebt einen bereits vorhandenen Handle nach oben', () => {
    saveHandleToHistory('@a@one.social');
    saveHandleToHistory('@b@two.social');
    const result = saveHandleToHistory('@a@one.social');
    expect(result.map((entry) => entry.handle)).toEqual(['a@one.social', 'b@two.social']);
  });

  it('laedt ungueltige oder korrupte Daten als leere Liste', () => {
    localStorage.setItem(KEY, '{kein json');
    expect(loadSavedHandles()).toEqual([]);
    localStorage.setItem(KEY, JSON.stringify('nope'));
    expect(loadSavedHandles()).toEqual([]);
  });
});
