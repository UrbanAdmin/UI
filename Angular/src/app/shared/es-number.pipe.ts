import { Pipe, PipeTransform } from '@angular/core';
import { formatEsDecimal, formatEsPercentage } from './es-number';

@Pipe({ name: 'esNumber', standalone: true })
export class EsNumberPipe implements PipeTransform {
  transform(value: string | number | null | undefined, style: 'decimal' | 'percent' = 'decimal'): string {
    const formatted = style === 'percent' ? formatEsPercentage(value) : formatEsDecimal(value);
    return formatted || '—';
  }
}
