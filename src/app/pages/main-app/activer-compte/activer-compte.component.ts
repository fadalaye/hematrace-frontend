import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-activer-compte',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './activer-compte.component.html',
  styleUrls: ['./activer-compte.component.scss']
})
export class ActiverCompteComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  form!: FormGroup;
  token = '';

  loading = false;
  success = false;
  errorMessage = '';
  hidePassword = true;
  hideConfirmPassword = true;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    this.initForm();

    if (!this.token) {
      this.errorMessage = 'Lien invalide ou token manquant.';
    }
  }

  private initForm(): void {
    this.form = this.fb.group(
      {
        motDePasse: ['', [Validators.required, Validators.minLength(6)]],
        confirmationMotDePasse: ['', [Validators.required]]
      },
      {
        validators: [this.passwordsMatchValidator]
      }
    );

    this.form.valueChanges.subscribe(() => {
      if (this.errorMessage) {
        this.errorMessage = '';
      }
    });
  }

  private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('motDePasse')?.value;
    const confirmPassword = control.get('confirmationMotDePasse')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.token) {
      this.errorMessage = 'Lien invalide ou token manquant.';
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;

    const motDePasse = this.form.get('motDePasse')?.value;

    this.authService.activateAccount({
      token: this.token,
      motDePasse
    }).subscribe({
      next: (response) => {
        this.loading = false;
        this.success = true;
        this.errorMessage = '';

        console.log('✅ Activation réussie :', response);

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2500);
      },
      error: (error) => {
        this.loading = false;
        this.success = false;
        this.errorMessage = error?.message || 'Erreur lors de l’activation du compte.';
        console.error('❌ Erreur activation :', error);
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  get motDePasseControl(): AbstractControl | null {
    return this.form.get('motDePasse');
  }

  get confirmationMotDePasseControl(): AbstractControl | null {
    return this.form.get('confirmationMotDePasse');
  }

  getFieldError(fieldName: 'motDePasse' | 'confirmationMotDePasse'): string {
    const control = this.form.get(fieldName);

    if (!control || !control.touched || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'Ce champ est obligatoire.';
    }

    if (control.errors['minlength']) {
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    }

    return '';
  }

  getPasswordMismatchError(): string {
    if (
      this.form.hasError('passwordMismatch') &&
      this.confirmationMotDePasseControl?.touched
    ) {
      return 'Les mots de passe ne correspondent pas.';
    }

    return '';
  }
}