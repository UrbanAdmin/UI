import { Pipe, PipeTransform } from '@angular/core';
import { formatDateInWords } from '../notifications/month-names';

@Pipe({ name: 'dateWords', standalone: true })
export class DateWordsPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return formatDateInWords(value);
  }
}
