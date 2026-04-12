// components/utilisateurs/edit-admin/edit-admin.component.ts
import { Component, inject, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Admin } from '../../../../../interfaces/admin.interface';

@Component({
  selector: 'app-edit-admin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './edit-admin.component.html',
  styleUrls: ['./edit-admin.component.scss']
})
export class EditAdminComponent implements OnInit {
  @Input() utilisateur: Admin | null = null;
  @Output() save = new EventEmitter<Admin>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  private fb = inject(FormBuilder);

  // États pour la gestion UI
  isLoading = false;
  backendError: string | null = null;

  rolesAdmin = ['SUPER_ADMIN', 'ADMIN_SYSTEME', 'ADMIN_METIER', 'ADMIN_SECURITE'];

  ngOnInit() {
    this.initForm();
    if (this.utilisateur) {
      this.patchForm();
    }
  }

  private initForm() {
    this.form = this.fb.group({
      matricule: ['', [Validators.required, Validators.maxLength(20)]],
      nom: ['', [Validators.required, Validators.maxLength(50)]],
      prenom: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      telephone: ['', [Validators.maxLength(20), Validators.pattern(/^[0-9+\-\s()]*$/)]],
      sexe: ['M', Validators.required],
      dateNaissance: ['', Validators.required],
      adresse: ['', Validators.maxLength(200)],
      dateEmbauche: [''],
      motDePasse: [''],
      statut: ['ACTIF', Validators.required],
      role: ['', Validators.required],
      droitsAccess: ['']
      
    });

    if (this.utilisateur) {
      this.form.get('motDePasse')?.setValidators([Validators.minLength(8)]);
    } else {
      this.form.get('motDePasse')?.clearValidators(); // création → ignoré
    }
  }

  private patchForm() {
    if (this.utilisateur) {
      this.form.patchValue({
        ...this.utilisateur,
        dateNaissance: this.formatDateForInput(this.utilisateur.dateNaissance),
        dateEmbauche: this.utilisateur.dateEmbauche ? this.formatDateForInput(this.utilisateur.dateEmbauche) : '',
        motDePasse: '' // Ne pas pré-remplir le mot de passe
      });
    }
  }

  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    try {
      return new Date(dateString).toISOString().split('T')[0];
    } catch {
      return dateString;
    }
  }

  onSubmit() {
    if (this.form.valid) {
      this.isLoading = true;
      this.backendError = null;

      const formValue = this.form.value;
      const adminData: Admin = {
        ...formValue,
        id: this.utilisateur?.id
      };

      // Gestion du mot de passe
      if (!adminData.motDePasse || adminData.motDePasse.trim() === '') {
        delete adminData.motDePasse;
      }

      // Formatage des dates
      if (adminData.dateNaissance) {
        adminData.dateNaissance = new Date(adminData.dateNaissance).toISOString();
      }
      if (adminData.dateEmbauche) {
        adminData.dateEmbauche = new Date(adminData.dateEmbauche).toISOString();
      }

      // Émission des données
      this.save.emit(adminData);
      
      // Réinitialisation du loading après un délai (pour éviter le flash)
      setTimeout(() => {
        this.isLoading = false;
      }, 1000);

    } else {
      this.form.markAllAsTouched();
      this.scrollToFirstInvalidField();
    }

    
  }

  onCancel() {
    this.cancel.emit();
  }

  // Méthode pour effacer les erreurs backend
  clearBackendError() {
    this.backendError = null;
  }

  // Méthode pour gérer les erreurs backend (à appeler depuis le parent)
  setBackendError(error: string) {
    this.backendError = error;
    this.isLoading = false;
  }

  // Méthode pour arrêter le loading (à appeler depuis le parent)
  setLoading(loading: boolean) {
    this.isLoading = loading;
  }

  private scrollToFirstInvalidField() {
    const firstInvalidControl = document.querySelector('.is-invalid');
    if (firstInvalidControl) {
      firstInvalidControl.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) return 'Ce champ est requis';
      if (field.errors['email']) return 'Format d\'email invalide';
      if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} caractères`;
      if (field.errors['maxlength']) return `Maximum ${field.errors['maxlength'].requiredLength} caractères`;
      if (field.errors['pattern']) {
        if (fieldName === 'telephone') return 'Format de téléphone invalide';
        return 'Format invalide';
      }
    }
    return '';
  }

  get isEditMode(): boolean {
    return !!this.utilisateur;
  }

  // Méthode utilitaire pour vérifier si un champ est valide
  isFieldValid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field?.valid && field.touched);
  }

  // Méthode utilitaire pour vérifier si un champ est invalide
  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field?.invalid && field.touched);
  }
}