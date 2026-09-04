import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AddReadingDialogComponent } from './add-reading-dialog.component';

describe('AddReadingDialogComponent', () => {
  let component: AddReadingDialogComponent;
  let fixture: ComponentFixture<AddReadingDialogComponent>;
  let dialogRef: { close: ReturnType<typeof vi.fn> };

  const dialogData = { apartmentId: 3, apartment: '202', owner: 'Yesenia', service: 'Luz' as const };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AddReadingDialogComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddReadingDialogComponent);
    component = fixture.componentInstance;
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

  it('save should close the dialog immediately (evidence-only save has no HTTP call)', () => {
    component.month = 6;
    component.selectedFileName = 'medidor.png';

    component.save();

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});
