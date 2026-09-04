import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  let component: ShellComponent;
  let fixture: ComponentFixture<ShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render all 4 nav links', () => {
    const links = fixture.nativeElement.querySelectorAll('[data-testid="nav-link"]');
    expect(links.length).toBe(4);
  });

  it('should render a logout action', () => {
    const logout = fixture.nativeElement.querySelector('[data-testid="logout"]');
    expect(logout).toBeTruthy();
  });
});
