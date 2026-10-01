import { DateWordsPipe } from './date-words.pipe';

describe('DateWordsPipe', () => {
  const pipe = new DateWordsPipe();

  it('renders an ISO date in Spanish words', () => {
    expect(pipe.transform('2026-09-10')).toBe('10 de septiembre de 2026');
  });

  it('returns an empty string for null/undefined/empty', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });
});
