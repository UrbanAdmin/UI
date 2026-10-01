import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

/** Wire shape of GET /admin/cartera - see
 *  specs/012-cartera-vencida-timeline/contracts/admin-cartera-api.md. Every charge here is
 *  already unpaid (the scan never returns a paid one) and spans every period with real data, not
 *  just the current month - Charges is overdue (due date before today), UpcomingCharges is "por
 *  vencer" (due today or later), kept separate per month (FR-021). */
export interface CarteraChargeDto {
  apartmentId: number;
  apartmentNumber: string;
  owner: string | null;
  service: string;
  isRent: boolean;
  amount: number | null;
  dueDate: string;
  daysOverdue: number;
  recorded: boolean;
  daysUntilDue: number | null;
}

export interface CarteraMonthDto {
  month: number;
  year: number;
  charges: CarteraChargeDto[];
  upcomingCharges: CarteraChargeDto[];
}

export interface CarteraYearDto {
  year: number;
  months: CarteraMonthDto[];
}

export interface CarteraDto {
  totalServicios: number;
  totalArriendo: number;
  total: number;
  chargeCount: number;
  apartmentCount: number;
  years: CarteraYearDto[];
}

@Injectable({ providedIn: 'root' })
export class CarteraService {
  private readonly http = inject(HttpClient);

  getCartera(): Observable<CarteraDto> {
    return this.http.get<CarteraDto>(`${environment.apiUrl}/admin/cartera`);
  }
}
