import { Component } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../auth.service';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    AsyncPipe,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.css',
})
export class ShellComponent {
  readonly navLinks: NavLink[] = [
    { path: '/', label: 'Home', icon: 'home' },
    { path: '/counter-utilities', label: 'Lecturas', icon: 'speed' },
    { path: '/payments', label: 'Pagos', icon: 'payments' },
    { path: '/notifications', label: 'Notificaciones', icon: 'notifications' },
  ];

  readonly isMobile$: Observable<boolean>;

  constructor(
    private breakpointObserver: BreakpointObserver,
    private authService: AuthService,
    private router: Router,
  ) {
    this.isMobile$ = this.breakpointObserver
      .observe(Breakpoints.Handset)
      .pipe(map((result) => result.matches));
  }

  get username(): string | null {
    return this.authService.getUsername();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  closeIfOver(sidenav: MatSidenav): void {
    if (sidenav.mode === 'over') {
      sidenav.close();
    }
  }
}
