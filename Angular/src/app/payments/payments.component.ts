import { Component, ChangeDetectionStrategy, Signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { BehaviorSubject, Observable, forkJoin, switchMap, map, of, shareReplay } from 'rxjs';
import { DeadlinesService } from '../deadlines/deadlines.service';
import { OwnerPaymentsService } from '../owner-payments/owner-payments.service';
import { NotificationStatus } from '../notifications/notification.model';
import { OwnerPayment } from '../owner-payments/owner-payment.model';
import { ServiceName } from '../shared/service-name';
import { WaterBillingService } from '../water-billing/water-billing.service';
import { WaterBillDto, WaterBillPeriodDto } from '../water-billing/water-billing.model';
import { MONTH_NAMES } from '../notifications/month-names';
import { AuthService } from '../auth.service';
import { CopCurrencyPipe } from '../shared/cop-currency.pipe';
import { CopCurrencyInputDirective } from '../shared/cop-currency-input.directive';
import { formatCop } from '../shared/cop-currency';
import { LoadingService } from '../loading.service';
import { EmptyStateComponent } from '../shared/empty-state/empty-state.component';
import { LoadingIndicatorComponent } from '../shared/loading-indicator/loading-indicator.component';
import { StatusChipComponent } from '../shared/status-chip/status-chip.component';
import { PageHeaderComponent } from '../shared/page-header/page-header.component';

type OwnerRow = OwnerPayment & { status: NotificationStatus };
type OwnerServiceRow = OwnerRow & { service: ServiceName };

interface Period {
  service: ServiceName;
  month: number;
  year: number;
  /** Agua only - the real Lecturas WaterBill id behind this month/year, so rows$ can fall back to
   *  that bill's live (possibly not-yet-confirmed) per-apartment Total a pagar wherever Pagos has
   *  nothing of its own synced yet (027-align-pagos-facturas only syncs at confirm time). */
  periodId: number | null;
}

interface MonthYear {
  month: number;
  year: number;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
    CopCurrencyPipe,
    CopCurrencyInputDirective,
    EmptyStateComponent,
    LoadingIndicatorComponent,
    StatusChipComponent,
    PageHeaderComponent,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './payments.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './payments.component.css',
})
export class PaymentsComponent {
  protected readonly loadingService = inject(LoadingService);
  readonly services: ServiceName[] = ['Agua', 'Luz', 'Gas', 'Arriendo'];
  readonly monthNames: string[] = MONTH_NAMES;
  readonly years: number[];

  selectedService: ServiceName = 'Agua';
  selectedMonth: number;
  selectedYear: number;

  /** Agua only (mockup `Mockups/pagos-agua-periodo/`): which real Lecturas period is picked,
   *  replacing Mes/Año for this one service - selectedMonth/selectedYear stay the internal plumbing
   *  rows$/deadline$ already key off, resolved from the chosen period's StartDate (027's own anchor
   *  rule), never typed by the admin directly while on Agua. */
  selectedPeriodId: number | null = null;
  private aguaPeriodsSnapshot: WaterBillPeriodDto[] = [];

  private readonly period$: BehaviorSubject<Period>;
  private readonly ownerPeriod$: BehaviorSubject<MonthYear>;
  private readonly aguaPeriodsRefresh$: BehaviorSubject<void>;
  readonly deadline$: Observable<Date | null>;
  readonly rows$: Observable<OwnerRow[]>;
  readonly aguaPeriods$: Observable<WaterBillPeriodDto[]>;
  readonly isReadOnly: boolean;

  /** An arrendatario only ever sees their own apartment (server-scoped
   *  already), so instead of a Servicio filter they get every servicio's
   *  row on one page - grouped by an extra "Servicio" column. */
  readonly ownerServices: ServiceName[] = ['Agua', 'Luz', 'Gas', 'Arriendo'];
  readonly ownerDisplayedColumns: string[] = ['service', 'dueDate', 'status', 'amount'];
  readonly ownerRows$: Observable<OwnerServiceRow[]>;

  private readonly adminRows: Signal<OwnerRow[]>;
  private readonly ownerRowsSnapshot: Signal<OwnerServiceRow[]>;

