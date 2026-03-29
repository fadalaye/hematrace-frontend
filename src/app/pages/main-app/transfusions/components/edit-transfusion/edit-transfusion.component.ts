import { Component, inject, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DatePipe, CommonModule } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Transfusion, CreerTransfusionRequest } from '../../../../../interfaces/transfusion.interface';
import { Medecin } from '../../../../../interfaces/medecin.interface';
import { ProduitSanguin } from '../../../../../interfaces/produit-sanguin.interface';
import { ProduitSanguinService } from '../../../../../services/produit-sanguin.service';
import { UtilisateurService } from '../../../../../services/utilisateur.service';
import { AuthService } from '../../../../../services/auth.service';
import { isMedecin, getUserType } from '../../../../../interfaces/any-utilisateur.interface';
import { MatProgressSpinner } from "@angular/material/progress-spinner";

@Component({
  selector: 'app-edit-transfusion',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinner
],
  providers: [DatePipe],
  templateUrl: './edit-transfusion.component.html',
  styleUrls: ['./edit-transfusion.component.scss']
})
export class EditTransfusionComponent implements OnInit {
  @Input() transfusion: Transfusion | null = null;
  @Output() addedData = new EventEmitter<CreerTransfusionRequest>();
  @Output() saved = new EventEmitter<Transfusion>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  
  private formBuilder = inject(FormBuilder);
  private datePipe = inject(DatePipe);
  private snackBar = inject(MatSnackBar);
  private utilisateurService = inject(UtilisateurService);
  private produitSanguinService = inject(ProduitSanguinService);
  private authService = inject(AuthService);

  // Listes pour les selects
  medecins: Medecin[] = [];
  produitsSanguins: ProduitSanguin[] = [];
  groupesSanguins = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  
  loading = false;
  loadingMedecins = false;
  loadingProduits = false;

  ngOnInit() {
    this.loadMedecins();
    this.loadProduitsSanguins();
    this.initForm();
  }

  private loadMedecins() {
    this.loadingMedecins = true;
    this.utilisateurService.getAllUtilisateurs().subscribe({
      next: (utilisateurs) => {
        // Filtrer seulement les médecins
        this.medecins = utilisateurs.filter(user => {
          const type = getUserType(user);
          return type === 'MEDECIN';
        }) as Medecin[];
        
        console.log(`${this.medecins.length} médecin(s) chargé(s)`);
        this.loadingMedecins = false;
      },
      error: (error) => {
        console.error('Erreur chargement médecins:', error);
        this.showNotification('error', 'Erreur lors du chargement des médecins');
        this.loadingMedecins = false;
      }
    });
  }

  private loadProduitsSanguins() {
    this.loadingProduits = true;
    this.produitSanguinService.getAll().subscribe({
      next: (produits) => {
        this.produitsSanguins = produits || [];
        console.log(`${this.produitsSanguins.length} produit(s) sanguin(s) chargé(s)`);
        this.loadingProduits = false;
      },
      error: (error) => {
        console.error('Erreur chargement produits sanguins:', error);
        this.showNotification('error', 'Erreur lors du chargement des produits sanguins');
        this.loadingProduits = false;
      }
    });
  }

