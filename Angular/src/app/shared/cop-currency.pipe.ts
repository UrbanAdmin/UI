import { Pipe, PipeTransform } from '@angular/core';
import { formatCop } from './cop-currency';

@Pipe({ name: 'copCurrency', standalone: true })
export class CopCurrencyPipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    return formatCop(value);
  }
}