  constructor(
    private deadlinesService: DeadlinesService,
    private ownerPaymentsService: OwnerPaymentsService,
    private authService: AuthService,
    private waterBillingService: WaterBillingService,
  ) {
    this.isReadOnly = this.authService.isApartmentOwner();
    const now = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear = now.getFullYear();
    this.years = Array.from({ length: 7 }, (_, i) => this.selectedYear - 1 + i);

    this.period$ = new BehaviorSubject<Period>({
      service: this.selectedService,
      month: this.selectedMonth,
      year: this.selectedYear,
      periodId: this.selectedPeriodId,
    });

    this.deadline$ = this.period$.pipe(
      switchMap((p) =>
        p.service === 'Arriendo'
          ? of(null)
          : this.deadlinesService.getDeadline(p.service, p.month, p.year).pipe(map((d) => d?.dueDate ?? null)),
      ),
    );

    // shareReplay(1): both the template's `async` pipe and the adminRows
    // signal below (for the "N pagados de M" stat) subscribe to this - without
    // it, each subscriber would re-trigger the whole HTTP chain separately.
    // Agua rows with no PaymentStatus-synced amount yet (027 only syncs at confirm time) fall
    // back to the selected WaterBill's own live, already-computed Total a pagar per apartment -
    // the exact same number Lecturas already shows before the admin ever clicks Confirmar.
    this.rows$ = this.period$.pipe(
      switchMap((p) =>
        forkJoin([
          this.ownerPaymentsService.getOwnerPayments(p.service, p.month, p.year),
          p.periodId === null ? of(null) : this.waterBillingService.getBill(p.periodId),
        ]),
      ),
      map(([rows, bill]) => this.withLiveAguaAmounts(rows, bill)),
      shareReplay(1),
    );

    // Pagos is month-keyed, but Agua's real billing period (Lecturas) is its own day-precise
    // start/end date (024), often spanning two calendar months - a bare Mes/Año picker made the
    // admin guess which month actually has data (027-align-pagos-facturas's own sync anchors to
    // StartDate's month, research.md §4). Mockup `Mockups/pagos-agua-periodo/`: Agua's Mes/Año
    // pair is replaced by a Periodo picker listing real periods; selecting one resolves
    // selectedMonth/selectedYear internally and reuses the exact same rows$/deadline$ plumbing
    // every other service already has - Luz/Gas/Arriendo are untouched.
    this.aguaPeriodsRefresh$ = new BehaviorSubject<void>(undefined);
    this.aguaPeriods$ = this.aguaPeriodsRefresh$.pipe(
      switchMap(() =>
        this.isReadOnly || this.selectedService !== 'Agua'
          ? of([] as WaterBillPeriodDto[])
          : this.waterBillingService
              .listPeriods()
              .pipe(map((list) => [...list.periods].sort((a, b) => (a.startDate < b.startDate ? 1 : -1)))),
      ),
      shareReplay(1),
    );
    // Auto-pick a period whenever the list (re)loads and the current choice no longer applies:
    // the one starting in the already-selected month/year, else the newest. Switching Servicio TO
    // Agua (onServicioChange) clears selectedPeriodId first so this always re-picks on that
    // transition, not just on a genuinely empty/stale list.
    this.aguaPeriods$.subscribe((periods) => {
      this.aguaPeriodsSnapshot = periods;
      if (this.selectedService !== 'Agua') {
        return;
      }
      if (periods.length === 0) {
        this.selectedPeriodId = null;
        return;
      }
      if (periods.some((p) => p.id === this.selectedPeriodId)) {
        return; // still a valid choice - just refreshed labels (e.g. newly confirmed), keep it
      }
      const match = periods.find((p) => this.periodStartsIn(p, this.selectedMonth, this.selectedYear));
      this.applyAguaPeriod((match ?? periods[0]).id);
    });

    this.ownerPeriod$ = new BehaviorSubject<MonthYear>({ month: this.selectedMonth, year: this.selectedYear });

    this.ownerRows$ = this.ownerPeriod$.pipe(
      switchMap(({ month, year }) =>
        forkJoin(
          this.ownerServices.map((service) =>
            this.ownerPaymentsService
              .getOwnerPayments(service, month, year)
              .pipe(map((rows) => rows.map((row) => ({ ...row, service })))),
          ),
        ).pipe(map((groups) => groups.flat())),
      ),
      shareReplay(1),
    );

    // Only the branch the template actually renders for this role gets
    // subscribed here - the other stream stays untouched, exactly as when
    // only the template's `async` pipe drove these (Admin never touched
    // ownerRows$, an Owner never touched rows$).
    this.adminRows = toSignal(this.isReadOnly ? of([]) : this.rows$, { initialValue: [] as OwnerRow[] });
    this.ownerRowsSnapshot = toSignal(this.isReadOnly ? this.ownerRows$ : of([]), {
      initialValue: [] as OwnerServiceRow[],
    });
  }

  readonly displayedColumns: string[] = ['apartment', 'owner', 'dueDate', 'status', 'amount', 'paid'];

  // Admin sub-heading stat ("N pagados de M") for the selected Servicio/Mes/Año.
  readonly paidCount = computed(() => this.adminRows().filter((r) => r.paid).length);
  readonly totalCount = computed(() => this.adminRows().length);

  // Owner hero ("Pendiente este mes") - ownerRows$ already fetches every
  // servicio for the selected month/year, so no extra request is needed.
  private readonly unpaidOwnerRows = computed(() => this.ownerRowsSnapshot().filter((r) => !r.paid));
  readonly pendienteEsteMes = computed(() =>
    this.unpaidOwnerRows().reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
  );
  readonly pendienteEsteMesFormatted = computed(() => formatCop(this.pendienteEsteMes()));
  readonly conceptosPorPagar = computed(() => this.unpaidOwnerRows().length);
  readonly proximoVencimientoFormatted = computed(() => {
    const rows = this.unpaidOwnerRows();
    if (rows.length === 0) {
      return null;
    }
    const earliest = rows.reduce((min, r) => (r.dueDate < min ? r.dueDate : min), rows[0].dueDate);
    return new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(earliest);
  });

