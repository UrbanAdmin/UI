import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { LoadingService } from './loading.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'UrbanAdminUI' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('UrbanAdminUI');
  });

  it('hides the global loading bar when nothing is in flight', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const bar = fixture.nativeElement.querySelector('mat-progress-bar');
    expect(bar).toBeNull();
  });

  it('shows the global loading bar while a request is in flight', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const loadingService = TestBed.inject(LoadingService);

    loadingService.start();
    fixture.detectChanges();

    const bar = fixture.nativeElement.querySelector('mat-progress-bar');
    expect(bar).not.toBeNull();
  });
});
