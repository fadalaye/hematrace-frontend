// components/utilisateurs/edit-medecin/edit-medecin.component.ts
import { Component, inject, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Medecin } from '../../../../../interfaces/medecin.interface';

@Component({
  selector: 'app-edit-medecin',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './edit-medecin.component.html',
  styleUrls: ['./edit-medecin.component.scss']
})
export class EditMedecinComponent implements OnInit {
  @Input() utilisateur: Medecin | null = null;
  @Output() save = new EventEmitter<Medecin>();
  @Output() cancel = new EventEmitter<void>();

  form!: FormGroup;
  private fb = inject(FormBuilder);

  // ✅ NOUVEAU : État pour gérer les erreurs backend
  backendError: string = '';
  isLoading: boolean = false;

  specialites = [
    'Anesthésiologie', 'Cardiologie', 'Dermatologie', 'Endocrinologie',
    'Gastro-entérologie', 'Gynécologie', 'Hématologie', 'Médecine Générale',
    'Neurologie', 'Oncologie', 'Pédiatrie', 'Pneumologie', 'Psychiatrie',
    'Radiologie', 'Rhumatologie', 'Urgences', 'Chirurgie Générale'
  ];

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
      telephone: ['', [Validators.maxLength(20)]],
      sexe: ['M', [Validators.required]],
      dateNaissance: ['', [Validators.required]],
      adresse: ['', [Validators.maxLength(200)]],
      dateEmbauche: [''],
      motDePasse: ['', this.isEditMode ? [] : [Validators.required, Validators.minLength(6)]],
      statut: ['ACTIF', [Validators.required]],
      specialite: ['', [Validators.required]]
    });

    // ✅ NOUVEAU : Réinitialiser l'erreur backend quand l'utilisateur modifie le formulaire
    this.form.valueChanges.subscribe(() => {
      this.clearBackendError();
    });
  }

  private patchForm() {
    if (this.utilisateur) {
      // Préparer les données pour le patch
      const patchData: any = {
        ...this.utilisateur,
        dateNaissance: this.formatDateForInput(this.utilisateur.dateNaissance),
        motDePasse: '' // Toujours vide en édition
      };

      // Ajouter dateEmbauche seulement si elle existe
      if (this.utilisateur.dateEmbauche) {
        patchData.dateEmbauche = this.formatDateForInput(this.utilisateur.dateEmbauche);
      }

      console.log('📝 Données pour patch:', patchData);
      this.form.patchValue(patchData, { emitEvent: false });
    }
  }

  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      console.warn('❌ Format de date invalide:', dateString);
      return '';
    }
  }

  // ✅ NOUVELLE MÉTHODE : Effacer l'erreur backend
  public clearBackendError() {
    this.backendError = '';
  }

  // ✅ NOUVELLE MÉTHODE : Afficher l'erreur backend
  private showBackendError(message: string) {
    this.backendError = message;
    this.isLoading = false;
    
    // Scroll vers le haut pour voir l'erreur
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async onSubmit() {
    console.log('🎯 Début soumission formulaire');
    
    // ✅ NOUVEAU : Réinitialiser l'état
    this.clearBackendError();
    this.isLoading = true;
    
    if (this.form.valid) {
      try {
        const formValue = this.form.value;
        console.log('📝 Données brutes du formulaire:', formValue);

        // Préparer les données pour l'API
        const cleanData = this.prepareDataForAPI(formValue);
        console.log('🧹 Données nettoyées:', cleanData);

        // Valider les données
        const validation = this.validateFormData(cleanData);
        if (!validation.isValid) {
          this.isLoading = false;
          this.showBackendError(`❌ Erreurs de validation:\n${validation.errors.join('\n')}`);
          return;
        }

        // Créer l'objet final
        const medecinData: Medecin = {
          ...cleanData,
          id: this.utilisateur?.id
        };

        console.log('✅ Données finales prêtes pour envoi:', medecinData);
        
        // ✅ CHANGEMENT : Émettre l'événement avec l'état de chargement
        this.save.emit(medecinData);

      } catch (error: any) {
        console.error('💥 Erreur lors de la préparation:', error);
        this.isLoading = false;
        this.showBackendError(`Erreur: ${error.message}`);
      }
    } else {
      console.error('❌ Formulaire invalide - Erreurs:', this.getFormErrors());
      this.markAllFieldsAsTouched();
      this.isLoading = false;
      this.showBackendError('❌ Veuillez corriger les erreurs dans le formulaire avant de soumettre.');
    }
  }

  private prepareDataForAPI(formValue: any): any {
    // Faire une copie profonde
    const data = JSON.parse(JSON.stringify(formValue));
    
    console.log('🔍 Analyse des données avant nettoyage:', data);

    // Extraire et nettoyer le mot de passe
    let motDePasseValue = data.motDePasse;
    
    if (motDePasseValue) {
      // Gérer les différents formats Angular
      if (Array.isArray(motDePasseValue)) {
        motDePasseValue = motDePasseValue[0] || '';
        console.log('🔄 Mot de passe converti depuis tableau:', motDePasseValue);
      }
      
      if (typeof motDePasseValue === 'object' && motDePasseValue !== null) {
        if ('value' in motDePasseValue) {
          motDePasseValue = motDePasseValue.value || '';
          console.log('🔄 Mot de passe extrait depuis objet:', motDePasseValue);
        } else {
          motDePasseValue = '';
          console.log('⚠️  Mot de passe objet non reconnu, valeur mise à vide');
        }
      }
    }

    // Construire l'objet final
    const cleanData: any = {
      matricule: (data.matricule || '').toString().trim(),
      nom: (data.nom || '').toString().trim(),
      prenom: (data.prenom || '').toString().trim(),
      email: (data.email || '').toString().trim().toLowerCase(),
      sexe: data.sexe || 'M',
      dateNaissance: data.dateNaissance,
      statut: data.statut || 'ACTIF',
      specialite: (data.specialite || '').toString().trim()
    };

    // Ajouter les champs optionnels seulement s'ils ont une valeur
    if (data.telephone && data.telephone.toString().trim()) {
      cleanData.telephone = data.telephone.toString().trim();
    }

    if (data.adresse && data.adresse.toString().trim()) {
      cleanData.adresse = data.adresse.toString().trim();
    }

    if (data.dateEmbauche) {
      cleanData.dateEmbauche = data.dateEmbauche;
    }

    // Gérer le mot de passe seulement s'il est fourni et non vide
    if (motDePasseValue && motDePasseValue.toString().trim()) {
      cleanData.motDePasse = motDePasseValue.toString().trim();
      console.log('🔐 Mot de passe inclus dans les données');
    } else if (!this.isEditMode) {
      // En création, le mot de passe est requis
      throw new Error('Le mot de passe est requis pour la création');
    }

    console.log('✅ Données finales nettoyées:', cleanData);
    return cleanData;
  }

  private validateFormData(formValue: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Champs obligatoires
    const requiredFields = [
      'matricule', 'nom', 'prenom', 'email', 'sexe', 
      'dateNaissance', 'statut', 'specialite'
    ];

    requiredFields.forEach(field => {
      const value = formValue[field];
      if (!value || value.toString().trim() === '') {
        errors.push(`Le champ "${this.getFieldLabel(field)}" est requis`);
      }
    });

    // Validation email
    if (formValue.email && !this.isValidEmail(formValue.email)) {
      errors.push('Le format de l\'email est invalide');
    }

    // Validation date de naissance
    if (formValue.dateNaissance && !this.isValidDate(formValue.dateNaissance)) {
      errors.push('La date de naissance est invalide');
    }

    // Validation mot de passe en création
    if (!this.isEditMode && (!formValue.motDePasse || formValue.motDePasse.length < 6)) {
      errors.push('Le mot de passe doit contenir au moins 6 caractères');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private getFieldLabel(field: string): string {
    const labels: { [key: string]: string } = {
      matricule: 'Matricule',
      nom: 'Nom',
      prenom: 'Prénom',
      email: 'Email',
      sexe: 'Sexe',
      dateNaissance: 'Date de naissance',
      statut: 'Statut',
      specialite: 'Spécialité'
    };
    return labels[field] || field;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidDate(dateString: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  private markAllFieldsAsTouched() {
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      if (control) {
        control.markAsTouched();
      }
    });
  }

  private getFormErrors(): any {
    const errors: any = {};
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      if (control && control.errors) {
        errors[key] = control.errors;
      }
    });
    return errors;
  }

  onCancel() {
    console.log('❌ Annulation formulaire');
    this.clearBackendError();
    this.cancel.emit();
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    
    if (field?.invalid && field.touched) {
      const errors = field.errors;
      
      if (errors?.['required']) {
        return 'Ce champ est requis';
      }
      if (errors?.['email']) {
        return 'Format d\'email invalide';
      }
      if (errors?.['minlength']) {
        return `Minimum ${errors['minlength'].requiredLength} caractères requis`;
      }
      if (errors?.['maxlength']) {
        return `Maximum ${errors['maxlength'].requiredLength} caractères autorisés`;
      }
    }
    
    return '';
  }

  get isEditMode(): boolean {
    return !!this.utilisateur;
  }

  // ✅ NOUVELLE MÉTHODE : Pour que le parent puisse afficher les erreurs backend
  setBackendError(message: string) {
    this.showBackendError(message);
  }

  // ✅ NOUVELLE MÉTHODE : Pour que le parent puisse arrêter le loading
  stopLoading() {
    this.isLoading = false;
  }

  // Méthode utilitaire pour le debug
  showFormState() {
    console.log('📊 État du formulaire:', {
      valid: this.form.valid,
      invalid: this.form.invalid,
      pristine: this.form.pristine,
      dirty: this.form.dirty,
      touched: this.form.touched,
      errors: this.getFormErrors(),
      values: this.form.value
    });
  }
}