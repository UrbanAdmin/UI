import { Directive, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { formatCop, parseCop } from './cop-currency';

/**
 * Formats a plain text input as Colombian pesos ("$ 437.590") while blurred,
 * and shows the raw digits while focused so typing/cursor placement isn't
 * fighting inserted "$"/"." characters. Emits the clean numeric string
 * (never the formatted display text) via copCurrencyInputChange, matching
 * what the backend expects to receive.
 */
@Directive({
  selector: 'input[copCurrencyInput]',
  standalone: true,
  host: {
    '(input)': 'onInput($event)',
    '(focus)': 'onFocus()',
    '(blur)': 'onBlur()',
  },
})
export class CopCurrencyInputDirective implements OnChanges {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private focused = false;

  @Input('copCurrencyInput') value: string | null = null;
  @Output() readonly copCurrencyInputChange = new EventEmitter<string>();

  ngOnChanges(changes: SimpleChanges): void {
    if ('value' in changes && !this.focused) {
      this.render();
    }
  }

  onFocus(): void {
    this.focused = true;
    this.el.nativeElement.value = this.value ?? '';
  }

  onInput(event: Event): void {
    const raw = parseCop((event.target as HTMLInputElement).value);
    this.value = raw;
    this.copCurrencyInputChange.emit(raw);
  }

  onBlur(): void {
    this.focused = false;
    this.render();
  }

  private render(): void {
    this.el.nativeElement.value = formatCop(this.value);
  }
}
