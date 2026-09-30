import { Observable, forkJoin, map } from 'rxjs';
import { ServiceName } from './service-name';
import { UtilitiesService } from './utilities.service';
import { DatesService } from './dates.service';

/** Shared by DeadlinesService and OwnerPaymentsService - both key their
 *  reads/writes off a resolved {utilityId, dateId} pair for a
 *  (service, month, year) triple, via the same find-or-create pattern. A
 *  pure function taking the two services as arguments, not a class of its
 *  own, since there is no state to hold and no seam anything varies across. */
export function resolveUtilityDateIds(
  utilitiesService: UtilitiesService,
  datesService: DatesService,
  service: ServiceName,
  month: number,
  year: number,
): Observable<{ utilityId: number; dateId: number }> {
  return forkJoin([
    utilitiesService.getOrCreateUtility(service),
    datesService.getOrCreateDate(month, year),
  ]).pipe(map(([utility, date]) => ({ utilityId: utility.id, dateId: date.id })));
}
