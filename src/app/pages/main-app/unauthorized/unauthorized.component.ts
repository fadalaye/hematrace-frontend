import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="unauthorized-container">
      <mat-card class="unauthorized-card">
        <mat-card-content class="text-center">
          <mat-icon class="error-icon">warning</mat-icon>
          <h2>Accès Refusé</h2>
          <p>Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
          <button mat-raised-button color="primary" (click)="goToDashboard()">
            <mat-icon>home</mat-icon>
            Retour au tableau de bord
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .unauthorized-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: #f5f5f5;
    }
    .unauthorized-card {
      max-width: 400px;
      padding: 40px;
    }
    .error-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      color: #f44336;
      margin-bottom: 20px;
    }
  `]
})
export class UnauthorizedComponent {
  constructor(private router: Router) {}

  goToDashboard(): void {
    this.router.navigate(['/app/dashboard']);
  }
}