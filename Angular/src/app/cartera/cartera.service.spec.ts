import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { CarteraService, CarteraDto } from './cartera.service';
import { environment } from '../../environments/environment';

describe('CarteraService', () => {
  let service: CarteraService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CarteraService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getCartera GETs /admin/cartera and returns the parsed response', () => {
    const response: CarteraDto = {
      totalServicios: 50000,
      totalArriendo: 1600000,
      total: 1650000,
      chargeCount: 2,
      apartmentCount: 2,
      years: [
        {
          year: 2026,
          months: [
            {
              month: 10,
              year: 2026,
              charges: [
                {
                  apartmentId: 1,
                  apartmentNumber: '101',
                  owner: 'Ana',
                  service: 'Gas',
                  isRent: false,
                  amount: 50000,
                  dueDate: '2026-09-15T00:00:00',
                  daysOverdue: 16,
                  recorded: true,
                  daysUntilDue: null,
                },
              ],
              upcomingCharges: [],
            },
          ],
        },
      ],
    };
    let result: CarteraDto | undefined;

    service.getCartera().subscribe((r) => (result = r));

    const req = httpMock.expectOne(`${environment.apiUrl}/admin/cartera`);
    expect(req.request.method).toBe('GET');
    req.flush(response);

    expect(result).toEqual(response);
  });
});
