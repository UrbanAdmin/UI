import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateComponent);
  });

  it('renders the icon and message', () => {
    fixture.componentRef.setInput('icon', 'inbox');
    fixture.componentRef.setInput('message', 'No hay nada aquí todavía.');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('mat-icon')?.textContent?.trim()).toBe('inbox');
    expect(el.textContent).toContain('No hay nada aquí todavía.');
  });

  it('does not render an action button when actionLabel is not set', () => {
    fixture.componentRef.setInput('icon', 'inbox');
    fixture.componentRef.setInput('message', 'No hay nada aquí todavía.');
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('button')).toBeNull();
  });

  it('renders an action button when actionLabel is set, and emits action on click', () => {
    fixture.componentRef.setInput('icon', 'inbox');
    fixture.componentRef.setInput('message', 'No hay nada aquí todavía.');
    fixture.componentRef.setInput('actionLabel', 'Agregar usuario');
    fixture.detectChanges();

    const emitted: void[] = [];
    fixture.componentInstance.action.subscribe(() => emitted.push(undefined));

    const el: HTMLElement = fixture.nativeElement;
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Agregar usuario');

    button.click();
    expect(emitted.length).toBe(1);
  });
});
