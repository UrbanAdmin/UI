import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AguaBillingComponent } from './agua-billing.component';
import { WaterBillingComponent } from '../water-billing/water-billing.component';

// WaterBillingComponent owns its own full HTTP chain (WaterBills/Apartments) and already has its
// own spec file - stubbing it here keeps this component's tests focused on what it still owns:
// nothing (FR-046, research.md §11) - it's a thin shell (mirrors how CounterUtilitiesComponent's
// own spec stubs app-gas-billing/app-agua-billing for the same reason).
@Component({ selector: 'app-water-billing', standalone: true, template: '' })
class StubWaterBillingComponent {}

describe('AguaBillingComponent', () => {
  let fixture: ComponentFixture<AguaBillingComponent>;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AguaBillingComponent],
    })
      .overrideComponent(AguaBillingComponent, {
        remove: { imports: [WaterBillingComponent] },
        add: { imports: [StubWaterBillingComponent] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AguaBillingComponent);
    fixture.detectChanges();
  }

  it('should create', async () => {
    await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders app-water-billing with no period-related inputs - it owns its own period list now', async () => {
    await setup();

    expect(fixture.nativeElement.querySelector('app-water-billing')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="agua-cycle-link"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Periodo');
  });
});
