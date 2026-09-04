import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ManageApartmentsComponent } from './manage-apartments.component';
import { ApartmentsService } from '../shared/apartments.service';
import { environment } from '../../environments/environment';

describe('ManageApartmentsComponent', () => {
  let component: ManageApartmentsComponent;
  let fixture: ComponentFixture<ManageApartmentsComponent>;
  let httpMock: HttpTestingController;
  let dialogOpen: ReturnType<typeof vi.fn>;

  const APARTMENTS_URL = `${environment.apiUrl}/Apartments`;
  const MOCK_APARTMENTS = [
    { id: 1, name: '101', owner: 'Eduardo' },
    { id: 2, name: '201', owner: 'Hilda' },
  ];

  beforeEach(async () => {
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(false) });

    await TestBed.configureTestingModule({
      imports: [ManageApartmentsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageApartmentsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists the apartments from the backend', () => {
    let rows: unknown[] | undefined;
    component.apartments$.subscribe((apartments) => (rows = apartments));

    expect(rows).toEqual([
      { id: 1, number: '101', owner: 'Eduardo' },
      { id: 2, number: '201', owner: 'Hilda' },
    ]);
  });

  it('openCreateDialog opens the dialog in create mode and re-reads apartments$ on save', () => {
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });
    const apartmentsService = TestBed.inject(ApartmentsService);
    const getApartmentsSpy = vi.spyOn(apartmentsService, 'getApartments');

    component.openCreateDialog();

    expect(dialogOpen).toHaveBeenCalled();
    const dialogArgs = dialogOpen.mock.calls[0][1];
    expect(dialogArgs.data).toEqual({ apartment: null });
    expect(getApartmentsSpy).toHaveBeenCalledTimes(1);
  });

  it('openEditDialog opens the dialog with the apartment and re-reads apartments$ on save', () => {
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });
    const apartmentsService = TestBed.inject(ApartmentsService);
    const getApartmentsSpy = vi.spyOn(apartmentsService, 'getApartments');
    const apartment = { id: 2, number: '201', owner: 'Hilda' };

    component.openEditDialog(apartment);

    const dialogArgs = dialogOpen.mock.calls[0][1];
    expect(dialogArgs.data).toEqual({ apartment });
    expect(getApartmentsSpy).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when the dialog is closed without saving', () => {
    const apartmentsService = TestBed.inject(ApartmentsService);
    const getApartmentsSpy = vi.spyOn(apartmentsService, 'getApartments');

    component.openCreateDialog();

    expect(getApartmentsSpy).not.toHaveBeenCalled();
  });

  it('deleteApartment asks for confirmation, then DELETEs and refreshes', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.deleteApartment({ id: 2, number: '201', owner: 'Hilda' });

    expect(confirmSpy).toHaveBeenCalled();
    httpMock.expectOne(`${environment.apiUrl}/Apartment/2`).flush(null);

    let rows: unknown[] | undefined;
    component.apartments$.subscribe((apartments) => (rows = apartments));
    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);

    expect(rows?.length).toBe(2);
  });

  it('deleteApartment does nothing when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.deleteApartment({ id: 2, number: '201', owner: 'Hilda' });

    httpMock.expectNone(`${environment.apiUrl}/Apartment/2`);
  });
});
