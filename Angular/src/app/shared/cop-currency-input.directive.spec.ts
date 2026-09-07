import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { CopCurrencyInputDirective } from './cop-currency-input.directive';

@Component({
  standalone: true,
  imports: [CopCurrencyInputDirective],
  template: `<input [copCurrencyInput]="value" (copCurrencyInputChange)="value = $event" />`,
})
class HostComponent {
  value: string | null = null;
}

describe('CopCurrencyInputDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let input: HTMLInputElement;
  let directive: CopCurrencyInputDirective;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    input = fixture.debugElement.query(By.css('input')).nativeElement;
    directive = fixture.debugElement.query(By.directive(CopCurrencyInputDirective)).injector.get(CopCurrencyInputDirective);
  });

  it('renders an initial value formatted as Colombian pesos', () => {
    // Exercises the directive's own ngOnChanges handling directly, rather
    // than a second round-trip through the host's template binding - the
    // input/focus/blur-driven behavior below already covers the DOM-facing
    // half end-to-end.
    directive.value = '437590';
    directive.ngOnChanges({ value: { currentValue: '437590', previousValue: null, firstChange: false, isFirstChange: () => false } });

    expect(input.value).toBe('$ 437.590');
  });

  it('renders a null value as an empty field', () => {
    expect(input.value).toBe('');
  });

  it('shows the raw digits (no formatting) once the field is focused, for easy editing', () => {
    directive.value = '437590';
    directive.ngOnChanges({ value: { currentValue: '437590', previousValue: null, firstChange: false, isFirstChange: () => false } });

    input.dispatchEvent(new Event('focus'));

    expect(input.value).toBe('437590');
  });

  it('emits the clean numeric string as the user types, stripping any non-digit characters', () => {
    input.dispatchEvent(new Event('focus'));
    input.value = '4a3.7,590';
    input.dispatchEvent(new Event('input'));

    expect(host.value).toBe('437590');
  });

  it('reformats with $ and thousands separators once the field loses focus', () => {
    input.dispatchEvent(new Event('focus'));
    input.value = '437590';
    input.dispatchEvent(new Event('input'));

    input.dispatchEvent(new Event('blur'));

    expect(input.value).toBe('$ 437.590');
  });
});
