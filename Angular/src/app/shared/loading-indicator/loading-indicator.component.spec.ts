import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoadingIndicatorComponent } from './loading-indicator.component';

describe('LoadingIndicatorComponent', () => {
  let fixture: ComponentFixture<LoadingIndicatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingIndicatorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingIndicatorComponent);
  });

  it('renders nothing when loading is false', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('mat-progress-spinner')).toBeNull();
  });

  it('renders a spinner when loading is true', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('mat-progress-spinner')).not.toBeNull();
  });

  it('renders the optional label only when provided', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('label', 'Procesando OCR...');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Procesando OCR...');
  });
});
