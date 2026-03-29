import { Component, inject, input, OnInit, output, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AuthService } from '../../../../../services/auth.service';
import { CreerIncidentRequest, IncidentTransfusionnelService } from '../../../../../services/Incident-transfusionnel.service';
import { IncidentTransfusionnel } from '../../../../../interfaces/incident-transfusionnel.interface';
import { Transfusion } from '../../../../../interfaces/transfusion.interface';
import { TransfusionService } from '../../../../../services/transfusion.service';
import { AnyUtilisateur, getUserType, isPersonnel, isChefService, isAdmin } from '../../../../../interfaces/any-utilisateur.interface';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-edit-incident',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule, 
    MatButtonModule, 
    MatIconModule,
    MatSelectModule
  ],
  providers: [DatePipe],
  templateUrl: './edit-incident.component.html',
  styleUrl: './edit-incident.component.scss'
})
export class EditIncidentComponent implements OnInit, OnDestroy {
  // Inputs et Outputs
  updateItem = input<IncidentTransfusionnel | null>();
  addedData = output<CreerIncidentRequest>();
  saved = output<IncidentTransfusionnel>();
  cancelled = output<void>();

  // Formulaires et services
  form!: FormGroup;
  private formBuilder = inject(FormBuilder);
  private datePipe = inject(DatePipe);
  private authService = inject(AuthService);
  private transfusionService = inject(TransfusionService);
  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // États
  currentUser = this.authService.getCurrentUser();
  transfusionsCompatibles: Transfusion[] = [];
  loadingTransfusions = false;
  selectedTransfusion: Transfusion | null = null;
  isEditMode = false;
  isArretTransfusion = false;
  transfusionIdFromContext: number | null = null;

  // Options pour les types de produits
  typeProduitOptions = [
    { value: 'CGR', label: 'CGR (Concentré de Globules Rouges)' },
    { value: 'CPP', label: 'CPP (Concentré de Plaquettes)' },
    { value: 'PFC', label: 'PFC (Plasma Frais Congelé)' },
    { value: 'CGL', label: 'CGL (Concentré de Globules Leucoplaquettaires)' },
    { value: 'OTHER', label: 'Autre produit' }
  ];

  // Lieux suggérés
  lieuSuggestions = [
    'Salle de transfusion',
    'Unité de soins',
    'Chambre patient',
    'Bloc opératoire',
    'Service de médecine',
    'Urgences',
    'Réanimation',
    'Hôpital de jour',
    'Maternité',
    'Oncologie'
  ];

