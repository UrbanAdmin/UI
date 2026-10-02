import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CounterUtilitiesComponent } from './counter-utilities.component';
import { AuthService } from '../auth.service';
import { GasBillingComponent } from '../gas-billing/gas-billing.component';
import { AguaBillingComponent } from '../agua-billing/agua-billing.component';
import { ElectricityBillingComponent } from '../electricity-billing/electricity-billing.component';

// GasBillingComponent, AguaBillingComponent and ElectricityBillingComponent each own their entire
// HTTP chain end to end and already have their own spec files - stubbing them here keeps this
// component's tests focused on its own single responsibility (Servicio-pill selection and handing
// off to the right child), instead of re-driving each service's full request sequence just to
// render this component's template.
@Component({ selector: 'app-gas-billing', standalone: true, template: '' })
class StubGasBillingComponent {}

@Component({ selector: 'app-agua-billing', standalone: true, template: '' })
class StubAguaBillingComponent {}

@Component({ selector: 'app-electricity-billing', standalone: true, template: '' })
class StubElectricityBillingComponent {}

describe('CounterUtilitiesComponent', () => {
  let component: CounterUtilitiesComponent;
  let fixture: ComponentFixture<CounterUtilitiesComponent>;

  async function setup(isReadOnly = false) {
    await TestBed.configureTestingModule({
      imports: [CounterUtilitiesComponent],
      providers: [{ provide: AuthService, useValue: { isApartmentOwner: () => isReadOnly } }],
    })
      .overrideComponent(CounterUtilitiesComponent, {
        remove: { imports: [GasBillingComponent, AguaBillingComponent, ElectricityBillingComponent] },
        add: { imports: [StubGasBillingComponent, StubAguaBillingComponent, StubElectricityBillingComponent] },
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
    expect(fixture.nativeElement.querySelector('app-electricity-billing')).toBeNull();
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

  it('clicking the Luz pill swaps to app-electricity-billing (030-electricity-utility-billing)', async () => {
    await setup();

    component.selectedService = 'Luz';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-electricity-billing')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('app-agua-billing')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-gas-billing')).toBeNull();
  });

  it('still shows app-electricity-billing for an ApartmentOwner on Luz (read-only mode lives inside the component itself)', async () => {
    await setup(true);
    component.selectedService = 'Luz';
    fixture.detectChanges();

    expect(component.isReadOnly).toBe(true);
    expect(fixture.nativeElement.querySelector('app-electricity-billing')).toBeTruthy();
  });

  it('still shows the Servicio pills and app-agua-billing for an ApartmentOwner (default Agua)', async () => {
    await setup(true);

    expect(fixture.nativeElement.querySelectorAll('.pill').length).toBe(3);
    expect(fixture.nativeElement.querySelector('app-agua-billing')).toBeTruthy();
  });
});
