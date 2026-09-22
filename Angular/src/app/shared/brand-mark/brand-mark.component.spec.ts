import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrandMarkComponent } from './brand-mark.component';

describe('BrandMarkComponent', () => {
  let fixture: ComponentFixture<BrandMarkComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandMarkComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BrandMarkComponent);
  });

  it('renders the three-bar mark at the default size', () => {
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('rect').length).toBe(3);
    const mark = el.querySelector('.brand-mark') as HTMLElement;
    expect(mark.style.width).toBe('34px');
  });

  it('honors a custom size', () => {
    fixture.componentRef.setInput('size', 64);
    fixture.detectChanges();

    const mark: HTMLElement = fixture.nativeElement.querySelector('.brand-mark');
    expect(mark.style.width).toBe('64px');
    expect(mark.style.height).toBe('64px');
  });
});