  ngOnInit() {
    console.log('🚀 EditIncidentComponent ngOnInit');
    
    // Récupérer le state depuis l'historique de navigation
    const navigationState = history.state;
    console.log('📌 Navigation state depuis history:', navigationState);
    
    this.isEditMode = !!this.updateItem();
    
    // Vérifier si des données sont passées via state
    if (navigationState) {
        console.log('📥 Données reçues depuis history state:', navigationState);
        
        if (navigationState.transfusionId) {
            this.transfusionIdFromContext = Number(navigationState.transfusionId);
            
            if (navigationState.context === 'arret-transfusion') {
                this.isArretTransfusion = true;
                console.log('🔄 Mode: Arrêt de transfusion pour #', this.transfusionIdFromContext);
            }
        }
    }
    
    // Initialiser le formulaire
    this.initForm();
    
    // Traiter les données supplémentaires APRÈS l'initialisation du formulaire
    if (navigationState) {
        if (navigationState.transfusionId) {
            const transfusionId = Number(navigationState.transfusionId);
            
            if (navigationState.context === 'arret-transfusion') {
                // Préparer les données spécifiques à l'arrêt
                this.prepareArretTransfusionData(
                    transfusionId, 
                    navigationState.prefillData
                );
            } else {
                // Cas normal - juste charger les détails
                this.form.patchValue({
                    transfusionId: transfusionId
                });
                this.loadTransfusionDetails(transfusionId);
            }
        }
    }
    
    // NE PAS charger les transfusions compatibles si c'est un arrêt de transfusion
    if (!this.isEditMode && !this.isArretTransfusion) {
        this.loadTransfusionsCompatibles();
    } else if (this.isArretTransfusion) {
        console.log('🔄 Mode arrêt de transfusion: saut du chargement des transfusions compatibles');
    }
    
    this.setupFormListeners();
    
    // Débogage initial
    setTimeout(() => {
        this.debugFormState();
    }, 100);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Initialise le formulaire
   */
  private initForm() {
    const item = this.updateItem();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0].substring(0, 5);

    // Déterminer la valeur pour transfusionId
    let transfusionIdValue = 0;
    let transfusionIdDisabled = false;
    
    // Priorité : arrêt de transfusion
    if (this.isArretTransfusion && this.transfusionIdFromContext) {
        transfusionIdValue = this.transfusionIdFromContext;
        transfusionIdDisabled = true;
        console.log('✅ Mode arrêt transfusion - transfusionId défini:', transfusionIdValue);
    } 
    // Ensuite : mode édition
    else if (this.isEditMode && item?.transfusion?.id) {
        transfusionIdValue = Number(item.transfusion.id);
        transfusionIdDisabled = true;
        console.log('✅ Mode édition - transfusionId défini:', transfusionIdValue);
    }

    // Création du formulaire
    this.form = this.formBuilder.group({
        // Champ transfusionId - CRITIQUE pour le backend
        transfusionId: [{ 
            value: transfusionIdValue, 
            disabled: transfusionIdDisabled 
        }, this.isEditMode || this.isArretTransfusion ? [] : [Validators.required, Validators.min(1)]],
        
        // Informations Patient
        patientNom: [item?.patientNom ?? '', Validators.required],
        patientPrenom: [item?.patientPrenom ?? '', Validators.required],
        patientDateNaissance: [
            item?.patientDateNaissance ? this.formatDateForInput(item.patientDateNaissance) : '',
            Validators.required
        ],
        patientNumDossier: [item?.patientNumDossier ?? '', Validators.required],
        
        // Informations Incident
        dateIncident: [item?.dateIncident ?? today, Validators.required],
        heureIncident: [item?.heureIncident ?? now, Validators.required],
        lieuIncident: [item?.lieuIncident ?? this.lieuSuggestions[0], Validators.required],
        
        // Informations Produit
        typeProduitTransfuse: [item?.typeProduitTransfuse ?? 'CGR', Validators.required],
        numeroLotProduit: [item?.numeroLotProduit ?? '', Validators.required],
        datePeremptionProduit: [
            item?.datePeremptionProduit ? this.formatDateForInput(item.datePeremptionProduit) : '',
            Validators.required
        ],
        
        // Description Incident
        descriptionIncident: [item?.descriptionIncident ?? ''],
        signes: [item?.signes ?? ''],
        symptomes: [item?.symptomes ?? ''],
        actionsImmediates: [item?.actionsImmediates ?? ''],
        
        // Informations Déclarant
        nomDeclarant: [item?.nomDeclarant ?? this.getCurrentUserFullName(), Validators.required],
        fonctionDeclarant: [item?.fonctionDeclarant ?? this.getDefaultFonction(), Validators.required],
        personnesInformees: [item?.personnesInformees ?? ''],
        
        // Informations Complémentaires
        registreHemovigilance: [item?.registreHemovigilance ?? ''],
        analysePreliminaire: [item?.analysePreliminaire ?? ''],
        actionsCorrectives: [item?.actionsCorrectives ?? ''],
        
        // Signature
        signatureDeclarant: [item?.signatureDeclarant ?? '']
    });

    // Charger les détails de la transfusion si disponible
    if (transfusionIdValue > 0) {
        console.log('🚀 Chargement des détails de transfusion #', transfusionIdValue);
        this.loadTransfusionDetails(transfusionIdValue);
    }
  }

