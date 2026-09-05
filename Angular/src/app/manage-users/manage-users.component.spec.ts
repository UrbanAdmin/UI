import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { ManageUsersComponent } from './manage-users.component';
import { UsersService } from '../shared/users.service';
import { environment } from '../../environments/environment';

describe('ManageUsersComponent', () => {
  let component: ManageUsersComponent;
  let fixture: ComponentFixture<ManageUsersComponent>;
  let httpMock: HttpTestingController;
  let dialogOpen: ReturnType<typeof vi.fn>;

  const USERS_URL = `${environment.apiUrl}/Users`;
  const APARTMENTS_URL = `${environment.apiUrl}/Apartments`;
  const CONTRACT_FIELDS = { contractStartDate: null, hasContract: false, contractFileName: null };
  const MOCK_APARTMENTS = [
    { id: 1, name: '101', owner: 'Eduardo', ...CONTRACT_FIELDS },
    { id: 2, name: '201', owner: 'Hilda', ...CONTRACT_FIELDS },
  ];
  const MOCK_USERS = [
    { id: 1, username: 'admin', role: 'Admin', apartmentId: null },
    { id: 2, username: 'owner101', role: 'ApartmentOwner', apartmentId: 1 },
  ];

  beforeEach(async () => {
    dialogOpen = vi.fn().mockReturnValue({ afterClosed: () => of(false) });

    await TestBed.configureTestingModule({
      imports: [ManageUsersComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialog, useValue: { open: dialogOpen } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageUsersComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    httpMock.expectOne(USERS_URL).flush(MOCK_USERS);
    httpMock.expectOne(APARTMENTS_URL).flush(MOCK_APARTMENTS);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('lists the users from the backend', () => {
    let rows: unknown[] | undefined;
    component.users$.subscribe((users) => (rows = users));

    expect(rows).toEqual(MOCK_USERS);
  });

  it('apartmentNumber resolves an ApartmentOwner apartmentId to its number', () => {
    expect(component.apartmentNumber(1)).toBe('101');
  });

  it('apartmentNumber returns a dash for an Admin (no apartment)', () => {
    expect(component.apartmentNumber(null)).toBe('—');
  });

  it('openCreateDialog opens the dialog in create mode and re-reads users$ on save', () => {
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });
    const usersService = TestBed.inject(UsersService);
    const getUsersSpy = vi.spyOn(usersService, 'getUsers');

    component.openCreateDialog();

    expect(dialogOpen).toHaveBeenCalled();
    const dialogArgs = dialogOpen.mock.calls[0][1];
    expect(dialogArgs.data).toEqual({ user: null });
    expect(getUsersSpy).toHaveBeenCalledTimes(1);
  });

  it('openEditDialog opens the dialog with the user and re-reads users$ on save', () => {
    dialogOpen.mockReturnValue({ afterClosed: () => of(true) });
    const usersService = TestBed.inject(UsersService);
    const getUsersSpy = vi.spyOn(usersService, 'getUsers');
    const user = MOCK_USERS[1];

    component.openEditDialog(user);

    const dialogArgs = dialogOpen.mock.calls[0][1];
    expect(dialogArgs.data).toEqual({ user });
    expect(getUsersSpy).toHaveBeenCalledTimes(1);
  });

  it('deleteUser asks for confirmation, then DELETEs and refreshes', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.deleteUser(MOCK_USERS[1]);

    httpMock.expectOne(`${environment.apiUrl}/User/2`).flush(null);

    let rows: unknown[] | undefined;
    component.users$.subscribe((users) => (rows = users));
    httpMock.expectOne(USERS_URL).flush(MOCK_USERS);

    expect(rows?.length).toBe(2);
  });

  it('deleteUser does nothing when the confirmation is declined', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.deleteUser(MOCK_USERS[1]);

    httpMock.expectNone(`${environment.apiUrl}/User/2`);
  });

  it('deleteUser surfaces the backend error (e.g. deleting your own account) instead of failing silently', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    component.deleteUser(MOCK_USERS[0]);

    httpMock.expectOne(`${environment.apiUrl}/User/1`).flush('You cannot delete your own account', { status: 400, statusText: 'Bad Request' });

    expect(alertSpy).toHaveBeenCalledWith('You cannot delete your own account');
  });
});
