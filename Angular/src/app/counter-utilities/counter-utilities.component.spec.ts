import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { CounterUtilitiesComponent } from './counter-utilities.component';
import { AddManualReadingDialogComponent } from '../add-manual-reading-dialog/add-manual-reading-dialog.component';
import { AddReadingDialogComponent } from '../add-reading-dialog/add-reading-dialog.component';
import { ApartmentDto } from '../shared/apartment.model';
import { environment } from '../../environments/environment';

const MOCK_APARTMENTS: ApartmentDto[] = [
  { id: 1, name: '101', owner: 'TBD' },
  { id: 2, name: '201', owner: 'Bryan' },
  { id: 3, name: '202', owner: 'Yesenia' },
  { id: 4, name: '301', owner: 'Oscar' },
  { id: 5, name: '302', owner: 'Olga' },
  { id: 6, name: '401', owner: 'Daniel' },
];

describe('CounterUtilitiesComponent', () => {
  let component: CounterUtilitiesComponent;
  let fixture: ComponentFixture<CounterUtilitiesComponent>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(null) });

    await TestBed.configureTestingModule({
      imports: [CounterUtilitiesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CounterUtilitiesComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(MOCK_APARTMENTS);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should list all 6 apartments and the 3 services', async () => {
    const apartments = await new Promise<{ number: string }[]>((resolve) =>
      component.apartments$.subscribe(resolve),
    );
    expect(apartments.length).toBe(6);
    expect(component.services).toEqual(['Agua', 'Luz', 'Gas']);
  });

  it('getRows should return 12 months for a given apartment/service', () => {
    const rows = component.getRows('101', 'Agua');
    expect(rows.length).toBe(12);
  });

  it('openAddManualReadingDialog should open the dialog with the apartment/service context', () => {
    const apartment = { id: 2, number: '201', owner: 'Bryan' };

    component.openAddManualReadingDialog(apartment, 'Luz');

    expect(dialogOpen).toHaveBeenCalledWith(
      AddManualReadingDialogComponent,
      expect.objectContaining({
        data: { apartment: apartment.number, owner: apartment.owner, service: 'Luz' },
      }),
    );
  });

  it('openAddReadingDialog should open the dialog with the apartment/service context', () => {
    const apartment = { id: 3, number: '202', owner: 'Yesenia' };

    component.openAddReadingDialog(apartment, 'Gas');

    expect(dialogOpen).toHaveBeenCalledWith(
      AddReadingDialogComponent,
      expect.objectContaining({
        data: { apartment: apartment.number, owner: apartment.owner, service: 'Gas' },
      }),
    );
  });
});