  /**
   * Configure les listeners du formulaire
   */
  private setupFormListeners() {
    // Écoute les changements de sélection de transfusion (uniquement en création et si pas d'arrêt)
    if (!this.isEditMode && !this.isArretTransfusion) {
        this.form.get('transfusionId')?.valueChanges
            .pipe(
                takeUntil(this.destroy$),
                debounceTime(300),
                distinctUntilChanged()
            )
            .subscribe((transfusionId: number) => {
                console.log('🔄 Changement de transfusionId:', transfusionId);
                if (transfusionId && transfusionId > 0) {
                    this.loadTransfusionDetails(transfusionId);
                }
            });
    }
  }

  /**
   * Charge les transfusions compatibles (sans incident)
   */
  private loadTransfusionsCompatibles() {
    if (this.isArretTransfusion) {
        return;
    }
    
    this.loadingTransfusions = true;
    
    this.transfusionService.getTransfusionsCompatibles().subscribe({
        next: (transfusions) => {
            this.transfusionsCompatibles = transfusions;
            this.loadingTransfusions = false;
            console.log('📊 Transfusions compatibles chargées:', transfusions.length);
        },
        error: (error) => {
            console.error('❌ Erreur chargement transfusions compatibles:', error);
            this.loadingTransfusions = false;
        }
    });
  }

  /**
   * Charge les détails d'une transfusion spécifique
   */
  private loadTransfusionDetails(transfusionId: number) {
    console.log('🔍 Chargement détails transfusion #', transfusionId);
    
    this.transfusionService.getById(transfusionId).subscribe({
        next: (transfusion) => {
            this.selectedTransfusion = transfusion;
            this.prefillFormWithTransfusion(transfusion);
            
            // Forcer la détection de changement
            this.cdr.detectChanges();
            
            console.log('✅ Détails transfusion chargés:', transfusion.id);
        },
        error: (error) => {
            console.error('❌ Erreur chargement détails transfusion:', error);
        }
    });
  }

  /**
   * Pré-remplit le formulaire avec les informations de la transfusion
   */
  private prefillFormWithTransfusion(transfusion: Transfusion) {
    console.log('🔄 Pré-remplissage formulaire pour transfusion #', transfusion.id);
    
    // 1. Informations Patient
    this.form.patchValue({
        patientNom: transfusion.patientNom || '',
        patientPrenom: transfusion.patientPrenom || '',
        patientDateNaissance: this.formatDateForInput(transfusion.patientDateNaissance),
        patientNumDossier: transfusion.patientNumDossier || ''
    });

    // 2. Informations Produit Sanguin
    if (transfusion.produitSanguin) {
        const produit = transfusion.produitSanguin;
        
        const typeProduit = produit.typeProduit || 'CGR';
        const numeroLot = produit.codeProduit 
            ? this.genererNumeroLotDepuisCodeProduit(produit.codeProduit, transfusion.id)
            : this.genererNumeroLotParDefaut(transfusion.id || 0);
        
        const datePeremption = produit.datePeremption || this.estimerDatePeremption(transfusion.dateTransfusion);
        
        this.form.patchValue({
            typeProduitTransfuse: typeProduit,
            numeroLotProduit: numeroLot,
            datePeremptionProduit: this.formatDateForInput(datePeremption)
        });
    }

    // 3. Informations Incident (basées sur la transfusion)
    const now = new Date();
    const heureActuelle = this.formatHeurePourInput(now.toTimeString().split(' ')[0]);
    
    this.form.patchValue({
        dateIncident: this.formatDateForInput(transfusion.dateTransfusion),
        heureIncident: heureActuelle
    });

    // 4. Suggestion de lieu basée sur le numéro de dossier
    if (transfusion.patientNumDossier) {
        const lieuSuggestion = this.genererLieuSuggestion(transfusion.patientNumDossier);
        this.form.patchValue({
            lieuIncident: lieuSuggestion
        });
    }
    
    // 5. Si c'est un arrêt de transfusion, pré-remplir aussi la description
    if (this.isArretTransfusion) {
        this.form.patchValue({
            descriptionIncident: 'Arrêt de la transfusion suite à effet indésirable observé.',
            actionsImmediates: 'Arrêt immédiat de la perfusion, monitoring du patient, appel du médecin.'
        });
    }
  }

