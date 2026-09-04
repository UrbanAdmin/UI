import { Injectable } from '@angular/core';
import { APARTMENTS } from '../shared/apartments';
import { ServiceName } from '../notifications/notification.model';
import { MeterReading } from './reading.model';

const SERVICES: ServiceName[] = ['Agua', 'Luz', 'Gas'];

@Injectable({ providedIn: 'root' })
export class ReadingsService {
  private readonly readings: MeterReading[] = [];

  constructor() {
    this.seedMockData();
  }

  getReadings(apartment: string, service: ServiceName): MeterReading[] {
    const owner = APARTMENTS.find((a) => a.number === apartment)?.owner ?? '';
    const year = new Date().getFullYear();

    const rows: MeterReading[] = [];
    for (let month = 1; month <= 12; month++) {
      const existing = this.readings.find(
        (r) => r.apartment === apartment && r.service === service && r.month === month && r.year === year,
      );
      rows.push(
        existing ?? {
          apartment,
          owner,
          service,
          month,
          year,
          counterValue: null,
          evidenceFileName: null,
        },
      );
    }
    return rows;
  }

  recordReading(
    apartment: string,
    service: ServiceName,
    month: number,
    year: number,
    counterValue: number | null,
    evidenceFileName: string | null,
  ): void {
    const owner = APARTMENTS.find((a) => a.number === apartment)?.owner ?? '';
    const existing = this.readings.find(
      (r) => r.apartment === apartment && r.service === service && r.month === month && r.year === year,
    );
    if (existing) {
      existing.counterValue = counterValue;
      existing.evidenceFileName = evidenceFileName;
    } else {
      this.readings.push({ apartment, owner, service, month, year, counterValue, evidenceFileName });
    }
  }

  private seedMockData(): void {
    const now = new Date();
    const year = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const previousMonths = [currentMonth - 2, currentMonth - 1].filter((m) => m >= 1);

    let counter = 100;
    for (const apartment of APARTMENTS) {
      for (const service of SERVICES) {
        for (const month of previousMonths) {
          counter += 12;
          this.recordReading(apartment.number, service, month, year, counter, `lectura-${apartment.number}-${service}-${month}.jpg`);
        }
      }
    }
  }
}
