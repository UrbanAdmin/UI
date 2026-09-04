import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { AddManualReadingDialogComponent } from './add-manual-reading-dialog.component';
import { ReadingsService } from '../readings/readings.service';

describe('AddManualReadingDialogComponent', () => {
  let component: AddManualReadingDialogComponent;
  let fixture: ComponentFixture<AddManualReadingDialogComponent>;
  let readingsService: ReadingsService;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const dialogData = { apartment: '201', owner: 'Bryan', service: 'Agua' as const };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AddManualReadingDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddManualReadingDialogComponent);
    component = fixture.componentInstance;
    readingsService = TestBed.inject(ReadingsService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the apartment and service from dialog data', () => {
    expect(component.data.apartment).toBe('201');
    expect(component.data.service).toBe('Agua');
  });

  it('save should record the reading and close the dialog', () => {
    component.month = 5;
    component.counterValue = 777;

    component.save();

    const row = readingsService.getReadings('201', 'Agua').find((r) => r.month === 5);
    expect(row?.counterValue).toBe(777);
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