  /**
   * Génère un numéro de lot à partir du code produit
   */
  private genererNumeroLotDepuisCodeProduit(codeProduit: string, transfusionId?: number): string {
    const date = new Date();
    const year = date.getFullYear().toString().substring(2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const idSuffix = transfusionId ? `-TR${transfusionId}` : '';
    
    return `LOT-${codeProduit}-${year}${month}${idSuffix}`;
  }

  /**
   * Génère un numéro de lot par défaut
   */
  private genererNumeroLotParDefaut(transfusionId: number): string {
    const date = new Date();
    const year = date.getFullYear().toString().substring(2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const jour = date.getDate().toString().padStart(2, '0');
    
    return `LOT-${year}${month}${jour}-TR${transfusionId}`;
  }

  /**
   * Estime une date de péremption
   */
  private estimerDatePeremption(dateTransfusion: string): string {
    const date = new Date(dateTransfusion);
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().split('T')[0];
  }

  /**
   * Génère une suggestion de lieu
   */
  private genererLieuSuggestion(numeroDossier: string): string {
    const chiffres = numeroDossier.replace(/\D/g, '');
    const numeroChambre = chiffres.slice(-3) || '101';
    
    return `Chambre ${numeroChambre}`;
  }

  /**
   * Formate l'heure pour l'input (HH:mm)
   */
  private formatHeurePourInput(heure: string): string {
    if (!heure) return '';
    
    if (heure.includes(':')) {
      const parts = heure.split(':');
      if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
      }
    }
    
    return heure;
  }

  /**
   * Formate une date pour l'input (YYYY-MM-DD)
   */
  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  /**
   * Formate une date pour l'API (YYYY-MM-DD)
   */
  private formatDateForAPI(date: string): string {
    if (!date) return '';
    
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }
    
    return this.datePipe.transform(date, 'yyyy-MM-dd') || '';
  }

  /**
   * Récupère le nom complet de l'utilisateur connecté
   */
  public getCurrentUserFullName(): string {
    const user = this.currentUser;
    if (!user) return '';
    return `${user.prenom || ''} ${user.nom || ''}`.toUpperCase().trim();
  }

  /**
   * Récupère la fonction par défaut selon le type d'utilisateur
   */
  public getDefaultFonction(): string {
    const user = this.currentUser;
    if (!user) return 'Non spécifié';

    if (isPersonnel(user)) {
      return user.fonction || 'Personnel soignant';
    } else if (isChefService(user)) {
      return `Chef de Service - ${user.serviceDirige || 'Direction'}`;
    } else if (isAdmin(user)) {
      return 'Administrateur';
    } else {
      return getUserType(user) || 'Non spécifié';
    }
  }

  /**
   * Vérifie si l'utilisateur peut déclarer un incident
   */
  private peutDeclarerIncident(): boolean {
    const user = this.currentUser;
    if (!user) return false;

    const userType = getUserType(user);
    return ['PERSONNEL', 'MEDECIN', 'ADMIN', 'CHEF_SERVICE'].includes(userType);
  }

  /**
   * Soumission du formulaire - MÉTHODE CRITIQUE
   */
  onSubmit() {
    console.log('✅ Submit incident appelé');
    
    // Débogage avant validation
    this.debugFormState();
    
    if (this.form.invalid) {
      console.log('❌ Formulaire invalide');
      this.markFormGroupTouched();
      
      // Afficher les erreurs spécifiques
      this.afficherErreursValidation();
      return;
    }

    // Vérifier les permissions
    if (!this.isEditMode && !this.peutDeclarerIncident()) {
      alert('Vous n\'avez pas les permissions pour déclarer un incident');
      return;
    }

    // Validation supplémentaire
    if (!this.validateIncident()) {
      return;
    }

    console.log('📦 Données du formulaire:', this.form.getRawValue());
    this.saveIncident();
  }