  onPeriodChange(): void {
    this.period$.next({
      service: this.selectedService,
      month: this.selectedMonth,
      year: this.selectedYear,
      periodId: this.selectedService === 'Agua' ? this.selectedPeriodId : null,
    });
    this.ownerPeriod$.next({ month: this.selectedMonth, year: this.selectedYear });
  }

  /** Only fills a row that has nothing of its own yet - a charge already recorded in Pagos (post-
   *  confirm, or admin-typed) is always trusted over the live Lecturas figure, matching 027's own
   *  "re-sync only on a fresh Confirm" precedent (a correction made after confirming intentionally
   *  doesn't retroactively change Pagos until re-confirmed). */
  private withLiveAguaAmounts(rows: OwnerRow[], bill: WaterBillDto | null): OwnerRow[] {
    if (!bill) {
      return rows;
    }
    const liveAmounts = new Map(
      bill.readings.filter((r) => r.apartmentId !== null).map((r) => [r.apartmentId as number, r.finalAmount]),
    );
    return rows.map((row) => (row.amount ? row : { ...row, amount: liveAmounts.get(row.apartmentId) ?? row.amount }));
  }

  /** Servicio select's own change handler: Agua defers to the Periodo picker's own plumbing
   *  (which resolves Mes/Año and calls onPeriodChange itself); every other service keeps calling
   *  onPeriodChange directly, exactly as before this feature. */
  onServicioChange(): void {
    if (this.selectedService === 'Agua') {
      this.selectedPeriodId = null; // forces the aguaPeriods$ subscription to re-pick + reload
      this.refreshAguaPeriods();
    } else {
      this.onPeriodChange();
    }
  }

  /** Periodo select's own change handler. */
  onAguaPeriodChange(periodId: number): void {
    this.applyAguaPeriod(periodId);
  }

  /** Re-fetches the Periodo list - called on Servicio→Agua and whenever the Periodo dropdown is
   *  opened, so a bill confirmed in Lecturas (often a different tab) shows up without a full
   *  Pagos reload, without re-fetching on every unrelated Pagos edit the way a period$-driven
   *  stream would have. */
  refreshAguaPeriods(): void {
    this.aguaPeriodsRefresh$.next();
  }

  private periodStartsIn(period: WaterBillPeriodDto, month: number, year: number): boolean {
    const start = new Date(period.startDate);
    return start.getMonth() + 1 === month && start.getFullYear() === year;
  }

  private applyAguaPeriod(periodId: number): void {
    const period = this.aguaPeriodsSnapshot.find((p) => p.id === periodId);
    if (!period) {
      return;
    }
    this.selectedPeriodId = periodId;
    const start = new Date(period.startDate);
    this.selectedMonth = start.getMonth() + 1;
    this.selectedYear = start.getFullYear();
    this.onPeriodChange();
  }

  saveDeadline(newDate: Date): void {
    this.deadlinesService
      .setDeadline(this.selectedService, this.selectedMonth, this.selectedYear, newDate)
      .subscribe(() => this.onPeriodChange());
  }

  togglePaid(row: OwnerRow, paid: boolean): void {
    this.ownerPaymentsService
      .setPaid(row.apartmentId, this.selectedService, this.selectedMonth, this.selectedYear, paid)
      .subscribe(() => this.onPeriodChange());
  }

  onTogglePaid(row: OwnerRow, event: MatSlideToggleChange): void {
    this.togglePaid(row, event.checked);
  }

  onAmountChange(row: OwnerRow, amount: string): void {
    this.ownerPaymentsService
      .setAmount(row.apartmentId, this.selectedService, this.selectedMonth, this.selectedYear, amount)
      .subscribe(() => this.onPeriodChange());
  }

  /** Snapshot of each row's amount as it was when editing began, keyed by
   *  apartmentId, so onAmountBlur can tell "nothing typed" from "cleared"
   *  and revert to it - row.amount itself gets overwritten live by
   *  onAmountInput while the admin types. Always read-then-deleted in
   *  onAmountBlur, so a stale entry can never linger across edits. */
  private readonly amountBeforeEdit = new Map<number, string | null>();

  onAmountFocus(row: OwnerRow): void {
    this.amountBeforeEdit.set(row.apartmentId, row.amount);
  }

  /** Keystroke-level update only - deliberately does NOT call onAmountChange
   *  (no save, no reload) so the admin isn't fighting a rebuilt table row on
   *  every character. The actual save is committed on blur, in onAmountBlur. */
  onAmountInput(row: OwnerRow, amount: string): void {
    row.amount = amount;
  }

  onAmountBlur(row: OwnerRow): void {
    const before = this.amountBeforeEdit.get(row.apartmentId) ?? null;
    this.amountBeforeEdit.delete(row.apartmentId);

    if (!row.amount) {
      row.amount = before;
      return;
    }
    if (row.amount !== before) {
      this.onAmountChange(row, row.amount);
    }
  }
}
