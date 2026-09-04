import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../environments/environment';
import { Apartment, ApartmentDto } from './apartment.model';

@Injectable({ providedIn: 'root' })
export class ApartmentsService {
  private readonly http = inject(HttpClient);

  private readonly apartments$: Observable<Apartment[]> = this.http
    .get<ApartmentDto[]>(`${environment.apiUrl}/Apartments`)
    .pipe(
      map((dtos) => dtos.map((dto) => ({ id: dto.id, number: dto.name, owner: dto.owner }))),
      shareReplay(1),
    );

  getApartments(): Observable<Apartment[]> {
    return this.apartments$;
  }
}