  /**
   * Validation personnalisée de l'incident
   */
  private validateIncident(): boolean {
    const formValue = this.form.getRawValue();
    
    console.log('🔍 Validation transfusionId:', formValue.transfusionId);
    
    // Vérification CRITIQUE de transfusionId
    const transfusionId = Number(formValue.transfusionId);
    if (!transfusionId || transfusionId <= 0) {
        console.error('❌ transfusionId invalide:', transfusionId);
        alert('Erreur: Veuillez sélectionner une transfusion valide');
        return false;
    }

    // Validation de la date de naissance
    const birthDate = new Date(formValue.patientDateNaissance);
    if (birthDate > new Date()) {
        alert('La date de naissance ne peut pas être dans le futur');
        return false;
    }

    // Validation de la date de péremption
    const peremptionDate = new Date(formValue.datePeremptionProduit);
    if (peremptionDate < new Date()) {
        if (!confirm('ATTENTION : Le produit transfusé semble périmé. Voulez-vous continuer ?')) {
            return false;
        }
    }

    // Validation de la date de l'incident
    const incidentDate = new Date(formValue.dateIncident);
    if (incidentDate > new Date()) {
        alert('La date de l\'incident ne peut pas être dans le futur');
        return false;
    }

    // Validation de l'heure
    if (!this.validateHeureFormat(formValue.heureIncident)) {
        alert('Format d\'heure invalide. Utilisez HH:mm (ex: 14:30)');
        return false;
    }
    
    // Validation supplémentaire pour l'arrêt de transfusion
    if (this.isArretTransfusion) {
        if (!formValue.descriptionIncident || formValue.descriptionIncident.trim() === '') {
            alert('Veuillez décrire l\'incident qui a motivé l\'arrêt de la transfusion');
            return false;
        }
        
        if (!formValue.actionsImmediates || formValue.actionsImmediates.trim() === '') {
            alert('Veuillez décrire les actions immédiates prises suite à l\'arrêt de la transfusion');
            return false;
        }
    }

    return true;
  }

