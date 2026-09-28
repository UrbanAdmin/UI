import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { AguaCycleDialogComponent } from './agua-cycle-dialog.component';
import { environment } from '../../environments/environment';
import { monthName } from '../notifications/month-names';

describe('AguaCycleDialogComponent', () => {
  let component: AguaCycleDialogComponent;
  let fixture: ComponentFixture<AguaCycleDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let httpMock: HttpTestingController;

  const dialogData = { utilityId: 2 };
  const CYCLE_URL = `${environment.apiUrl}/Utilities/2/BillingCycle`;
  const DATES_URL = `${environment.apiUrl}/Dates`;

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AguaCycleDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AguaCycleDialogComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    httpMock.expectOne(CYCLE_URL).flush(null, { status: 204, statusText: 'No Content' });
    expect(component).toBeTruthy();
  });

  it('defaults the start month to the current calendar month when no cycle exists yet', () => {
    httpMock.expectOne(CYCLE_URL).flush(null, { status: 204, statusText: 'No Content' });

    expect(component.currentCycleStartMonth).toBeNull();
    expect(component.startMonth).toBe(new Date().getMonth() + 1);
  });

  it('fetches the current cycle on init and defaults the start month to it', () => {
    httpMock
      .expectOne(CYCLE_URL)
      .flush({ utilityId: 2, periodLengthMonths: 2, startMonth: 9, effectiveFromMonth: 9, effectiveFromYear: 2026 });

    expect(component.currentCycleStartMonth).toBe(9);
    expect(component.startMonth).toBe(9);
  });

  it('defaults cutoffDay to null when no cycle exists yet', () => {
    httpMock.expectOne(CYCLE_URL).flush(null, { status: 204, statusText: 'No Content' });

    expect(component.cutoffDay).toBeNull();
  });

  it('fetches the current cycle\'s cutoff day on init, for reference only', () => {
    httpMock
      .expectOne(CYCLE_URL)
      .flush({ utilityId: 2, periodLengthMonths: 2, startMonth: 9, effectiveFromMonth: 9, effectiveFromYear: 2026, cutoffDay: 10 });

    expect(component.cutoffDay).toBe(10);
  });

  it('flags an effective date before the current month as past and blocks saving', () => {
    httpMock.expectOne(CYCLE_URL).flush(null, { status: 204, statusText: 'No Content' });

    const now = new Date();
    component.fromMonth = now.getMonth() + 1;
    component.fromYear = now.getFullYear() - 1;

    expect(component.isPast).toBe(true);

    component.save();
    httpMock.expectNone(CYCLE_URL);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('does not flag the current calendar month as past', () => {
    httpMock.expectOne(CYCLE_URL).flush(null, { status: 204, statusText: 'No Content' });

    const now = new Date();
    component.fromMonth = now.getMonth() + 1;
    component.fromYear = now.getFullYear();

    expect(component.isPast).toBe(false);
  });

  it('saves the new cycle with a null cutoffDay when none was entered, and closes with true', () => {
    httpMock.expectOne(CYCLE_URL).flush(null, { status: 204, statusText: 'No Content' });

    component.startMonth = 9;
    component.fromMonth = 11;
    component.fromYear = 2026;
    component.save();

    // The Backend takes an already-resolved Date_Id, not a raw month/year
    // pair - the dialog must find-or-create it first, the same pattern
    // already used for Deadlines/PaymentStatuses.
    httpMock.expectOne(DATES_URL).flush([{ id: 77, month: 'Noviembre', year: '2026' }]);

    const postReq = httpMock.expectOne(CYCLE_URL);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ periodLengthMonths: 2, startMonth: 9, effectiveFromDateId: 77, cutoffDay: null });
    postReq.flush({ utilityId: 2, periodLengthMonths: 2, startMonth: 9, effectiveFromDateId: 77, effectiveFromMonth: 11, effectiveFromYear: 2026, cutoffDay: null });

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('saves the entered cutoff day', () => {
    httpMock.expectOne(CYCLE_URL).flush(null, { status: 204, statusText: 'No Content' });

    component.startMonth = 9;
    component.fromMonth = 11;
    component.fromYear = 2026;
    component.cutoffDay = 10;
    component.save();

    httpMock.expectOne(DATES_URL).flush([{ id: 77, month: 'Noviembre', year: '2026' }]);

    const postReq = httpMock.expectOne(CYCLE_URL);
    expect(postReq.request.body).toEqual({ periodLengthMonths: 2, startMonth: 9, effectiveFromDateId: 77, cutoffDay: 10 });
    postReq.flush({ utilityId: 2, periodLengthMonths: 2, startMonth: 9, effectiveFromDateId: 77, effectiveFromMonth: 11, effectiveFromYear: 2026, cutoffDay: 10 });

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('shows the server error message and does not close when saving fails', () => {
    httpMock.expectOne(CYCLE_URL).flush(null, { status: 204, statusText: 'No Content' });

    const now = new Date();
    component.fromMonth = now.getMonth() + 1;
    component.fromYear = now.getFullYear();
    component.save();

    httpMock.expectOne(DATES_URL).flush([{ id: 5, month: monthName(component.fromMonth), year: String(component.fromYear) }]);

    const postReq = httpMock.expectOne(CYCLE_URL);
    postReq.flush('La fecha efectiva no puede ser anterior al mes actual.', { status: 400, statusText: 'Bad Request' });

    expect(component.errorMessage()).toBe('La fecha efectiva no puede ser anterior al mes actual.');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('cancel closes the dialog with false', () => {
    httpMock.expectOne(CYCLE_URL).flush(null, { status: 204, statusText: 'No Content' });

    component.cancel();

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
