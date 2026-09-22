import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PageHeaderComponent } from './page-header.component';

describe('PageHeaderComponent', () => {
  let fixture: ComponentFixture<PageHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeaderComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageHeaderComponent);
  });

  it('renders the kicker and title', () => {
    fixture.componentRef.setInput('kicker', 'Servicio · Agua');
    fixture.componentRef.setInput('title', 'Lecturas');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Lecturas');
    expect(el.textContent).toContain('Servicio · Agua');
  });

  it('does not render a hint when none is set', () => {
    fixture.componentRef.setInput('kicker', 'Servicio · Agua');
    fixture.componentRef.setInput('title', 'Lecturas');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.page-hint')).toBeNull();
  });

  it('renders a hint when set', () => {
    fixture.componentRef.setInput('kicker', 'Servicio · Agua');
    fixture.componentRef.setInput('title', 'Lecturas');
    fixture.componentRef.setInput('hint', 'Registra el total del recibo y la lectura de cada contador.');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.page-hint')?.textContent).toContain('Registra el total del recibo');
  });
});
