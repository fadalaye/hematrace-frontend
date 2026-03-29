import { Component, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService, LoginCredentials, AuthResponse } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('identifiantInput') identifiantInput!: ElementRef;
  @ViewChild('motDePasseInput') motDePasseInput!: ElementRef;

  loading = signal(false);
  errorMessage = signal('');
  errorType = signal<'IDENTIFIANT' | 'MOT_DE_PASSE' | 'OTHER' | null>(null);

  loginForm = this.fb.group({
    identifiant: ['', [Validators.required, Validators.minLength(3)]],
    motDePasse: ['', [Validators.required, Validators.minLength(4)]]
  });

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      console.log('🔄 Déjà connecté, redirection vers le dashboard');
      this.router.navigate(['/app/dashboard']);
    }
  }

  onSubmit(): void {
  if (this.loginForm.valid) {
    this.loading.set(true);
    this.clearErrors();

    const credentials: LoginCredentials = {
      identifiant: this.loginForm.value.identifiant!,
      motDePasse: this.loginForm.value.motDePasse!
    };

    console.log('🔐 Tentative de connexion avec:', credentials.identifiant);

    this.authService.login(credentials).subscribe({
      next: (response: AuthResponse) => {
        console.log('✅ Réponse next:', response);
        this.loading.set(false);
        
        if (response.success && response.token) {
          console.log('✅ Connexion réussie');
          this.router.navigate(['/app/dashboard']);
        } else {
          console.log('❌ Réponse sans success:', response);
          this.handleErrorResponse(response);
        }
      },
      error: (error: any) => {
        console.log('❌ Erreur complète:', error);
        console.log('❌ Message d\'erreur:', error.message);
        console.log('❌ Type d\'erreur:', error.errorType);
        console.log('❌ Erreur brute:', JSON.stringify(error));
        
        this.loading.set(false);
        
        // S'assurer que c'est bien un AuthResponse
        const authError: AuthResponse = {
          success: false,
          message: error?.message || 'Erreur inconnue',
          errorType: error?.errorType || 'OTHER'
        };
        
        this.handleErrorResponse(authError);
      }
    });
  } else {
    this.loginForm.markAllAsTouched();
  }
}

  private handleErrorResponse(response: AuthResponse): void {
    const errorType = response.errorType || 'OTHER';
    this.errorType.set(errorType);
    
    let message = response.message || 'Erreur d\'authentification';
    
    switch (errorType) {
      case 'IDENTIFIANT':
        message = 'Identifiant incorrect. Vérifiez votre matricule ou email.';
        this.identifiant?.setErrors({ incorrect: true });
        break;
      case 'MOT_DE_PASSE':
        message = 'Mot de passe incorrect. Veuillez réessayer.';
        this.motDePasse?.setErrors({ incorrect: true });
        break;
    }
    
    this.errorMessage.set(message);
    
    // Focus sur le champ concerné
    setTimeout(() => {
      if (errorType === 'IDENTIFIANT' && this.identifiantInput) {
        this.identifiantInput.nativeElement.focus();
        this.identifiantInput.nativeElement.classList.add('shake-animation');
        setTimeout(() => {
          if (this.identifiantInput) {
            this.identifiantInput.nativeElement.classList.remove('shake-animation');
          }
        }, 500);
      } else if (errorType === 'MOT_DE_PASSE' && this.motDePasseInput) {
        this.motDePasseInput.nativeElement.focus();
        this.motDePasseInput.nativeElement.classList.add('shake-animation');
        setTimeout(() => {
          if (this.motDePasseInput) {
            this.motDePasseInput.nativeElement.classList.remove('shake-animation');
          }
        }, 500);
      }
    }, 100);
  }

  private clearErrors(): void {
    this.errorMessage.set('');
    this.errorType.set(null);
    this.identifiant?.setErrors(null);
    this.motDePasse?.setErrors(null);
  }

  onFieldInput(fieldName: string): void {
    if (this.errorType() && (fieldName === 'identifiant' || fieldName === 'motDePasse')) {
      this.clearErrors();
    }
  }

  getAlertClass(): string {
    switch (this.errorType()) {
      case 'IDENTIFIANT':
        return 'alert-warning';
      case 'MOT_DE_PASSE':
        return 'alert-danger';
      default:
        return 'alert-info';
    }
  }

  getAlertIcon(): string {
    switch (this.errorType()) {
      case 'IDENTIFIANT':
        return 'warning';
      case 'MOT_DE_PASSE':
        return 'error';
      default:
        return 'info';
    }
  }

  get identifiant() { return this.loginForm.get('identifiant'); }
  get motDePasse() { return this.loginForm.get('motDePasse'); }
}