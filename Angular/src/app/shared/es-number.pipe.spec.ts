import { EsNumberPipe } from './es-number.pipe';

describe('EsNumberPipe', () => {
  const pipe = new EsNumberPipe();

  it('formats a decimal value in es-CO style by default', () => {
    expect(pipe.transform('516.425')).toBe('516,425');
  });

  it('formats as a percentage when style is "percent"', () => {
    expect(pipe.transform('0.177777777777', 'percent')).toBe('17,78%');
  });

  it('shows an em dash for null/undefined/empty instead of a blank cell', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform('')).toBe('—');
  });
});
