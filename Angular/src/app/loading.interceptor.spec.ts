import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { loadingInterceptor } from './loading.interceptor';
import { LoadingService } from './loading.service';

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let loadingService: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    loadingService = TestBed.inject(LoadingService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('is loading while a request is pending and stops once it succeeds', () => {
    http.get('/data').subscribe();

    expect(loadingService.isLoading()).toBe(true);

    httpMock.expectOne('/data').flush({});

    expect(loadingService.isLoading()).toBe(false);
  });

  it('stops loading even when the request fails', () => {
    http.get('/data').subscribe({ error: () => {} });

    expect(loadingService.isLoading()).toBe(true);

    httpMock.expectOne('/data').flush({}, { status: 500, statusText: 'Server Error' });

    expect(loadingService.isLoading()).toBe(false);
  });

  it('stays loading while any of several concurrent requests is still pending', () => {
    http.get('/a').subscribe();
    http.get('/b').subscribe();

    httpMock.expectOne('/a').flush({});
    expect(loadingService.isLoading()).toBe(true);

    httpMock.expectOne('/b').flush({});
    expect(loadingService.isLoading()).toBe(false);
  });
});
