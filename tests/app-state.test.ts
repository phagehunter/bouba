// Checks for what the app keeps in the address and on the device. Run with: npm test
import { describe, expect, it } from 'vitest';
import { addRecent, addToShortlist, cleanRecent, decodeState, encodeState, inShortlist, parseNames } from '../src/app/state';

const IDS = ['th', 'my', 'ja', 'zh', 'ar', 'hi'];

describe('address state', () => {
  it('writes the name and language', () => {
    expect(encodeState({ name: 'Starbucks', lang: 'th' })).toBe('n=Starbucks&l=th');
  });

  it('encodes spaces and symbols', () => {
    expect(encodeState({ name: 'Fresh starts here', lang: 'ja' })).toBe('n=Fresh%20starts%20here&l=ja');
    expect(encodeState({ name: 'A&B=C #1', lang: 'hi' })).toBe('n=A%26B%3DC%20%231&l=hi');
  });

  it('leaves out an empty name', () => {
    expect(encodeState({ name: '   ', lang: 'zh' })).toBe('l=zh');
    expect(encodeState({})).toBe('');
  });

  it('reads back what it wrote', () => {
    for (const name of ['Starbucks', 'Fresh starts here', 'A&B=C #1', 'Café Crème', '100% Pure+']) {
      for (const lang of IDS) {
        expect(decodeState('#' + encodeState({ name, lang }), IDS)).toEqual({ name, lang });
      }
    }
  });

  it('reads with or without the leading #', () => {
    expect(decodeState('n=Tesla&l=ar', IDS)).toEqual({ name: 'Tesla', lang: 'ar' });
    expect(decodeState('#n=Tesla&l=ar', IDS)).toEqual({ name: 'Tesla', lang: 'ar' });
  });

  it('reads a plus sign as a space', () => {
    expect(decodeState('#n=Fresh+starts', IDS)).toEqual({ name: 'Fresh starts' });
  });

  it('ignores an unknown language, unknown keys and broken encoding', () => {
    expect(decodeState('#n=Tesla&l=xx', IDS)).toEqual({ name: 'Tesla' });
    expect(decodeState('#result', IDS)).toEqual({});
    expect(decodeState('', IDS)).toEqual({});
    expect(decodeState('#n=%E0%A4%A&l=th', IDS)).toEqual({ lang: 'th' });
    expect(decodeState('#x=1&l=my', IDS)).toEqual({ lang: 'my' });
  });

  it('keeps an empty name when the address has one', () => {
    expect(decodeState('#n=&l=th', IDS)).toEqual({ name: '', lang: 'th' });
  });

  it('cuts a very long name', () => {
    expect(decodeState('#n=' + 'a'.repeat(500), IDS).name).toHaveLength(200);
  });
});

describe('recent names', () => {
  it('puts the newest name first', () => {
    expect(addRecent(['Tesla', 'Shell'], 'Zoom')).toEqual(['Zoom', 'Tesla', 'Shell']);
  });

  it('moves a repeated name to the front, ignoring case', () => {
    expect(addRecent(['Tesla', 'Shell', 'Zoom'], 'shell')).toEqual(['shell', 'Tesla', 'Zoom']);
  });

  it('keeps at most 12 names', () => {
    let list: string[] = [];
    for (let i = 0; i < 20; i++) list = addRecent(list, 'Name ' + String.fromCharCode(65 + i));
    expect(list).toHaveLength(12);
    expect(list[0]).toBe('Name T');
    expect(list[11]).toBe('Name I');
  });

  it('trims the name and skips text with no letters', () => {
    expect(addRecent([], '  Fresh   starts ')).toEqual(['Fresh starts']);
    expect(addRecent(['Tesla'], '   ')).toEqual(['Tesla']);
    expect(addRecent(['Tesla'], '123')).toEqual(['Tesla']);
  });

  it('does not change the list it was given', () => {
    const list = ['Tesla'];
    addRecent(list, 'Zoom');
    expect(list).toEqual(['Tesla']);
  });

  it('cleans a stored value', () => {
    expect(cleanRecent(['Tesla', 'Shell'])).toEqual(['Tesla', 'Shell']);
    expect(cleanRecent(['Tesla', 7, null, 'tesla', ''])).toEqual(['Tesla']);
    expect(cleanRecent('Tesla')).toEqual([]);
    expect(cleanRecent(null)).toEqual([]);
    expect(cleanRecent(Array.from({ length: 30 }, (_, i) => 'N' + 'x'.repeat(i)))).toHaveLength(12);
  });
});

describe('shortlist', () => {
  it('reads one name per line', () => {
    expect(parseNames('Shell\n Starbucks \n\n123\nTesla, Zoom; Lotus')).toEqual(['Shell', 'Starbucks', 'Tesla', 'Zoom', 'Lotus']);
  });

  it('reads at most 50 names', () => {
    expect(parseNames(Array.from({ length: 60 }, () => 'Name').join('\n'))).toHaveLength(50);
  });

  it('finds a name ignoring case', () => {
    expect(inShortlist('Shell\nStarbucks', 'starbucks ')).toBe(true);
    expect(inShortlist('Shell\nStarbucks', 'Star')).toBe(false);
    expect(inShortlist('Shell', '')).toBe(false);
  });

  it('adds a name on a new line, once', () => {
    expect(addToShortlist('Shell\nTesla', 'Zoom')).toBe('Shell\nTesla\nZoom');
    expect(addToShortlist('Shell\nTesla\n\n', 'Zoom')).toBe('Shell\nTesla\nZoom');
    expect(addToShortlist('', 'Zoom')).toBe('Zoom');
    expect(addToShortlist('Shell\nTesla', 'tesla')).toBe('Shell\nTesla');
    expect(addToShortlist('Shell', '42')).toBe('Shell');
  });
});
