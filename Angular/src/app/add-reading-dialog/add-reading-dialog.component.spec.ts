import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddReadingDialogComponent } from './add-reading-dialog.component';

describe('AddReadingDialogComponent', () => {
  let component: AddReadingDialogComponent;
  let fixture: ComponentFixture<AddReadingDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddReadingDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddReadingDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
