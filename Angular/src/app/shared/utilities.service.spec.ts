import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { UtilitiesService } from './utilities.service';
import { UtilityDto } from './utility.model';
import { environment } from '../../environments/environment';

describe('UtilitiesService', () => {
  let service: UtilitiesService;
  let httpMock: HttpTestingController;
  const utilitiesUrl = `${environment.apiUrl}/Utilities`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(UtilitiesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('returns the existing utility without POSTing when the name already exists', () => {
    const existing: UtilityDto[] = [{ id: 1, name: 'Agua' }, { id: 2, name: 'Luz' }];
    let result: UtilityDto | undefined;

    service.getOrCreateUtility('Agua').subscribe((u) => (result = u));
    httpMock.expectOne(utilitiesUrl).flush(existing);

    expect(result).toEqual({ id: 1, name: 'Agua' });
  });

  it('creates and refetches when the name does not exist yet', () => {
    let result: UtilityDto | undefined;

    service.getOrCreateUtility('Internet').subscribe((u) => (result = u));

    httpMock.expectOne(utilitiesUrl).flush([{ id: 1, name: 'Agua' }]);
    const postReq = httpMock.expectOne(utilitiesUrl);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ name: 'Internet' });
    postReq.flush({ id: 0, name: 'Internet' });

    httpMock.expectOne(utilitiesUrl).flush([{ id: 1, name: 'Agua' }, { id: 4, name: 'Internet' }]);

    expect(result).toEqual({ id: 4, name: 'Internet' });
  });

  it('caches getUtilities() so a second call does not refetch', () => {
    service.getUtilities().subscribe();
    httpMock.expectOne(utilitiesUrl).flush([{ id: 1, name: 'Agua' }]);

    service.getUtilities().subscribe();
    httpMock.expectNone(utilitiesUrl);
  });
});
