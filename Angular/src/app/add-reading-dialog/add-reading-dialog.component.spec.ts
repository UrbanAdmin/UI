import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { AddReadingDialogComponent } from './add-reading-dialog.component';
import { ReadingsService } from '../readings/readings.service';

describe('AddReadingDialogComponent', () => {
  let component: AddReadingDialogComponent;
  let fixture: ComponentFixture<AddReadingDialogComponent>;
  let readingsService: ReadingsService;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const dialogData = { apartment: '202', owner: 'Yesenia', service: 'Luz' as const };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AddReadingDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddReadingDialogComponent);
    component = fixture.componentInstance;
    readingsService = TestBed.inject(ReadingsService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show the apartment and service from dialog data', () => {
    expect(component.data.apartment).toBe('202');
    expect(component.data.service).toBe('Luz');
  });

  it('onFileSelected should store the chosen file name', () => {
    const file = new File(['content'], 'medidor.png', { type: 'image/png' });
    component.onFileSelected({ target: { files: [file] } } as unknown as Event);
    expect(component.selectedFileName).toBe('medidor.png');
  });

  it('save should record the evidence file name and close the dialog', () => {
    component.month = 6;
    component.selectedFileName = 'medidor.png';

    component.save();

    const row = readingsService.getReadings('202', 'Luz').find((r) => r.month === 6);
    expect(row?.evidenceFileName).toBe('medidor.png');
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
