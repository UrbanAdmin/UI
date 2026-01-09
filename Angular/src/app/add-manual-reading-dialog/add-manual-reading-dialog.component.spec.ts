import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddManualReadingDialogComponent } from './add-manual-reading-dialog.component';

describe('AddManualReadingDialogComponent', () => {
  let component: AddManualReadingDialogComponent;
  let fixture: ComponentFixture<AddManualReadingDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddManualReadingDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddManualReadingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
