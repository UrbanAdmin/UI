import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private loggedIn = false;
  private username: string | null = null;

  login(username: string) {
    this.loggedIn = true;
    this.username = username;
  }

  logout() {
    this.loggedIn = false;
    this.username = null;
  }

  isLoggedIn(): boolean {
    return this.loggedIn;
  }

  getUsername(): string | null {
    return this.username;
  }
}
