import { Component, inject, input, OnInit, output, signal, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BsDatepickerConfig, BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ProduitSanguin } from '../../../../../interfaces/produit-sanguin.interface';
import { ProduitSanguinService } from '../../../../../services/produit-sanguin.service';
import { debounceTime, distinctUntilChanged, switchMap, catchError } from 'rxjs/operators';
import { of, Subject } from 'rxjs';

@Component({
  selector: 'app-edit-produit-sanguin',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule, 
    BsDatepickerModule, 
    MatButtonModule, 
    MatIconModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './edit-produit-sanguin.component.html',
  styleUrl: './edit-produit-sanguin.component.scss'
})
export class EditProduitSanguinComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  
  updateItem = input<ProduitSanguin | null>();
  addedData = output<ProduitSanguin>();
  saved = output<ProduitSanguin>();
  cancelled = output<void>();

  // États pour la vérification du code
  checkingCode = signal<boolean>(false);
  codeCheckResult = signal<'available' | 'taken' | 'error' | null>(null);
  private destroy$ = new Subject<void>();

  // Constantes pour les volumes autorisés
  readonly ALLOWED_VOLUMES = [450, 500];
  readonly VOLUMES_AUTORISES = [450, 500];

  private formBuilder = inject(FormBuilder);
  private produitSanguinService = inject(ProduitSanguinService);

  ngOnInit() {
    this.initForm();
    this.setupCodeUniquenessCheck();
  }

  initForm() {
    const item = this.updateItem();
    const isEditMode = !!item?.id;
    
    this.form = this.formBuilder.group({
      codeProduit: [
        { 
          value: item?.codeProduit ?? '', 
          disabled: isEditMode // Désactiver en mode édition
        }, 
        [Validators.required, Validators.minLength(3)]
      ],
      typeProduit: [item?.typeProduit ?? '', Validators.required],
      groupeSanguin: [item?.groupeSanguin ?? '', Validators.required],
      rhesus: [item?.rhesus ?? '', Validators.required],
      volumeMl: [
        item?.volumeMl ?? null, 
        [Validators.required, this.volumeValidator.bind(this)]
      ],
      datePrelevement: [item?.datePrelevement ?? '', Validators.required],
      datePeremption: [item?.datePeremption ?? '', Validators.required],
      etat: [item?.etat ?? 'DISPONIBLE', Validators.required] // MODIFIÉ: Majuscule
    });

    // Si en mode édition, marquer le code comme disponible
    if (isEditMode) {
      this.codeCheckResult.set('available');
    }

    // Ajouter une validation croisée pour les dates
    this.addDateValidators();
  }

  /**
   * Ajoute des validateurs croisés pour les dates
   */
  private addDateValidators() {
    this.form.valueChanges.subscribe(() => {
      const datePrelevement = this.form.get('datePrelevement')?.value;
      const datePeremption = this.form.get('datePeremption')?.value;
      
      if (datePrelevement && datePeremption) {
        const datePrelev = new Date(datePrelevement);
        const datePeremp = new Date(datePeremption);
        
        if (datePeremp <= datePrelev) {
          this.form.get('datePeremption')?.setErrors({ dateBeforePrelevement: true });
        } else {
          // Calculer la durée de conservation
          const diffTime = datePeremp.getTime() - datePrelev.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          // Vérifier si la durée est raisonnable (max 42 jours pour CGR)
          if (diffDays > 42) {
            this.form.get('datePeremption')?.setErrors({ 
              dateTooFar: true,
              maxDays: 42 
            });
          }
        }
      }
    });
  }

  /**
   * Configure la vérification d'unicité du code en temps réel
   */
  private setupCodeUniquenessCheck(): void {
    const codeControl = this.form.get('codeProduit');
    
    if (codeControl && !codeControl.disabled) {
      codeControl.valueChanges
        .pipe(
          debounceTime(500),
          distinctUntilChanged(),
          switchMap(code => {
            if (code && code.length >= 3) {
              this.checkingCode.set(true);
              this.codeCheckResult.set(null);
              return this.produitSanguinService.checkCodeUnique(code);
            } else {
              this.codeCheckResult.set(null);
              return of({ isUnique: true });
            }
          }),
          catchError(() => {
            this.checkingCode.set(false);
            this.codeCheckResult.set('error');
            return of({ isUnique: true });
          })
        )
        .subscribe({
          next: (response) => {
            this.checkingCode.set(false);
            
            if (response.isUnique) {
              this.codeCheckResult.set('available');
              codeControl.setErrors(null);
            } else {
              this.codeCheckResult.set('taken');
              codeControl.setErrors({ codeTaken: true });
            }
          },
          error: () => {
            this.checkingCode.set(false);
            this.codeCheckResult.set('error');
          }
        });
    }
  }

  /**
   * Validateur personnalisé pour les volumes (450ml ou 500ml seulement)
   */
  private volumeValidator(control: AbstractControl) {
    const value = control.value;
    
    if (value === null || value === undefined || value === '') {
      return { required: true };
    }
    
    const numValue = Number(value);
    
    if (isNaN(numValue)) {
      return { invalidNumber: true };
    }
    
    if (!this.ALLOWED_VOLUMES.includes(numValue)) {
      return { 
        invalidVolume: true,
        message: `Le volume doit être ${this.VOLUMES_AUTORISES.join(' ou ')} ml`
      };
    }
    
    return null;
  }

  /**
   * Vérifie manuellement l'unicité du code
   */
  checkCodeAvailability(): void {
    const code = this.form.get('codeProduit')?.value;
    
    if (!code || code.length < 3) {
      this.codeCheckResult.set('error');
      return;
    }

    this.checkingCode.set(true);
    this.codeCheckResult.set(null);
    
    this.produitSanguinService.checkCodeUnique(code)
      .subscribe({
        next: (response) => {
          this.checkingCode.set(false);
          
          if (response.isUnique) {
            this.codeCheckResult.set('available');
          } else {
            this.codeCheckResult.set('taken');
            this.form.get('codeProduit')?.setErrors({ codeTaken: true });
          }
        },
        error: () => {
          this.checkingCode.set(false);
          this.codeCheckResult.set('error');
        }
      });
  }

  onSubmit() {
    console.log('✅ onSubmit() appelé');
    
    if (this.form.invalid) {
      console.log('❌ Formulaire invalide', this.form.errors);
      this.form.markAllAsTouched();
      
      // Afficher les erreurs spécifiques
      Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        if (control?.invalid) {
          console.log(`Champ ${key}:`, control.errors);
        }
      });
      
      return;
    }

    // Vérifier l'unicité du code en mode création
    if (!this.updateItem()?.id && this.codeCheckResult() !== 'available') {
      alert('Veuillez vérifier que le code produit est disponible avant de sauvegarder.');
      return;
    }
    
    console.log('📦 Données du formulaire:', this.form.value);
    this.saveProduit();
  }

  saveProduit() {
    const formValue = this.form.getRawValue();
    
    // Convertir les dates au format correct
    const datePrelevement = this.formatDateForAPI(formValue.datePrelevement);
    const datePeremption = this.formatDateForAPI(formValue.datePeremption);
    
    // Validation supplémentaire des dates
    if (new Date(datePeremption) <= new Date(datePrelevement)) {
      alert('La date de péremption doit être après la date de prélèvement');
      return;
    }
    
    // Préparer les données
    const data: ProduitSanguin = {
      ...formValue,
      datePrelevement: datePrelevement,
      datePeremption: datePeremption,
      etat: formValue.etat.toUpperCase() // S'assurer que l'état est en majuscules
    };

    const currentItem = this.updateItem();
    
    if (currentItem?.id) {
      // Mode modification
      console.log('🔄 Émission saved avec ID:', currentItem.id);
      this.saved.emit({ 
        ...data,
        id: currentItem.id 
      });
    } else {
      // Mode création
      console.log('➕ Émission addedData');
      this.addedData.emit(data);
    }
  }

  private formatDateForAPI(date: string | Date): string {
    if (!date) return '';
    
    // Si c'est déjà une string au format YYYY-MM-DD
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }
    
    // Si c'est une string avec un format différent
    if (typeof date === 'string') {
      // Essayer de la convertir
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        return '';
      }
      date = d;
    }
    
    // Si c'est un objet Date
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    return '';
  }

  cancel() {
    console.log('❌ Annulation');
    this.cancelled.emit();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Méthode utilitaire pour obtenir le message d'erreur du volume
  getVolumeErrorMessage(): string {
    const errors = this.form.get('volumeMl')?.errors;
    if (errors?.['invalidVolume']) {
      return errors['message'] || `Le volume doit être ${this.VOLUMES_AUTORISES.join(' ou ')} ml`;
    }
    if (errors?.['required']) {
      return 'Le volume est requis';
    }
    if (errors?.['invalidNumber']) {
      return 'Le volume doit être un nombre';
    }
    return '';
  }

  // Méthode pour obtenir le message d'état du code
  getCodeStatusMessage(): string {
    const result = this.codeCheckResult();
    switch (result) {
      case 'available':
        return '✓ Code disponible';
      case 'taken':
        return '✗ Ce code existe déjà';
      case 'error':
        return '⚠ Erreur de vérification';
      default:
        return '';
    }
  }

  // Méthode pour obtenir la classe CSS du statut du code
  getCodeStatusClass(): string {
    const result = this.codeCheckResult();
    switch (result) {
      case 'available':
        return 'text-success fw-bold';
      case 'taken':
        return 'text-danger fw-bold';
      case 'error':
        return 'text-warning fw-bold';
      default:
        return 'text-muted';
    }
  }

  // Méthode pour obtenir le message d'erreur de la date de péremption
  getDatePeremptionErrorMessage(): string {
    const errors = this.form.get('datePeremption')?.errors;
    if (errors?.['dateBeforePrelevement']) {
      return 'La date de péremption doit être après la date de prélèvement';
    }
    if (errors?.['dateTooFar']) {
      return `La durée de conservation ne doit pas dépasser ${errors['maxDays']} jours`;
    }
    return '';
  }

  // Getters pour les dates limites
get today(): string {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

get minPeremptionDate(): string {
  const datePrelevement = this.form.get('datePrelevement')?.value;
  if (datePrelevement) {
    const date = new Date(datePrelevement);
    date.setDate(date.getDate() + 1); // Au minimum 1 jour après le prélèvement
    return date.toISOString().split('T')[0];
  }
  return '';
}
}