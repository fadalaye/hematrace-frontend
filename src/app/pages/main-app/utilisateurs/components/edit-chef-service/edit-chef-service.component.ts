// components/utilisateurs/edit-chef-service/edit-chef-service.component.ts
import { Component, inject, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ChefService } from '../../../../../interfaces/chef-service.interface';

@Component({
  selector: 'app-edit-chef-service',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './edit-chef-service.component.html',
  styleUrls: ['./edit-chef-service.component.scss']
})
export class EditChefServiceComponent implements OnInit {
  @Input() utilisateur: ChefService | null = null;
  @Output() save = new EventEmitter<ChefService>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  private fb = inject(FormBuilder);

  // États pour la gestion UI
  isLoading = false;
  backendError: string | null = null;

  services = [
    'Urgences', 'Chirurgie', 'Médecine Interne', 'Pédiatrie',
    'Oncologie', 'Cardiologie', 'Laboratoire', 'Radiologie',
    'Gynécologie-Obstétrique', 'Psychiatrie', 'Réanimation', 'Bloc Opératoire'
  ];

  departements = ['Médical', 'Chirurgical', 'Technique', 'Administratif', 'Soins Infirmiers'];

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
      motDePasse: [this.utilisateur ? '' : ['', [Validators.required, Validators.minLength(6)]]],
      statut: ['ACTIF', Validators.required],
      serviceDirige: ['', Validators.required],
      departement: ['', Validators.required]
    });

    // Validation conditionnelle du mot de passe en mode édition
    if (this.utilisateur) {
      this.form.get('motDePasse')?.setValidators([Validators.minLength(6)]);
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
      const chefServiceData: ChefService = {
        ...formValue,
        id: this.utilisateur?.id
      };

      // Gestion du mot de passe
      if (!chefServiceData.motDePasse) {
        delete chefServiceData.motDePasse;
      }

      // Formatage des dates
      if (chefServiceData.dateNaissance) {
        chefServiceData.dateNaissance = new Date(chefServiceData.dateNaissance).toISOString();
      }
      if (chefServiceData.dateEmbauche) {
        chefServiceData.dateEmbauche = new Date(chefServiceData.dateEmbauche).toISOString();
      }

      // Émission des données
      this.save.emit(chefServiceData);
      
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