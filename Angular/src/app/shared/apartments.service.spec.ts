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
});
