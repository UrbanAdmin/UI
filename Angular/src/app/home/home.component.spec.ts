import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { HomeComponent } from './home.component';
import { environment } from '../../environments/environment';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // getActiveNotifications() always resolves Deadlines (the shared-deadline
    // services) and Apartments (to check for any Arriendo contract dates) in
    // parallel; with no contracts set, the Arriendo pass stops there and
    // never fans out to Utilities/Dates/PaymentStatuses.
    httpMock.expectOne(`${environment.apiUrl}/Deadlines`).flush([]);
    httpMock.expectOne(`${environment.apiUrl}/Apartments`).flush([]);
    fixture.detectChanges();
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should expose the count of active notifications', () => {
    expect(component.pendingNotificationsCount()).toBe(0);
  });

  it('should render 3 quick-access cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('[data-testid="quick-access-card"]');
    expect(cards.length).toBe(3);
  });
});
