import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { BillingPeriodsService } from './billing-periods.service';
import { environment } from '../../environments/environment';

describe('BillingPeriodsService', () => {
  let service: BillingPeriodsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BillingPeriodsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getBillingPeriods falls back to one plain period per calendar month when the request fails, instead of erroring', () => {
    let result: { anchorMonth: number; secondMonth: number | null }[] | undefined;
    let erroredOut = false;
    service.getBillingPeriods(2, 2026).subscribe({ next: (periods) => (result = periods), error: () => (erroredOut = true) });

    httpMock
      .expectOne(`${environment.apiUrl}/Utilities/2/BillingPeriods?year=2026`)
      .flush('Internal Server Error', { status: 500, statusText: 'Server Error' });

    expect(erroredOut).toBe(false);
    expect(result?.length).toBe(12);
    expect(result?.every((p) => p.secondMonth === null)).toBe(true);
  });

  it('caches the fallback so a failed request is not retried on every re-subscription', () => {
    service.getBillingPeriods(2, 2026).subscribe();
    httpMock
      .expectOne(`${environment.apiUrl}/Utilities/2/BillingPeriods?year=2026`)
      .flush('Internal Server Error', { status: 500, statusText: 'Server Error' });

    // A second subscription (e.g. Angular's async pipe re-subscribing after
    // the first emission) must replay the cached fallback, not fire another
    // request - this is exactly the shareReplay+async-pipe interaction that
    // otherwise turns one backend failure into an infinite request loop.
    service.getBillingPeriods(2, 2026).subscribe();
    httpMock.expectNone(`${environment.apiUrl}/Utilities/2/BillingPeriods?year=2026`);
  });

  it('getBillingCycle returns the configured cycle', () => {
    let result: { startMonth: number } | null | undefined;
    service.getBillingCycle(2).subscribe((cycle) => (result = cycle));

    httpMock
      .expectOne(`${environment.apiUrl}/Utilities/2/BillingCycle`)
      .flush({ utilityId: 2, periodLengthMonths: 2, startMonth: 9, effectiveFromMonth: 9, effectiveFromYear: 2026 });

    expect(result?.startMonth).toBe(9);
  });

  it('getBillingCycle returns null when the utility has no configured cycle (204 No Content)', () => {
    let result: { startMonth: number } | null | undefined = undefined;
    service.getBillingCycle(3).subscribe((cycle) => (result = cycle));

    httpMock.expectOne(`${environment.apiUrl}/Utilities/3/BillingCycle`).flush(null, { status: 204, statusText: 'No Content' });

    expect(result).toBeNull();
  });

  it('setBillingCycle POSTs the new cycle and invalidates the cached billing periods', () => {
    // Prime the periods cache for utility 2/2026, then confirm it's
    // refetched (not replayed) after setBillingCycle - a stale cached
    // period list would keep showing the old pairing after a save.
    service.getBillingPeriods(2, 2026).subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Utilities/2/BillingPeriods?year=2026`).flush({ utilityId: 2, periods: [] });

    let result: { startMonth: number } | undefined;
    service
      .setBillingCycle(2, { periodLengthMonths: 2, startMonth: 9, effectiveFromDateId: 42 })
      .subscribe((cycle) => (result = cycle));

    const postReq = httpMock.expectOne(`${environment.apiUrl}/Utilities/2/BillingCycle`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ periodLengthMonths: 2, startMonth: 9, effectiveFromDateId: 42 });
    postReq.flush({ utilityId: 2, periodLengthMonths: 2, startMonth: 9, effectiveFromDateId: 42, effectiveFromMonth: 11, effectiveFromYear: 2026 });
    expect(result?.startMonth).toBe(9);

    service.getBillingPeriods(2, 2026).subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Utilities/2/BillingPeriods?year=2026`).flush({ utilityId: 2, periods: [] });
  });

  it('clearCache forces the next BillingPeriods read to refetch instead of replaying stale data', () => {
    service.getBillingPeriods(2, 2026).subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Utilities/2/BillingPeriods?year=2026`).flush({ utilityId: 2, periods: [] });

    service.clearCache();

    service.getBillingPeriods(2, 2026).subscribe();
    httpMock.expectOne(`${environment.apiUrl}/Utilities/2/BillingPeriods?year=2026`).flush({ utilityId: 2, periods: [] });
  });
});
