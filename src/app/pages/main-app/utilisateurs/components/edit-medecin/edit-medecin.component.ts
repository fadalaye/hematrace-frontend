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

  // UI State
  backendError: string = '';
  isLoading: boolean = false;

  specialites = [
    'Anesthésiologie', 'Cardiologie', 'Dermatologie', 'Endocrinologie',
    'Gastro-entérologie', 'Gynécologie', 'Hématologie', 'Médecine Générale',
    'Neurologie', 'Oncologie', 'Pédiatrie', 'Pneumologie', 'Psychiatrie',
    'Radiologie', 'Rhumatologie', 'Urgences', 'Chirurgie Générale'
  ];

  get isEditMode(): boolean {
    return !!this.utilisateur;
  }

  ngOnInit(): void {
    this.initForm();

    if (this.utilisateur) {
      this.patchForm();
    }
  }

  private initForm(): void {
    this.form = this.fb.group({
      matricule: ['', [Validators.required, Validators.maxLength(20)]],
      nom: ['', [Validators.required, Validators.maxLength(50)]],
      prenom: ['', [Validators.required, Validators.maxLength(50)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(100)]],
      telephone: ['', [Validators.maxLength(20)]],
      sexe: ['M', Validators.required],
      dateNaissance: ['', Validators.required],
      adresse: ['', [Validators.maxLength(200)]],
      dateEmbauche: [''],
      motDePasse: [''], // ✅ PLUS obligatoire
      statut: ['ACTIF', Validators.required],
      specialite: ['', Validators.required]
    });

    // ✅ mot de passe seulement en édition (optionnel)
    if (this.isEditMode) {
      this.form.get('motDePasse')?.setValidators([Validators.minLength(6)]);
    } else {
      this.form.get('motDePasse')?.clearValidators();
    }

    // Reset erreur backend quand l'utilisateur tape
    this.form.valueChanges.subscribe(() => {
      this.clearBackendError();
    });
  }

  private patchForm(): void {
    if (!this.utilisateur) return;

    this.form.patchValue({
      ...this.utilisateur,
      dateNaissance: this.formatDateForInput(this.utilisateur.dateNaissance),
      dateEmbauche: this.utilisateur.dateEmbauche
        ? this.formatDateForInput(this.utilisateur.dateEmbauche)
        : '',
      motDePasse: ''
    });
  }

  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    try {
      return new Date(dateString).toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  onSubmit(): void {
    this.clearBackendError();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isLoading = true;

    const formValue = this.form.value;

    const cleanData = this.prepareData(formValue);

    console.log('🧹 Données envoyées:', cleanData);

    this.save.emit(cleanData);
  }

  private prepareData(formValue: any): Medecin {
    const data: any = {
      ...formValue,
      id: this.utilisateur?.id
    };

    // ❌ supprimer mot de passe vide
    if (!data.motDePasse || data.motDePasse.trim() === '') {
      delete data.motDePasse;
    }

    return data;
  }

  onCancel(): void {
    this.cancel.emit();
  }

  // 🔴 Gestion erreurs backend
  public setBackendError(message: string): void {
    this.backendError = message;
    this.isLoading = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  public clearBackendError(): void {
    this.backendError = '';
  }

  public stopLoading(): void {
    this.isLoading = false;
  }

  // 🎯 Messages erreurs champs
  getFieldError(field: string): string {
    const control = this.form.get(field);

    if (!control || !control.errors) return '';

    if (control.errors['required']) return 'Ce champ est obligatoire';
    if (control.errors['email']) return 'Email invalide';
    if (control.errors['maxlength']) return 'Trop long';
    if (control.errors['minlength']) return 'Trop court';

    return 'Valeur invalide';
  }
}