  private initForm() {
    const transfusion = this.transfusion;
    
    // Formater les dates pour les inputs
    const patientDateNaissance = transfusion?.patientDateNaissance 
      ? this.formatDateForInput(transfusion.patientDateNaissance)
      : '';
    
    const dateTransfusion = transfusion?.dateTransfusion
      ? this.formatDateForInput(transfusion.dateTransfusion)
      : this.formatDateForInput(new Date().toISOString());

    // Valeurs par défaut pour le déclarant
    const currentUser = this.authService.getCurrentUser();
    const defaultDeclarant = currentUser ? {
      prenom: currentUser.prenom || '',
      nom: currentUser.nom || '',
      fonction: getUserType(currentUser) === 'MEDECIN' ? 'Médecin' : 
                getUserType(currentUser) === 'PERSONNEL' ? 'Personnel soignant' : 
                getUserType(currentUser) === 'CHEF_SERVICE' ? 'Chef de service' : 'Administrateur'
    } : { prenom: '', nom: '', fonction: '' };

    this.form = this.formBuilder.group({
      // Informations Patient
      patientNom: [transfusion?.patientNom ?? '', [Validators.required, Validators.maxLength(50)]],
      patientPrenom: [transfusion?.patientPrenom ?? '', [Validators.required, Validators.maxLength(50)]],
      patientDateNaissance: [patientDateNaissance, Validators.required],
      patientNumDossier: [transfusion?.patientNumDossier ?? '', [Validators.required, Validators.maxLength(20)]],
      groupeSanguinPatient: [transfusion?.groupeSanguinPatient ?? '', Validators.required],
      
      // Informations Transfusion
      medecinId: [transfusion?.medecinId || transfusion?.medecin?.id || '', Validators.required],
      produitSanguinId: [transfusion?.produitSanguinId || transfusion?.produitSanguin?.id || '', Validators.required],
      dateTransfusion: [dateTransfusion, Validators.required],
      heureDebut: [transfusion?.heureDebut || '08:00', Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)],
      heureFin: [transfusion?.heureFin || '', Validators.pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)],
      volume: [transfusion?.volumeMl || 0, [Validators.min(0), Validators.max(5000)]],
      
      // État et Tolérance
      etatPatientApres: [transfusion?.etatPatientApres || '', Validators.required],
      tolerance: [transfusion?.tolerance || 'Bonne', Validators.required],
      effetsIndesirables: [transfusion?.effetsIndesirables || false],
      typeEffet: [transfusion?.typeEffet || ''],
      graviteEffet: [transfusion?.graviteEffet || ''],
      
      // Déclarant
      prenomDeclarant: [transfusion?.prenomDeclarant || defaultDeclarant.prenom, Validators.required],
      nomDeclarant: [transfusion?.nomDeclarant || defaultDeclarant.nom, Validators.required],
      fonctionDeclarant: [transfusion?.fonctionDeclarant || defaultDeclarant.fonction, Validators.required],
      
      // Observations
      notes: [transfusion?.notes || ''],
      //observations: [transfusion?.observations || ''],
      
      // Champs additionnels
      //temperatureProduit: [transfusion?.temperatureProduit || 22, [Validators.min(1), Validators.max(40)]]
    });

    // Activer/désactiver les champs d'effets indésirables
    this.form.get('effetsIndesirables')?.valueChanges.subscribe(value => {
      if (value) {
        this.form.get('typeEffet')?.setValidators([Validators.required]);
        this.form.get('graviteEffet')?.setValidators([Validators.required]);
      } else {
        this.form.get('typeEffet')?.clearValidators();
        this.form.get('graviteEffet')?.clearValidators();
        this.form.get('typeEffet')?.setValue('');
        this.form.get('graviteEffet')?.setValue('');
      }
      this.form.get('typeEffet')?.updateValueAndValidity();
      this.form.get('graviteEffet')?.updateValueAndValidity();
    });
  }

  onSubmit() {
    console.log('✅ onSubmit() transfusion appelé');
    
    if (this.form.invalid) {
      console.log('❌ Formulaire transfusion invalide', this.form.errors);
      this.markFormGroupTouched();
      this.showNotification('error', 'Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    if (!this.validateTransfusion()) {
      return;
    }
    
    console.log('📦 Données du formulaire transfusion:', this.form.value);
    this.saveTransfusion();
  }

  private saveTransfusion() {
    this.loading = true;
    const formValue = this.form.value;

    // Préparer la requête pour l'API
    const request: CreerTransfusionRequest = {
      medecinId: formValue.medecinId,
      produitSanguinId: formValue.produitSanguinId,
      patientPrenom: formValue.patientPrenom.trim(),
      patientNom: formValue.patientNom.trim(),
      patientDateNaissance: this.formatDateForAPI(formValue.patientDateNaissance),
      patientNumDossier: formValue.patientNumDossier.trim(),
      groupeSanguinPatient: formValue.groupeSanguinPatient,
      heureDebut: formValue.heureDebut,
      heureFin: formValue.heureFin,
      etatPatientApres: formValue.etatPatientApres,
      tolerance: formValue.tolerance,
      effetsIndesirables: formValue.effetsIndesirables,
      typeEffet: formValue.typeEffet,
      prenomDeclarant: formValue.prenomDeclarant.trim(),
      nomDeclarant: formValue.nomDeclarant.trim(),
      fonctionDeclarant: formValue.fonctionDeclarant.trim(),
      volumeMl: formValue.volume,
      notes: formValue.notes,
      dateTransfusion: ''
    };

    // Si c'est une modification
    if (this.transfusion?.id) {
      const selectedMedecin = this.getSelectedMedecin(formValue.medecinId);
      const selectedProduit = this.getSelectedProduitSanguin(formValue.produitSanguinId);
      
      const updatedTransfusion: Transfusion = {
        ...this.transfusion,
        ...formValue,
        id: this.transfusion.id,
        patientDateNaissance: this.formatDateForAPI(formValue.patientDateNaissance),
        dateTransfusion: this.formatDateForAPI(formValue.dateTransfusion),
        medecin: selectedMedecin,
        produitSanguin: selectedProduit,
        medecinId: selectedMedecin?.id,
        produitSanguinId: selectedProduit?.id
      };
      
      this.saved.emit(updatedTransfusion);
    } else {
      this.addedData.emit(request);
    }
    
    this.loading = false;
  }

  private getSelectedMedecin(medecinId: number): Medecin | undefined {
    return this.medecins.find(m => m.id === medecinId);
  }

  private getSelectedProduitSanguin(produitSanguinId: number): ProduitSanguin | undefined {
    return this.produitsSanguins.find(p => p.id === produitSanguinId);
  }

  private validateTransfusion(): boolean {
    const formValue = this.form.value;

    // Validation de la date de naissance
    const birthDate = new Date(formValue.patientDateNaissance);
    if (birthDate > new Date()) {
      this.showNotification('error', 'La date de naissance ne peut pas être dans le futur');
      return false;
    }

    // Validation de la date de transfusion
    const transfusionDate = new Date(formValue.dateTransfusion);
    if (transfusionDate > new Date()) {
      this.showNotification('error', 'La date de transfusion ne peut pas être dans le futur');
      return false;
    }

    // Validation de l'âge (minimum 0, maximum 120 ans)
    const age = this.calculateAge(birthDate);
    if (age > 120) {
      this.showNotification('error', 'L\'âge du patient semble invalide');
      return false;
    }

    // Validation des heures
    if (formValue.heureFin) {
      const heureDebut = this.timeToMinutes(formValue.heureDebut);
      const heureFin = this.timeToMinutes(formValue.heureFin);
      
      if (heureFin <= heureDebut) {
        this.showNotification('error', 'L\'heure de fin doit être après l\'heure de début');
        return false;
      }
    }

    // Validation du volume
    if (formValue.volume < 0 || formValue.volume > 5000) {
      this.showNotification('error', 'Le volume doit être compris entre 0 et 5000 ml');
      return false;
    }

    // Validation de la température
    if (formValue.temperatureProduit < 1 || formValue.temperatureProduit > 40) {
      this.showNotification('error', 'La température doit être comprise entre 1°C et 40°C');
      return false;
    }

    return true;
  }

  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  private timeToMinutes(time: string): number {
    if (!time) return 0;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private markFormGroupTouched() {
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.markAsTouched();
    });
  }

  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  private formatDateForAPI(date: string): string {
    if (!date) return '';
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }
    return this.datePipe.transform(date, 'yyyy-MM-dd') || '';
  }

  private showNotification(type: 'success' | 'error' | 'info' | 'warning', message: string) {
    const duration = type === 'error' ? 5000 : 3000;
    
    this.snackBar.open(message, 'Fermer', {
      duration: duration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [`snackbar-${type}`]
    });
  }

  cancel() {
    console.log('❌ Annulation transfusion');
    this.cancelled.emit();
  }

  // Méthodes utilitaires pour le template
  getMedecinDisplayName(medecin: Medecin): string {
    return `Dr ${medecin.prenom} ${medecin.nom} - ${medecin.specialite || 'Médecin'}`;
  }

  getProduitSanguinDisplayName(produit: ProduitSanguin): string {
    return `${produit.codeProduit} - ${produit.typeProduit} (${produit.groupeSanguin})`;
  }

  get isEditMode(): boolean {
    return !!this.transfusion?.id;
  }

  // Calcul automatique de la durée de transfusion
  calculateDuree(): string {
    const heureDebut = this.form.get('heureDebut')?.value;
    const heureFin = this.form.get('heureFin')?.value;
    
    if (!heureDebut || !heureFin) return '';
    
    const debutMinutes = this.timeToMinutes(heureDebut);
    const finMinutes = this.timeToMinutes(heureFin);
    
    if (finMinutes <= debutMinutes) return '';
    
    const dureeMinutes = finMinutes - debutMinutes;
    const heures = Math.floor(dureeMinutes / 60);
    const minutes = dureeMinutes % 60;
    
    if (heures > 0) {
      return `${heures}h${minutes > 0 ? ` ${minutes}min` : ''}`;
    } else {
      return `${minutes} min`;
    }
  }

  // Calcul automatique de la vitesse de transfusion
  calculateVitesse(): number | null {
    const volume = this.form.get('volume')?.value;
    const dureeText = this.calculateDuree();
    
    if (!volume || volume <= 0 || !dureeText) return null;
    
    // Convertir la durée textuelle en minutes
    let totalMinutes = 0;
    if (dureeText.includes('h')) {
      const parts = dureeText.split('h');
      const heures = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1].replace('min', '').trim()) || 0;
      totalMinutes = heures * 60 + minutes;
    } else if (dureeText.includes('min')) {
      totalMinutes = parseInt(dureeText.replace('min', '').trim()) || 0;
    }
    
    if (totalMinutes <= 0) return null;
    
    // Calculer la vitesse en ml/h
    return Math.round((volume / totalMinutes) * 60 * 100) / 100;
  }

  // Vérifier si le déclarant est l'utilisateur connecté
  isCurrentUserDeclarant(): boolean {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return false;
    
    const formPrenom = this.form.get('prenomDeclarant')?.value;
    const formNom = this.form.get('nomDeclarant')?.value;
    
    return formPrenom === currentUser.prenom && formNom === currentUser.nom;
  }

  // Utiliser l'utilisateur connecté comme déclarant
  useCurrentUserAsDeclarant() {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) return;
    
    this.form.patchValue({
      prenomDeclarant: currentUser.prenom || '',
      nomDeclarant: currentUser.nom || '',
      fonctionDeclarant: getUserType(currentUser) === 'MEDECIN' ? 'Médecin' : 
                       getUserType(currentUser) === 'PERSONNEL' ? 'Personnel soignant' : 
                       getUserType(currentUser) === 'CHEF_SERVICE' ? 'Chef de service' : 'Administrateur'
    });
  }
}