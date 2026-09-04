import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([])]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose the count of active notifications', () => {
    expect(component.pendingNotificationsCount).toBeGreaterThan(0);
  });

  it('should render 3 quick-access cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('[data-testid="quick-access-card"]');
    expect(cards.length).toBe(3);
  });
});
