import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CounterUtilitiesComponent } from './counter-utilities.component';
import { AuthService } from '../auth.service';
import { GasBillingComponent } from '../gas-billing/gas-billing.component';
import { AguaBillingComponent } from '../agua-billing/agua-billing.component';
import { ReceiptCardComponent } from '../shared/receipt-card/receipt-card.component';
import { ReadingTableComponent } from '../shared/reading-table/reading-table.component';

// GasBillingComponent and AguaBillingComponent each own their entire HTTP
// chain end to end and already have their own spec files - stubbing them
// here keeps this component's tests focused on its own single
// responsibility (Servicio-pill selection and handing off to the right
// child), instead of re-driving Gas/Agua's full request sequences just to
// render this component's template.
@Component({ selector: 'app-gas-billing', standalone: true, template: '' })
class StubGasBillingComponent {}

@Component({ selector: 'app-agua-billing', standalone: true, template: '' })
class StubAguaBillingComponent {}

@Component({ selector: 'app-receipt-card', standalone: true, template: 'Recibo de {{ service }}' })
class StubReceiptCardComponent {
  @Input() service!: string;
  @Input() month!: number;
  @Input() year!: number;
}

@Component({ selector: 'app-reading-table', standalone: true, template: '' })
class StubReadingTableComponent {
  @Input() service!: string;
  @Input() isReadOnly!: boolean;
}

describe('CounterUtilitiesComponent', () => {
  let component: CounterUtilitiesComponent;
  let fixture: ComponentFixture<CounterUtilitiesComponent>;

  async function setup(isReadOnly = false) {
    await TestBed.configureTestingModule({
      imports: [CounterUtilitiesComponent],
      providers: [{ provide: AuthService, useValue: { isApartmentOwner: () => isReadOnly } }],
    })
      .overrideComponent(CounterUtilitiesComponent, {
        remove: { imports: [GasBillingComponent, AguaBillingComponent, ReceiptCardComponent, ReadingTableComponent] },
        add: { imports: [StubGasBillingComponent, StubAguaBillingComponent, StubReceiptCardComponent, StubReadingTableComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(CounterUtilitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  it('lists the three Servicio pills, defaulting to Agua', async () => {
    await setup();
    expect(component.services).toEqual(['Agua', 'Luz', 'Gas']);
    expect(component.selectedService).toBe('Agua');
    expect(fixture.nativeElement.querySelectorAll('.pill').length).toBe(3);
  });

  it('shows app-agua-billing and nothing else when Agua is selected (the default)', async () => {
    await setup();

    expect(fixture.nativeElement.querySelector('app-agua-billing')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-gas-billing')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-receipt-card')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-reading-table')).toBeNull();
  });

  it('clicking the Gas pill swaps to app-gas-billing', async () => {
    await setup();
    const gasPill: HTMLButtonElement = Array.from(fixture.nativeElement.querySelectorAll('.pill')).find(
      (el) => (el as HTMLButtonElement).textContent?.trim() === 'Gas',
    ) as HTMLButtonElement;

    gasPill.click();
    fixture.detectChanges();

    expect(component.selectedService).toBe('Gas');
    expect(fixture.nativeElement.querySelector('app-gas-billing')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-agua-billing')).toBeNull();
  });

  it('clicking the Luz pill shows the Mes/Año dropdowns plus the shared receipt-card and reading-table', async () => {
    await setup();

    component.selectedService = 'Luz';
    fixture.detectChanges();

    const labels = Array.from(fixture.nativeElement.querySelectorAll('.field label')).map((el: any) => el.textContent);
    expect(labels).toContain('Mes');
    expect(labels).toContain('Año');
    expect(fixture.nativeElement.querySelector('app-receipt-card')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-reading-table')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-agua-billing')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-gas-billing')).toBeNull();
  });

  it('passes the selected Servicio/Mes/Año down to the shared receipt-card for Luz', async () => {
    await setup();
    component.selectedService = 'Luz';
    component.selectedReceiptMonth = 5;
    component.selectedReceiptYear = 2026;
    fixture.detectChanges();

    const receiptCard = fixture.debugElement.query((de) => de.name === 'app-receipt-card').componentInstance as StubReceiptCardComponent;
    expect(receiptCard.service).toBe('Luz');
    expect(receiptCard.month).toBe(5);
    expect(receiptCard.year).toBe(2026);
  });

  it('hides the Mes/Año picker and the receipt card, but still shows the reading table (read-only), for an ApartmentOwner on Luz', async () => {
    await setup(true);
    component.selectedService = 'Luz';
    fixture.detectChanges();

    expect(component.isReadOnly).toBe(true);
    expect(fixture.nativeElement.querySelector('app-receipt-card')).toBeNull();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.field label')).map((el: any) => el.textContent);
    expect(labels).not.toContain('Mes');

    const readingTable = fixture.debugElement.query((de) => de.name === 'app-reading-table').componentInstance as StubReadingTableComponent;
    expect(readingTable.service).toBe('Luz');
    expect(readingTable.isReadOnly).toBe(true);
  });

  it('still shows the Servicio pills and app-agua-billing for an ApartmentOwner (default Agua)', async () => {
    await setup(true);

    expect(fixture.nativeElement.querySelectorAll('.pill').length).toBe(3);
    expect(fixture.nativeElement.querySelector('app-agua-billing')).toBeTruthy();
  });
});
