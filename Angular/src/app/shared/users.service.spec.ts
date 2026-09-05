import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { UsersService } from './users.service';
import { User } from './user.model';
import { environment } from '../../environments/environment';

describe('UsersService', () => {
  let service: UsersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UsersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getUsers returns the users from GET /Users', () => {
    const users: User[] = [
      { id: 1, username: 'admin', role: 'Admin', apartmentId: null },
      { id: 2, username: 'owner101', role: 'ApartmentOwner', apartmentId: 1 },
    ];
    let result: User[] | undefined;

    service.getUsers().subscribe((r) => (result = r));
    httpMock.expectOne(`${environment.apiUrl}/Users`).flush(users);

    expect(result).toEqual(users);
  });

  it('caches the result so a second subscriber does not trigger another HTTP call', () => {
    service.getUsers().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Users`).flush([]);

    let second: User[] | undefined;
    service.getUsers().subscribe((r) => (second = r));

    expect(second).toEqual([]);
  });

  it('createUser POSTs the new account and invalidates the cache', () => {
    service.getUsers().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Users`).flush([]);

    service.createUser('owner101', 'Password1!', 'ApartmentOwner', 1).subscribe();
    const postReq = httpMock.expectOne(`${environment.apiUrl}/Users`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ Username: 'owner101', Password: 'Password1!', Role: 'ApartmentOwner', ApartmentId: 1 });
    postReq.flush({ success: true, userId: 2, error: null });

    service.getUsers().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Users`).flush([]);
  });

  it('updateUser PUTs to /User/{id} and invalidates the cache', () => {
    service.getUsers().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Users`).flush([]);

    service.updateUser(2, 'ApartmentOwner', 3, null).subscribe();
    const putReq = httpMock.expectOne(`${environment.apiUrl}/User/2`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ Role: 'ApartmentOwner', ApartmentId: 3, NewPassword: null });
    putReq.flush({ success: true, error: null });

    service.getUsers().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Users`).flush([]);
  });

  it('deleteUser DELETEs /User/{id} and invalidates the cache', () => {
    service.getUsers().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Users`).flush([]);

    service.deleteUser(2).subscribe();
    const deleteReq = httpMock.expectOne(`${environment.apiUrl}/User/2`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);

    service.getUsers().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Users`).flush([]);
  });
});
