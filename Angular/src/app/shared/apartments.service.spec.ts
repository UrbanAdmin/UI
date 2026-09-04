import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { ApartmentsService } from './apartments.service';
import { ApartmentDto } from './apartment.model';
import { environment } from '../../environments/environment';

describe('ApartmentsService', () => {
  let service: ApartmentsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApartmentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('maps ApartmentDto (id/name/owner) to Apartment (id/number/owner)', () => {
    const dtos: ApartmentDto[] = [{ id: 1, name: '101', owner: 'Daniel' }];
    let result: { id: number; number: string; owner: string }[] | undefined;

    service.getApartments().subscribe((apartments) => (result = apartments));
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(dtos);

    expect(result).toEqual([{ id: 1, number: '101', owner: 'Daniel' }]);
  });

  it('caches the result so a second subscriber does not trigger another HTTP call', () => {
    const dtos: ApartmentDto[] = [{ id: 1, name: '101', owner: 'Daniel' }];
    let second: unknown[] | undefined;

    service.getApartments().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush(dtos);

    service.getApartments().subscribe((apartments) => (second = apartments));

    expect(second?.length).toBe(1);
  });

  it('createApartment POSTs the raw entity shape and invalidates the cache', () => {
    service.getApartments().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush([]);

    service.createApartment('501', 'Nueva').subscribe();
    const postReq = httpMock.expectOne(`${environment.apiUrl}/Apartments`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ Name: '501', Owner: 'Nueva' });
    postReq.flush({ id: 0 });

    let result: unknown[] | undefined;
    service.getApartments().subscribe((apartments) => (result = apartments));
    httpMock
      .expectOne(`${environment.apiUrl}/Apartments`)
      .flush([{ id: 7, name: '501', owner: 'Nueva' }]);

    expect(result).toEqual([{ id: 7, number: '501', owner: 'Nueva' }]);
  });

  it('updateApartment PUTs to /Apartment/{id} and invalidates the cache', () => {
    service.getApartments().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush([]);

    service.updateApartment(3, '301', 'Oscar').subscribe();
    const putReq = httpMock.expectOne(`${environment.apiUrl}/Apartment/3`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ Name: '301', Owner: 'Oscar' });
    putReq.flush({ id: 3, name: '301', owner: 'Oscar' });

    service.getApartments().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush([]);
  });

  it('deleteApartment DELETEs /Apartment/{id} and invalidates the cache', () => {
    service.getApartments().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush([]);

    service.deleteApartment(3).subscribe();
    const deleteReq = httpMock.expectOne(`${environment.apiUrl}/Apartment/3`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);

    service.getApartments().subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush([]);
  });
});
