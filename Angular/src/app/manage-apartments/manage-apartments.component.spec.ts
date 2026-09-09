import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { of, map } from 'rxjs';

import { ManageApartmentsComponent } from './manage-apartments.component';
import { ApartmentsService } from '../shared/apartments.service';
import { environment } from '../../environments/environment';

describe('ManageApartmentsComponent', () => {
  let component: ManageApartmentsComponent;
  let fixture: ComponentFixture<ManageApartmentsComponent>;
  let httpMock: HttpTestingController;
  let dialogOpen: ReturnType<typeof vi.fn>;

  const APARTMENTS_URL = `${environment.apiUrl}/Apartments`;
  const CONTRACT_FIELDS = { contractStartDate: null, hasContract: false, contractFileName: null, status: 'Arrendado' as const };
  const MOCK_APARTMENTS = [
    { id: 1, name: '101', owner: 'Eduardo', ...CONTRACT_FIELDS },
    { id: 2, name: '201', owner: 'Hilda', ...CONTRACT_FIELDS },
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
      { id: 1, number: '101', owner: 'Eduardo', ...CONTRACT_FIELDS },
      { id: 2, number: '201', owner: 'Hilda', ...CONTRACT_FIELDS },
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
    const apartment = { id: 2, number: '201', owner: 'Hilda', ...CONTRACT_FIELDS };

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

  it('refreshes the table with the newly created apartment, following the real dialog save sequencing', () => {
    // Mirrors what ApartmentDialogComponent.save() does: call the real
    // ApartmentsService.createApartment() (which nulls the cache in its own
    // tap) and only close(true) once that completes. MatDialog's real
    // afterClosed() fires from outside NgZone (its close animation runs via
    // runOutsideAngular) - this catches a regression of that zone bug,
    // which the other tests here (stubbing afterClosed with a bare of(true))
    // can't, since they never leave the zone in the first place.
    const apartmentsService = TestBed.inject(ApartmentsService);
    dialogOpen.mockReturnValue({
      afterClosed: () => apartmentsService.createApartment('303', 'Nueva', null, 'Arrendado').pipe(map(() => true)),
    });

    component.openCreateDialog();

    const postReq = httpMock.expectOne(APARTMENTS_URL);
    expect(postReq.request.method).toBe('POST');
    postReq.flush({ success: true });
    fixture.detectChanges();

    const updatedApartments = [...MOCK_APARTMENTS, { id: 3, name: '303', owner: 'Nueva', ...CONTRACT_FIELDS }];
    const getReq = httpMock.expectOne(APARTMENTS_URL);
    expect(getReq.request.method).toBe('GET');
    getReq.flush(updatedApartments);

    let rows: unknown[] | undefined;
    component.apartments$.subscribe((apartments) => (rows = apartments));
    expect(rows).toEqual(updatedApartments.map((a) => ({ id: a.id, number: a.name, owner: a.owner, ...CONTRACT_FIELDS })));
  });

  it('deleteApartment asks for confirmation, then DELETEs and refreshes', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.deleteApartment({ id: 2, number: '201', owner: 'Hilda', ...CONTRACT_FIELDS });

    expect(confirmSpy).toHaveBeenCalled();
    httpMock.expectOne(`${environment.apiUrl}/Apartment/2`).flush(null);

    let rows: unknown[] | undefined;
    component.apartments$.subscribe((apartments) => (rows = apartments));
    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);

    expect(rows?.length).toBe(2);
  });

  it('deleteApartment does nothing when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.deleteApartment({ id: 2, number: '201', owner: 'Hilda', ...CONTRACT_FIELDS });

    httpMock.expectNone(`${environment.apiUrl}/Apartment/2`);
  });

  it('renders an Estado column with each apartment\'s status', () => {
    fixture.detectChanges();

    const cells: string[] = Array.from(fixture.nativeElement.querySelectorAll('td.mat-column-status')).map(
      (el) => (el as HTMLElement).textContent?.trim() ?? '',
    );

    expect(cells).toEqual(['Arrendado', 'Arrendado']);
  });

  it('shows "Sin arrendatario" instead of a blank Owner cell for a vacant apartment with no owner', () => {
    component.apartments$ = of([
      { id: 4, number: '401', owner: '', contractStartDate: null, hasContract: false, contractFileName: null, status: 'No arrendado' },
    ]);
    fixture.detectChanges();

    const ownerCell = fixture.nativeElement.querySelector('td.mat-column-owner') as HTMLElement;
    expect(ownerCell.textContent?.trim()).toBe('Sin arrendatario');
  });

  it('viewContract downloads the contract and opens it in a new tab', () => {
    const objectUrl = 'blob:fake-url';
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(objectUrl);
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    component.viewContract({ id: 2, number: '201', owner: 'Hilda', ...CONTRACT_FIELDS });

    httpMock.expectOne(`${environment.apiUrl}/Apartments/2/Contract`).flush(new Blob(['contents']));

    expect(openSpy).toHaveBeenCalledWith(objectUrl, '_blank');
  });
});