  /**
   * Affiche les erreurs de validation
   */
  private afficherErreursValidation(): void {
    const errors: string[] = [];
    
    Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        if (control?.invalid && control?.touched) {
            const fieldName = this.getFieldLabel(key);
            
            if (control.errors?.['required']) {
                errors.push(`${fieldName} est obligatoire`);
            } else if (control.errors?.['min']) {
                errors.push(`${fieldName} doit être supérieur à 0`);
            } else if (control.errors?.['pattern']) {
                errors.push(`${fieldName} a un format invalide`);
            }
        }
    });
    
    if (errors.length > 0) {
        alert('Veuillez corriger les erreurs suivantes:\n\n' + errors.join('\n'));
    }
  }

  private getFieldLabel(field: string): string {
    const labels: {[key: string]: string} = {
        'transfusionId': 'Transfusion',
        'patientNom': 'Nom du patient',
        'patientPrenom': 'Prénom du patient',
        'patientDateNaissance': 'Date de naissance',
        'patientNumDossier': 'Numéro de dossier',
        'dateIncident': 'Date de l\'incident',
        'heureIncident': 'Heure de l\'incident',
        'lieuIncident': 'Lieu de l\'incident',
        'typeProduitTransfuse': 'Type de produit',
        'numeroLotProduit': 'Numéro de lot',
        'datePeremptionProduit': 'Date de péremption',
        'nomDeclarant': 'Nom du déclarant',
        'fonctionDeclarant': 'Fonction du déclarant'
    };
    
    return labels[field] || field;
  }

  /**
   * Obtient le contexte de l'incident pour l'affichage
   */
  getIncidentContext(): string {
    if (this.isEditMode) {
        return 'Édition d\'incident existant';
    } else if (this.isArretTransfusion) {
        return 'Arrêt de transfusion';
    } else {
        return 'Déclaration d\'incident standard';
    }
  }

  /**
   * Valide le format de l'heure
   */
  private validateHeureFormat(heure: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(heure);
  }

  /**
   * Sauvegarde de l'incident - MÉTHODE CORRIGÉE
   */
  private saveIncident() {
    const formValue = this.form.getRawValue();
    
    console.log('📋 Données formulaire brut:', formValue);
    
    // VÉRIFICATION CRITIQUE DE transfusionId
    const transfusionId = Number(formValue.transfusionId);
    
    if (!transfusionId || transfusionId <= 0) {
        console.error('❌ ERREUR CRITIQUE: transfusionId invalide:', formValue.transfusionId);
        alert('Erreur: La transfusion n\'est pas spécifiée. Veuillez réessayer.');
        return;
    }
    
    console.log('📋 transfusionId validé:', transfusionId, 'Type:', typeof transfusionId);
    
    // Construction de la requête EXACTEMENT COMME LE BACKEND L'ATTEND
    const newIncidentRequest: CreerIncidentRequest = {
        // ENVOYER transfusionId DIRECTEMENT (pas d'objet transfusion)
        transfusionId: transfusionId,
        
        // Dates formatées
        dateIncident: this.formatDateForAPI(formValue.dateIncident),
        heureIncident: formValue.heureIncident, // Le service formatera en HH:mm:ss
        patientDateNaissance: this.formatDateForAPI(formValue.patientDateNaissance),
        datePeremptionProduit: this.formatDateForAPI(formValue.datePeremptionProduit),
        
        // Champs texte
        lieuIncident: (formValue.lieuIncident || '').trim(),
        patientPrenom: (formValue.patientPrenom || '').trim(),
        patientNom: (formValue.patientNom || '').trim(),
        patientNumDossier: (formValue.patientNumDossier || '').trim(),
        typeProduitTransfuse: (formValue.typeProduitTransfuse || '').trim(),
        numeroLotProduit: (formValue.numeroLotProduit || '').trim(),
        nomDeclarant: (formValue.nomDeclarant || '').trim(),
        fonctionDeclarant: (formValue.fonctionDeclarant || '').trim(),
        
        // Champs optionnels (undefined pour que le service les transforme en null)
        descriptionIncident: formValue.descriptionIncident,
        signes: formValue.signes,
        symptomes: formValue.symptomes,
        actionsImmediates: formValue.actionsImmediates,
        personnesInformees: formValue.personnesInformees,
        analysePreliminaire: formValue.analysePreliminaire,
        actionsCorrectives: formValue.actionsCorrectives,
        registreHemovigilance: formValue.registreHemovigilance,
        signatureDeclarant: formValue.signatureDeclarant
    };
    
    console.log('📦 Requête API finale:', JSON.stringify(newIncidentRequest, null, 2));
    console.log('📦 transfusionId envoyé:', newIncidentRequest.transfusionId);
    
    // Émettre les données vers le composant parent
    this.addedData.emit(newIncidentRequest);
  }

  /**
   * Marque tous les champs comme touchés
   */
  private markFormGroupTouched() {
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Annulation
   */
  cancel() {
    console.log('❌ Annulation incident');
    this.cancelled.emit();
  }

  /**
   * Méthodes publiques pour le template
   */

  /**
   * Regénère un nouveau numéro de lot
   */
  regenererNumeroLot() {
    if (this.selectedTransfusion) {
      const nouveauNumeroLot = this.selectedTransfusion.produitSanguin?.codeProduit
        ? this.genererNumeroLotDepuisCodeProduit(
            this.selectedTransfusion.produitSanguin.codeProduit,
            this.selectedTransfusion.id
          )
        : this.genererNumeroLotParDefaut(this.selectedTransfusion.id || 0);
      
      this.form.patchValue({
        numeroLotProduit: nouveauNumeroLot
      });
    }
  }

  /**
   * Formate une date pour l'affichage
   */
  formatDateForDisplay(dateString: string): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Formate une date-heure pour l'affichage
   */
  formatDateTimeForDisplay(dateTimeString: string): string {
    if (!dateTimeString) return 'N/A';
    
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateTimeString;
    }
  }

  /**
   * Obtient la description de la transfusion pour l'affichage
   */
  getTransfusionDescription(transfusion: Transfusion): string {
    return `#${transfusion.id} - ${transfusion.patientPrenom} ${transfusion.patientNom} (${this.formatDateForDisplay(transfusion.dateTransfusion)})`;
  }

  /**
   * Calcule l'âge du patient
   */
  calculateAge(dateNaissance: string): number {
    if (!dateNaissance) return 0;
    
    try {
      const birthDate = new Date(dateNaissance);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      return age;
    } catch {
      return 0;
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR');
    } catch {
        return dateString;
    }
  }

  /**
   * Prépare les données pour l'arrêt de transfusion
   */
  prepareArretTransfusionData(transfusionId: number, prefillData?: any): void {
    console.log('🔄 Préparation données arrêt transfusion:', transfusionId, prefillData);
    
    // 1. Mettre à jour l'ID de transfusion dans le formulaire
    if (transfusionId && transfusionId > 0) {
        console.log('📝 Définition transfusionId dans le formulaire:', transfusionId);
        
        this.form.patchValue({
            transfusionId: transfusionId
        }, { emitEvent: false });
        
        // Forcer la validation
        const control = this.form.get('transfusionId');
        if (control) {
            control.updateValueAndValidity();
        }
    }
    
    // 2. Charger les détails de la transfusion
    if (transfusionId && transfusionId > 0) {
        this.loadTransfusionDetails(transfusionId);
    }
    
    // 3. Pré-remplir les autres champs si nécessaire
    if (prefillData) {
        setTimeout(() => {
            console.log('📝 Application des données pré-remplies:', prefillData);
            
            const fieldsToPatch: any = {};
            Object.keys(prefillData).forEach(key => {
                if (this.form.get(key)) {
                    if (key === 'patientDateNaissance' || key === 'datePeremptionProduit' || key === 'dateIncident') {
                        fieldsToPatch[key] = this.formatDateForInput(prefillData[key]);
                    } else {
                        fieldsToPatch[key] = prefillData[key];
                    }
                }
            });
            
            this.form.patchValue(fieldsToPatch, { emitEvent: false });
            
            // S'assurer que les champs obligatoires sont remplis
            if (!this.form.get('descriptionIncident')?.value) {
                this.form.patchValue({
                    descriptionIncident: 'Arrêt de la transfusion suite à effet indésirable observé.'
                }, { emitEvent: false });
            }
            
            if (!this.form.get('actionsImmediates')?.value) {
                this.form.patchValue({
                    actionsImmediates: 'Arrêt immédiat de la perfusion, monitoring du patient, appel du médecin.'
                }, { emitEvent: false });
            }
        }, 1000);
    }
  }

  /**
   * Méthode de débogage
   */
  debugFormState(): void {
    console.log('=== DEBUG ÉTAT FORMULAIRE ===');
    console.log('1. Mode:', this.isEditMode ? 'ÉDITION' : this.isArretTransfusion ? 'ARRÊT TRANSFUSION' : 'CRÉATION');
    console.log('2. transfusionId du formulaire:', this.form?.get('transfusionId')?.value);
    console.log('3. Type transfusionId:', typeof this.form?.get('transfusionId')?.value);
    console.log('4. Form valid:', this.form?.valid);
    console.log('5. Form invalid:', this.form?.invalid);
    
    // Lister les champs invalides
    const invalidFields: string[] = [];
    if (this.form) {
        Object.keys(this.form.controls).forEach(key => {
            const control = this.form.get(key);
            if (control?.invalid) {
                invalidFields.push(`${key}: ${JSON.stringify(control.errors)}`);
            }
        });
    }
    
    if (invalidFields.length > 0) {
        console.log('❌ Champs invalides:', invalidFields);
    } else {
        console.log('✅ Tous les champs sont valides');
    }
    
    console.log('6. selectedTransfusion:', this.selectedTransfusion?.id);
    console.log('7. isArretTransfusion:', this.isArretTransfusion);
    console.log('8. transfusionIdFromContext:', this.transfusionIdFromContext);
    console.log('================================');
  }
}