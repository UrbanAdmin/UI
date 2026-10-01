import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TenantStatementComponent } from './tenant-statement.component';
import { TenantStatement } from './tenant-statement.model';

describe('TenantStatementComponent', () => {
  let fixture: ComponentFixture<TenantStatementComponent>;

  function render(statement: TenantStatement): void {
    fixture = TestBed.createComponent(TenantStatementComponent);
    fixture.componentRef.setInput('statement', statement);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TenantStatementComponent] }).compileComponents();
  });

  it('ready: renders the total, every breakdown line, both readings, consumo with unit and %', () => {
    render({
      state: 'ready',
      periodLabel: 'Septiembre 2026',
      apartmentLine: 'Apto 201 · hilda · Arrendado',
      unit: 'm³',
      previousReading: '292.157',
      currentReading: '295.851',
      consumption: '3.694',
      percentage: '0.1079',
      breakdown: [
        { label: 'Costo variable', value: '6595' },
        { label: 'Cargo fijo', value: '726' },
      ],
      total: '7400',
    });

    const text = fixture.nativeElement.textContent;
    expect(fixture.nativeElement.querySelector('[data-testid="statement-total"]').textContent).toContain('7.400');
    expect(text).toContain('Costo variable');
    expect(text).toContain('6.595');
    expect(text).toContain('Cargo fijo');
    expect(text).toContain('726');
    expect(text).toContain('292,157');
    expect(text).toContain('295,851');
    expect(fixture.nativeElement.querySelector('[data-testid="statement-consumo"]').textContent).toContain('3,694 m³');
    expect(fixture.nativeElement.querySelector('[data-testid="statement-percentage"]').textContent).toContain('10,79%');
    expect(text).toContain('Apto 201 · hilda · Arrendado');
  });

  it('ready: the share bar width matches the clamped percentage', () => {
    render({
      state: 'ready',
      periodLabel: 'Septiembre 2026',
      apartmentLine: 'Apto 201 · hilda · Arrendado',
      unit: 'm³',
      previousReading: '0',
      currentReading: '30',
      consumption: '30',
      percentage: '1.5', // 150% - must clamp to 100
      breakdown: [{ label: 'Costo variable', value: '300' }],
      total: '300',
    });

    const bar: HTMLElement = fixture.nativeElement.querySelector('[data-testid="statement-bar"]');
    expect(bar.style.width).toBe('100%');
  });

  it('empty: renders only the message - no "$0", no "0 m³" anywhere', () => {
    render({
      state: 'empty',
      periodLabel: 'Septiembre 2026',
      apartmentLine: '',
      unit: 'm³',
      emptyMessage: 'Aún no hay lectura de Gas para Septiembre 2026.',
    });

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Aún no hay lectura de Gas para Septiembre 2026.');
    expect(text).not.toContain('$0');
    expect(text).not.toContain('0 m³');
    expect(fixture.nativeElement.querySelector('[data-testid="statement-total"]')).toBeNull();
  });

  it('pending-receipt: renders the meter card and "Pendiente del recibo" in place of money and %', () => {
    render({
      state: 'pending-receipt',
      periodLabel: 'Septiembre 2026',
      apartmentLine: 'Apto 201 · hilda · Arrendado',
      unit: 'm³',
      previousReading: '292.157',
      currentReading: '295.851',
      consumption: '3.694',
    });

    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Pendiente del recibo');
    expect(fixture.nativeElement.querySelector('[data-testid="statement-consumo"]').textContent).toContain('3,694 m³');
    expect(text).toContain('292,157');
    expect(text).toContain('295,851');
    expect(fixture.nativeElement.querySelector('[data-testid="statement-total"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="statement-percentage"]')).toBeNull();
  });
});
