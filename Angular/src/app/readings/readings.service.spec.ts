import { TestBed } from '@angular/core/testing';
import { ReadingsService } from './readings.service';

describe('ReadingsService', () => {
  let service: ReadingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReadingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('getReadings should return all 12 months of the current year for an apartment/service', () => {
    const rows = service.getReadings('201', 'Agua');
    expect(rows.length).toBe(12);
    expect(rows.every((r) => r.year === new Date().getFullYear())).toBe(true);
    expect(rows.map((r) => r.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('getReadings should default unrecorded months to null values', () => {
    const rows = service.getReadings('101', 'Luz');
    const farFutureMonth = rows.find((r) => r.month === 12);
    expect(farFutureMonth?.counterValue).toBeNull();
    expect(farFutureMonth?.evidenceFileName).toBeNull();
  });

  it('recordReading should upsert a reading and be reflected by getReadings', () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    service.recordReading('301', 'Gas', month, year, 543, 'foto.jpg');

    const row = service.getReadings('301', 'Gas').find((r) => r.month === month);
    expect(row?.counterValue).toBe(543);
    expect(row?.evidenceFileName).toBe('foto.jpg');

    service.recordReading('301', 'Gas', month, year, 600, null);
    const updated = service.getReadings('301', 'Gas').find((r) => r.month === month);
    expect(updated?.counterValue).toBe(600);
    expect(updated?.evidenceFileName).toBeNull();
  });
});
