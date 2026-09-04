import { TestBed } from '@angular/core/testing';

import { LoadingService } from './loading.service';

describe('LoadingService', () => {
  let service: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingService);
  });

  it('starts as not loading', () => {
    expect(service.isLoading()).toBe(false);
  });

  it('is loading after start()', () => {
    service.start();
    expect(service.isLoading()).toBe(true);
  });

  it('stays loading while a second in-flight request has not finished', () => {
    service.start();
    service.start();
    service.stop();

    expect(service.isLoading()).toBe(true);
  });

  it('is not loading once every started request has stopped', () => {
    service.start();
    service.start();
    service.stop();
    service.stop();

    expect(service.isLoading()).toBe(false);
  });

  it('does not go negative if stop() is called without a matching start()', () => {
    service.stop();
    service.start();

    expect(service.isLoading()).toBe(true);
  });
});
