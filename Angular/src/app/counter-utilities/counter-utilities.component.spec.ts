import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { CounterUtilitiesComponent } from './counter-utilities.component';
import { AddManualReadingDialogComponent } from '../add-manual-reading-dialog/add-manual-reading-dialog.component';
import { AddReadingDialogComponent } from '../add-reading-dialog/add-reading-dialog.component';

describe('CounterUtilitiesComponent', () => {
  let component: CounterUtilitiesComponent;
  let fixture: ComponentFixture<CounterUtilitiesComponent>;
  let dialogOpen: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(null) });

    await TestBed.configureTestingModule({
      imports: [CounterUtilitiesComponent],
      providers: [{ provide: MatDialog, useValue: { open: dialogOpen } }],
    }).compileComponents();

    fixture = TestBed.createComponent(CounterUtilitiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should list all 6 apartments and the 3 services', () => {
    expect(component.apartments.length).toBe(6);
    expect(component.services).toEqual(['Agua', 'Luz', 'Gas']);
  });

  it('getRows should return 12 months for a given apartment/service', () => {
    const rows = component.getRows(component.apartments[0].number, 'Agua');
    expect(rows.length).toBe(12);
  });

  it('openAddManualReadingDialog should open the dialog with the apartment/service context', () => {
    const apartment = component.apartments[1];

    component.openAddManualReadingDialog(apartment, 'Luz');

    expect(dialogOpen).toHaveBeenCalledWith(
      AddManualReadingDialogComponent,
      expect.objectContaining({
        data: { apartment: apartment.number, owner: apartment.owner, service: 'Luz' },
      }),
    );
  });

  it('openAddReadingDialog should open the dialog with the apartment/service context', () => {
    const apartment = component.apartments[2];

    component.openAddReadingDialog(apartment, 'Gas');

    expect(dialogOpen).toHaveBeenCalledWith(
      AddReadingDialogComponent,
      expect.objectContaining({
        data: { apartment: apartment.number, owner: apartment.owner, service: 'Gas' },
      }),
    );
  });
});
