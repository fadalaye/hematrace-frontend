import { 
  Component, 
  OnInit, 
  OnDestroy, 
  inject, 
  signal, 
  computed,
  ChangeDetectorRef
} from '@angular/core';
import { 
  CommonModule
} from '@angular/common';
import { 
  FormBuilder, 
  FormGroup, 
  Validators, 
  ReactiveFormsModule 
} from '@angular/forms';
import { 
  MatFormFieldModule 
} from '@angular/material/form-field';
import { 
  MatInputModule 
} from '@angular/material/input';
import { 
  MatSelectModule 
} from '@angular/material/select';
import { 
  MatButtonModule 
} from '@angular/material/button';
import { 
  MatIconModule 
} from '@angular/material/icon';
import { 
  MatDatepickerModule 
} from '@angular/material/datepicker';
import { 
  MatNativeDateModule 
} from '@angular/material/core';
import { 
  MatCheckboxModule 
} from '@angular/material/checkbox';
import { 
  MatTooltipModule 
} from '@angular/material/tooltip';
import { 
  MatProgressSpinnerModule 
} from '@angular/material/progress-spinner';
import { 
  MatSnackBar, 
  MatSnackBarModule 
} from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { forkJoin, Subject } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import { takeUntil } from 'rxjs/operators';

// Interfaces
import { Delivrance } from '../../../../interfaces/delivrance.interface';
import { 
  Transfusion,
  CreerTransfusionRequest,
  SurveillanceRequest
} from '../../../../interfaces/transfusion.interface';
import { Medecin } from '../../../../interfaces/medecin.interface';
import { ProduitSanguin } from '../../../../interfaces/produit-sanguin.interface';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../services/auth.service';

// Services
import { DelivranceService } from '../../../../services/delivrance.service';
import { TransfusionService } from '../../../../services/transfusion.service';
import { UtilisateurService } from '../../../../services/utilisateur.service';
import { environment } from '../../../../../environments/environment';

// Interface locale pour les surveillances dans le formulaire
interface SurveillanceForm {
  heure: string;
  pouls: number | null;
  temperature: number | null;
  tension: string;
  observations: string;
  signesCliniques: string;
}

@Component({
  selector: 'app-transfusion-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './transfusion-form.component.html',
  styleUrls: ['./transfusion-form.component.scss']
})
export class TransfusionFormComponent implements OnInit, OnDestroy {
  // Services
  private fb = inject(FormBuilder);
  private delivranceService = inject(DelivranceService);
  private transfusionService = inject(TransfusionService);
  private utilisateurService = inject(UtilisateurService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  // États
  private destroy$ = new Subject<void>();
  
  // Signaux pour l'état
  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  arretEnCours = signal<boolean>(false);
  mode = signal<'create' | 'edit'>('create');
  transfusionId = signal<number | null>(null);
  currentUser = signal<any>(null);
  showValidationErrors = false;
  
  // Signaux pour les données
  delivrances = signal<Delivrance[]>([]);
  filteredDelivrances = signal<Delivrance[]>([]);
  medecins = signal<Medecin[]>([]);
  selectedDelivrance = signal<Delivrance | null>(null);
  
  // Signaux pour les filtres
  searchTerm = signal<string>('');
  destinationFilter = signal<string>('');
  destinations = signal<string[]>([]);
  
  // Signal pour la sélection des produits (MASTER) - UN SEUL produit sélectionné à la fois
  selectedProducts = signal<boolean[]>([]);
  
  // Signaux pour suivre les produits traités
  produitsTraites = signal<number[]>([]); // IDs des produits déjà transfusés
  produitEnCours = signal<ProduitSanguin | null>(null); // Produit actuellement sélectionné
  
  // Signal pour les surveillances
  surveillances = signal<SurveillanceForm[]>([{
    heure: this.getCurrentTime(),
    pouls: null,
    temperature: null,
    tension: '',
    observations: '',
    signesCliniques: ''
  }]);

  // Dates limites
  minDate: Date;
  maxDate: Date;

  // Formulaire de transfusion (DETAIL)
  transfusionForm: FormGroup;

  // Computed pour les produits disponibles
  produitsDisponibles = computed(() => {
    if (!this.selectedDelivrance() || !this.selectedDelivrance()!.produitsSanguins) {
      return [];
    }
    
    const produitsTraites = this.produitsTraites();
    return this.selectedDelivrance()!.produitsSanguins!.filter(
      produit => !produitsTraites.includes(produit.id!)
    );
  });

  constructor() {
    // Initialiser les dates limites
    const now = new Date();
    this.minDate = new Date(2000, 0, 1); // 1er Janvier 2000
    this.maxDate = now; // Aujourd'hui
    
    // Initialiser le formulaire avec des valeurs par défaut
    const heureDebut = this.getCurrentTime();
    
    this.transfusionForm = this.fb.group({
      // Informations médicales
      medecinId: ['', Validators.required],
      dateTransfusion: [now, [Validators.required, this.futureDateValidator]],
      heureDebut: [heureDebut, Validators.required],
      volume: [null, [Validators.min(0), Validators.max(5000)]],
      temperatureProduit: [null, [Validators.min(1), Validators.max(40)]],
      tolerance: ['Bonne', Validators.required],
      etatPatientApres: ['', Validators.required],
      
      // Déclarant
      prenomDeclarant: ['', [Validators.required, Validators.minLength(2)]],
      nomDeclarant: ['', [Validators.required, Validators.minLength(2)]],
      fonctionDeclarant: ['', [Validators.required, Validators.minLength(2)]],
      
      // Informations complémentaires
      notes: [''],
      observations: [''],
      
      // Effets indésirables
      effetsIndesirables: [false],
      typeEffet: [''],
      graviteEffet: ['']
    });

    // Validation conditionnelle pour les effets indésirables
    this.transfusionForm.get('effetsIndesirables')?.valueChanges.subscribe(value => {
      if (value) {
        this.transfusionForm.get('typeEffet')?.setValidators([Validators.required]);
        this.transfusionForm.get('graviteEffet')?.setValidators([Validators.required]);
      } else {
        this.transfusionForm.get('typeEffet')?.clearValidators();
        this.transfusionForm.get('graviteEffet')?.clearValidators();
      }
      this.transfusionForm.get('typeEffet')?.updateValueAndValidity();
      this.transfusionForm.get('graviteEffet')?.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    console.log('=== COMPOSANT TRANSFUSION INITIALISÉ ===');

    this.loadCurrentUser();
    
    // Récupérer le mode depuis les données de la route
    this.route.data.subscribe(data => {
      this.mode.set(data['mode'] || 'create');
      console.log('Mode détecté:', this.mode());
    });
    
    // Récupérer l'ID pour le mode edit
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.transfusionId.set(+params['id']);
        console.log('ID transfusion:', this.transfusionId());
        
        if (this.mode() === 'edit') {
          this.loadTransfusionData(this.transfusionId()!);
        }
      }
    });
    
    // Charger les données initiales
    this.loadInitialData();
  }

  // ========== VALIDATEURS PERSONNALISÉS ==========

  /**
   * Validateur pour empêcher les dates futures
   */
  private futureDateValidator(control: any) {
    if (!control.value) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const inputDate = new Date(control.value);
    inputDate.setHours(0, 0, 0, 0);
    
    return inputDate > today ? { futureDate: true } : null;
  }

  // ========== MÉTHODES DE VALIDATION ==========

  /**
   * Valide tous les champs obligatoires pour le bouton "Transfuser ce produit"
   */
  isFormValidForTransfusion(): boolean {
    // 1. Vérifier qu'une délivrance est sélectionnée
    if (!this.selectedDelivrance()) {
      return false;
    }
    
    // 2. Vérifier qu'un seul produit est sélectionné et non traité
    if (!this.isProduitUniqueSelectionne()) {
      return false;
    }
    
    // 3. Valider les champs obligatoires du formulaire principal
    if (!this.validateRequiredFields()) {
      return false;
    }
    
    // 4. Valider les surveillances
    if (!this.validateSurveillances()) {
      return false;
    }
    
    // 5. Valider le déclarant
    if (!this.validateDeclarant()) {
      return false;
    }
    
    return true;
  }

  /**
   * Valide les champs pour le bouton "Arrêter et déclarer incident"
   */
  isFormValidForIncident(): boolean {
    // Tous les mêmes validations que pour la transfusion
    if (!this.isFormValidForTransfusion()) {
      return false;
    }
    
    // Validation supplémentaire pour les effets indésirables
    const form = this.transfusionForm.value;
    
    // Si des effets indésirables sont cochés, les champs doivent être remplis
    if (form.effetsIndesirables) {
      if (!form.typeEffet || !form.graviteEffet) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Valide les champs obligatoires du formulaire principal
   */
  private validateRequiredFields(): boolean {
    const form = this.transfusionForm;
    
    // Liste des champs obligatoires avec messages
    const requiredFields = [
      { control: form.get('medecinId'), message: 'Le médecin responsable est requis' },
      { control: form.get('dateTransfusion'), message: 'La date de transfusion est requise' },
      { control: form.get('heureDebut'), message: 'L\'heure de début est requise' },
      { control: form.get('tolerance'), message: 'La tolérance est requise' },
      { control: form.get('etatPatientApres'), message: 'L\'état du patient après transfusion est requis' }
    ];
    
    for (const field of requiredFields) {
      if (!field.control?.value) {
        field.control?.markAsTouched();
        return false;
      }
    }
    
    // Validation de la date (doit être aujourd'hui ou dans le passé)
    const dateTransfusion = form.get('dateTransfusion')?.value;
    if (dateTransfusion) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const transfusionDate = new Date(dateTransfusion);
      transfusionDate.setHours(0, 0, 0, 0);
      
      if (transfusionDate > today) {
        form.get('dateTransfusion')?.setErrors({ futureDate: true });
        return false;
      }
    }
    
    // Validation du volume (si renseigné)
    const volume = form.get('volume')?.value;
    if (volume !== null && volume !== undefined && volume !== '') {
      const volumeNum = Number(volume);
      if (volumeNum < 0 || volumeNum > 5000) {
        form.get('volume')?.setErrors({ range: true });
        return false;
      }
    }
    
    // Validation de la température (si renseignée)
    const temperature = form.get('temperatureProduit')?.value;
    if (temperature !== null && temperature !== undefined && temperature !== '') {
      const tempNum = Number(temperature);
      if (tempNum < 1 || tempNum > 40) {
        form.get('temperatureProduit')?.setErrors({ range: true });
        return false;
      }
    }
    
    // Validation des effets indésirables si cochés
    if (form.get('effetsIndesirables')?.value) {
      if (!form.get('typeEffet')?.value || !form.get('graviteEffet')?.value) {
        form.get('typeEffet')?.markAsTouched();
        form.get('graviteEffet')?.markAsTouched();
        return false;
      }
    }
    
    return true;
  }

  /**
   * Valide les surveillances
   */
  private validateSurveillances(): boolean {
    const surveillances = this.surveillances();
    
    if (surveillances.length === 0) {
      return false;
    }
    
    for (let i = 0; i < surveillances.length; i++) {
      const surveillance = surveillances[i];
      
      // Validation de l'heure
      if (!surveillance.heure || surveillance.heure.trim() === '') {
        return false;
      }
      
      // Validation du pouls
      if (surveillance.pouls === null || surveillance.pouls === undefined || surveillance.pouls === 0) {
        return false;
      }
      
      if (surveillance.pouls < 30 || surveillance.pouls > 250) {
        return false;
      }
      
      // Validation de la température
      if (surveillance.temperature === null || surveillance.temperature === undefined || surveillance.temperature === 0) {
        return false;
      }
      
      if (surveillance.temperature < 30 || surveillance.temperature > 45) {
        return false;
      }
      
      // Validation de la tension (si renseignée)
      if (surveillance.tension && surveillance.tension.trim() !== '') {
        if (!this.isTensionValid(surveillance.tension)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Valide le nombre de surveillances (au moins une)
   */
  validateSurveillancesCount(): boolean {
    return this.surveillances().length > 0;
  }

  /**
   * Valide les champs des surveillances
   */
  validateSurveillancesFields(): boolean {
    return this.validateSurveillances();
  }

  /**
   * Valide les informations du déclarant
   */
  private validateDeclarant(): boolean {
    const form = this.transfusionForm;
    
    const requiredDeclarantFields = [
      { control: form.get('prenomDeclarant'), message: 'Le prénom du déclarant est requis' },
      { control: form.get('nomDeclarant'), message: 'Le nom du déclarant est requis' },
      { control: form.get('fonctionDeclarant'), message: 'La fonction du déclarant est requise' }
    ];
    
    for (const field of requiredDeclarantFields) {
      if (!field.control?.value || field.control.value.trim() === '') {
        field.control?.markAsTouched();
        return false;
      }
    }
    
    return true;
  }

  /**
   * Valide qu'un produit unique est sélectionné
   */
  isProduitUniqueSelectionne(): boolean {
    const selectedCount = this.getSelectedProductsCount();
    
    if (selectedCount === 0) {
      return false;
    }
    
    if (selectedCount > 1) {
      return false;
    }
    
    // Vérifier que le produit n'est pas déjà traité
    const selectedProductIds = this.getSelectedProductIds();
    const produitId = selectedProductIds[0];
    
    if (this.produitsTraites().includes(produitId)) {
      return false;
    }
    
    return true;
  }

  // ========== MÉTHODES D'INITIALISATION ==========

  private loadCurrentUser(): void {
    const user = this.authService.getCurrentUser();
    console.log('👤 Utilisateur connecté:', user);
    this.currentUser.set(user);
    
    // Si l'utilisateur est un médecin, pré-remplir le formulaire
    if (user && user.id) {
        this.prefillFormWithCurrentUser(user);
    }
  }

  private prefillFormWithCurrentUser(user: any): void {
    // Définir l'ID du médecin comme l'ID de l'utilisateur
    this.transfusionForm.patchValue({
        medecinId: user.id
    });
    
    // Si l'utilisateur n'a pas encore rempli les informations de déclarant,
    // on peut les pré-remplir aussi
    if (!this.transfusionForm.get('nomDeclarant')?.value && user.nom) {
        this.transfusionForm.patchValue({
            nomDeclarant: user.nom
        });
    }
    
    if (!this.transfusionForm.get('prenomDeclarant')?.value && user.prenom) {
        this.transfusionForm.patchValue({
            prenomDeclarant: user.prenom
        });
    }
    
    if (!this.transfusionForm.get('fonctionDeclarant')?.value) {
        // Déterminer la fonction selon le type d'utilisateur
        let fonction = 'Médecin';
        if (user.specialite) {
            fonction = `Médecin ${user.specialite}`;
        }
        this.transfusionForm.patchValue({
            fonctionDeclarant: fonction
        });
    }
  }

  private loadInitialData(): void {
    this.loading.set(true);
    
    console.log('🔍 DEBUG - Début chargement données...');
    
    forkJoin({
      delivrances: this.delivranceService.getAllWithDetails(),
      transfusions: this.transfusionService.getAll(),
      utilisateurs: this.utilisateurService.getAllUtilisateurs()
    })
    .pipe(takeUntil(this.destroy$))
    .subscribe({
      next: ({ delivrances, transfusions, utilisateurs }) => {
        console.log('✅ Délivrances chargées:', delivrances.length);
        
        // Appliquer le filtre
        const produitsTransfusesIds = transfusions
          .map(t => t.produitSanguinId)
          .filter(id => id !== undefined && id !== null) as number[];
        
        const delivrancesFiltrees = this.filtrerDelivrancesParProduits(delivrances, produitsTransfusesIds);
        
        // Filtrer les médecins
        const medecins = utilisateurs.filter((user: any): user is Medecin => 
          'specialite' in user && user.specialite
        );
        
        // Extraire les destinations
        this.extractDestinations(delivrancesFiltrees);
        
        // Mettre à jour les états
        this.delivrances.set(delivrancesFiltrees);
        this.filteredDelivrances.set(delivrancesFiltrees);
        this.medecins.set(medecins);
        this.produitsTraites.set(produitsTransfusesIds);
        
        this.loading.set(false);
        
        // Afficher des notifications si besoin
        if (medecins.length === 0) {
          this.showNotification('warning', 'Aucun médecin disponible');
        }
        
        console.log('✅ Chargement initial terminé avec succès');
      },
      error: (error) => {
        console.error('❌ Erreur chargement des données:', error);
        this.showNotification('error', 'Erreur lors du chargement des données');
        this.loading.set(false);
      }
    });
  }

  /**
   * Filtre les délivrances pour ne garder que celles avec des produits non transfusés
   */
  private filtrerDelivrancesParProduits(delivrances: Delivrance[], produitsTransfusesIds: number[]): Delivrance[] {
    return delivrances
      .map(delivrance => {
        // Filtrer les produits non transfusés et avec état valide
        const produitsDisponibles = delivrance.produitsSanguins?.filter(
          produit => {
            // Vérifier si le produit n'est pas déjà transfusé
            const nonTransfuse = !produitsTransfusesIds.includes(produit.id!);
            
            // Vérifier l'état du produit
            const etatValide = this.estProduitDisponibleParEtat(produit);
            
            return nonTransfuse && etatValide;
          }
        ) || [];
        
        // Retourner une copie avec seulement les produits disponibles
        return {
          ...delivrance,
          produitsSanguins: produitsDisponibles
        };
      })
      .filter(delivrance => 
        // Garder seulement les délivrances qui ont au moins un produit disponible
        delivrance.produitsSanguins && delivrance.produitsSanguins.length > 0
      );
  }

  /**
   * Vérifie si un produit est disponible selon son état
   */
  private estProduitDisponibleParEtat(produit: ProduitSanguin): boolean {
    if (!produit || !produit.etat) return false;
    
    const etat = produit.etat.toUpperCase();
    
    // Pour la transfusion, SEUL "DÉLIVRÉ" est acceptable
    return etat === 'DÉLIVRÉ';
  }

  /**
   * Extrait les destinations uniques des délivrances
   */
  private extractDestinations(delivrances: Delivrance[]): void {
    const destinationsSet = new Set<string>();
    delivrances.forEach(d => {
      if (d.destination && d.destination.trim()) {
        destinationsSet.add(d.destination);
      }
    });
    this.destinations.set(Array.from(destinationsSet).sort());
  }

  private loadTransfusionData(id: number): void {
    this.loading.set(true);
    
    this.transfusionService.getById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (transfusion) => {
          console.log('Transfusion chargée pour édition:', transfusion);
          this.populateFormWithTransfusionData(transfusion);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Erreur chargement transfusion:', error);
          this.showNotification('error', 'Erreur lors du chargement de la transfusion');
          this.loading.set(false);
        }
      });
  }

  private populateFormWithTransfusionData(transfusion: Transfusion): void {
    // Remplir le formulaire avec les données de la transfusion
    this.transfusionForm.patchValue({
      medecinId: transfusion.medecinId || transfusion.medecin?.id,
      dateTransfusion: new Date(transfusion.dateTransfusion),
      heureDebut: transfusion.heureDebut?.substring(0, 5),
      volume: transfusion.volumeMl,
      tolerance: transfusion.tolerance,
      etatPatientApres: transfusion.etatPatientApres,
      prenomDeclarant: transfusion.prenomDeclarant,
      nomDeclarant: transfusion.nomDeclarant,
      fonctionDeclarant: transfusion.fonctionDeclarant,
      notes: transfusion.notes,
      effetsIndesirables: transfusion.effetsIndesirables,
      typeEffet: transfusion.typeEffet,
      graviteEffet: transfusion.graviteEffet
    });

    // Charger les surveillances si elles existent
    if (transfusion.surveillances && transfusion.surveillances.length > 0) {
      const surveillancesForm = transfusion.surveillances.map(s => ({
        heure: s.heure.substring(0, 5),
        pouls: s.pouls,
        temperature: s.temperature,
        tension: s.tension,
        observations: s.observations,
        signesCliniques: s.signesCliniques || ''
      }));
      this.surveillances.set(surveillancesForm);
    }
  }

  // ========== MÉTHODES DE NAVIGATION ==========

  backToList(): void {
    this.router.navigate(['/app/transfusions']);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ========== MÉTHODES D'UTILITÉ POUR LES DÉLIVRANCES ==========

  /**
   * Vérifie si une délivrance a encore des produits non transfusés
   */
  hasAvailableProducts(delivrance: Delivrance): boolean {
    if (!delivrance.produitsSanguins || delivrance.produitsSanguins.length === 0) {
      return false;
    }
    
    const produitsTraites = this.produitsTraites();
    const produitsNonTransfuses = delivrance.produitsSanguins.filter(
      produit => !produitsTraites.includes(produit.id!)
    );
    
    return produitsNonTransfuses.length > 0;
  }

  /**
   * Obtenir le nombre de produits restants pour une délivrance
   */
  getRemainingProductsCount(delivrance: Delivrance): number {
    if (!delivrance.produitsSanguins) return 0;
    
    const produitsTraites = this.produitsTraites();
    const produitsNonTransfuses = delivrance.produitsSanguins.filter(
      produit => !produitsTraites.includes(produit.id!)
    );
    
    return produitsNonTransfuses.length;
  }

  /**
   * Obtenir le nombre de produits déjà transfusés pour une délivrance
   */
  getTransfusedProductsCount(delivrance: Delivrance): number {
    if (!delivrance.produitsSanguins) return 0;
    
    const produitsTraites = this.produitsTraites();
    const produitsTransfuses = delivrance.produitsSanguins.filter(
      produit => produitsTraites.includes(produit.id!)
    );
    
    return produitsTransfuses.length;
  }

  /**
   * Vérifie si un produit spécifique est déjà transfusé
   */
  isProductTransfused(produit: ProduitSanguin): boolean {
    if (!produit.id) return false;
    return this.produitsTraites().includes(produit.id);
  }

  // ========== MÉTHODES DE FILTRAGE ==========

  /**
   * Gestion du changement d'input pour la recherche
   */
  onInputChange(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.searchTerm.set(inputElement.value);
    this.onSearchChange();
  }

  /**
   * Filtre les délivrances selon les critères
   */
  filterDelivrances(): void {
    const search = this.searchTerm().toLowerCase();
    const destination = this.destinationFilter();
    
    let filtered = this.delivrances();
    
    // Filtre par recherche textuelle
    if (search) {
      filtered = filtered.filter(d => 
        (d.demande?.patientNom?.toLowerCase().includes(search)) ||
        (d.demande?.patientPrenom?.toLowerCase().includes(search)) ||
        (d.demande?.patientNumDossier?.toLowerCase().includes(search)) ||
        (d.destination?.toLowerCase().includes(search)) ||
        (d.id?.toString().includes(search))
      );
    }
    
    // Filtre par destination
    if (destination) {
      filtered = filtered.filter(d => d.destination === destination);
    }
    
    this.filteredDelivrances.set(filtered);
  }

  /**
   * Gestion du changement de recherche
   */
  onSearchChange(): void {
    this.filterDelivrances();
  }

  // ========== MÉTHODES DE SÉLECTION ==========

  /**
   * Sélectionne une délivrance (étape 1)
   */
  selectDelivrance(delivrance: Delivrance): void {
    console.log('Méthode selectDelivrance appelée', delivrance);
    
    if (!delivrance) {
      console.error('Delivrance est undefined!');
      return;
    }
    
    this.selectedDelivrance.set(delivrance);
    this.produitEnCours.set(null);
    this.showValidationErrors = false;
    
    this.cdr.detectChanges();
    
    // Initialiser la sélection des produits (aucun sélectionné par défaut)
    const produits = delivrance.produitsSanguins || [];
    
    if (produits.length > 0) {
      this.selectedProducts.set(new Array(produits.length).fill(false));
    } else {
      this.selectedProducts.set([]);
      this.showNotification('warning', 'Cette délivrance ne contient aucun produit sanguin');
    }
    
    this.showNotification('info', `Délivrance #${delivrance.id} sélectionnée`);
  }

  /**
   * Bascule la sélection d'un produit (UN SEUL à la fois)
   */
  toggleProductSelection(index: number): void {
    const produitsTraites = this.produitsTraites();
    const produit = this.selectedDelivrance()!.produitsSanguins![index];
    
    // Vérifier si le produit a déjà été traité
    if (produitsTraites.includes(produit.id!)) {
      this.showNotification('warning', 'Ce produit a déjà été transfusé');
      return;
    }
    
    // Désélectionner tous les autres produits
    const current = new Array(this.selectedProducts().length).fill(false);
    current[index] = !this.selectedProducts()[index];
    this.selectedProducts.set(current);
    
    // Mettre à jour le produit en cours
    if (current[index]) {
      this.produitEnCours.set(produit);
    } else {
      this.produitEnCours.set(null);
    }
  }

  /**
   * Calcule le nombre de produits sélectionnés (doit être 1)
   */
  getSelectedProductsCount(): number {
    return this.selectedProducts().filter(selected => selected).length;
  }

  /**
   * Retour à l'étape 1 (changer de délivrance)
   */
  backToStep1(): void {
    this.selectedDelivrance.set(null);
    this.selectedProducts.set([]);
    this.produitEnCours.set(null);
    this.resetForm();
    this.showValidationErrors = false;
  }

  // ========== MÉTHODES DE GESTION DU FORMULAIRE ==========

  /**
   * Réinitialise le formulaire
   */
  private resetForm(): void {
    const now = new Date();
    const heureDebut = this.getCurrentTime();
    
    this.transfusionForm.reset({
      dateTransfusion: now,
      heureDebut: heureDebut,
      tolerance: 'Bonne',
      effetsIndesirables: false
    });
    
    this.surveillances.set([{
      heure: heureDebut,
      pouls: null,
      temperature: null,
      tension: '',
      observations: '',
      signesCliniques: ''
    }]);
  }

  /**
   * Réinitialise le formulaire pour le produit suivant
   */
  private resetFormForNextProduct(): void {
    const currentValues = this.transfusionForm.value;
    
    this.transfusionForm.patchValue({
      heureDebut: this.getCurrentTime(),
      volume: null,
      temperatureProduit: null,
      tolerance: 'Bonne',
      etatPatientApres: '',
      effetsIndesirables: false,
      typeEffet: '',
      graviteEffet: '',
      notes: '',
      observations: ''
    });
    
    // Garder certaines valeurs
    this.transfusionForm.patchValue({
      medecinId: currentValues.medecinId,
      dateTransfusion: currentValues.dateTransfusion,
      prenomDeclarant: currentValues.prenomDeclarant,
      nomDeclarant: currentValues.nomDeclarant,
      fonctionDeclarant: currentValues.fonctionDeclarant
    });
    
    // Réinitialiser les surveillances
    this.surveillances.set([{
      heure: this.getCurrentTime(),
      pouls: null,
      temperature: null,
      tension: '',
      observations: '',
      signesCliniques: ''
    }]);
  }

  // ========== MÉTHODES DE GESTION DES SURVEILLANCES ==========

  /**
   * Ajoute une nouvelle surveillance
   */
  ajouterSurveillance(): void {
    const now = new Date();
    const heure = this.getCurrentTime();
    
    this.surveillances.update(surveillances => [
      ...surveillances,
      {
        heure: heure,
        pouls: null,
        temperature: null,
        tension: '',
        observations: '',
        signesCliniques: ''
      }
    ]);
  }

  /**
   * Supprime une surveillance
   */
  supprimerSurveillance(index: number): void {
    if (this.surveillances().length > 1) {
      this.surveillances.update(surveillances => 
        surveillances.filter((_, i) => i !== index)
      );
    }
  }

  /**
   * Met à jour les surveillances (méthode de liaison bidirectionnelle)
   */
  updateSurveillance(index: number, field: keyof SurveillanceForm, value: any): void {
    const current = [...this.surveillances()];
    if (field === 'pouls' || field === 'temperature') {
      current[index][field] = value ? Number(value) : null;
    } else {
      current[index][field] = value;
    }
    this.surveillances.set(current);
  }

  // ========== MÉTHODES DE CRÉATION ==========

  /**
   * Transfuser le produit sélectionné avec validation
   */
  transfuserProduitSelectionne(): void {
    this.showValidationErrors = true;
    
    if (!this.isFormValidForTransfusion()) {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      this.markAllFieldsAsTouched();
      this.showNotification('error', 'Veuillez corriger les erreurs dans le formulaire');
      return;
    }
    
    if (!this.isProduitUniqueSelectionne() || !this.selectedDelivrance()) {
      this.showNotification('error', 'Veuillez sélectionner un produit unique à transfuser');
      return;
    }
    
    const selectedProductIds = this.getSelectedProductIds();
    if (selectedProductIds.length !== 1) {
      this.showNotification('error', 'Veuillez sélectionner un seul produit');
      return;
    }
    
    const produitId = selectedProductIds[0];
    
    // Trouver le produit sélectionné
    const produit = this.selectedDelivrance()!.produitsSanguins!.find(p => p.id === produitId);
    if (!produit) {
      this.showNotification('error', 'Produit non trouvé');
      return;
    }
    
    this.produitEnCours.set(produit);
    this.creerTransfusionPourProduit(produitId);
  }

  /**
   * Crée une transfusion pour un seul produit
   */
  private creerTransfusionPourProduit(produitId: number): void {
    this.saving.set(true);
    
    const request = this.prepareTransfusionRequest(produitId);
    
    console.log('📦 Requête transfusion à envoyer:', JSON.stringify(request, null, 2));
    
    this.transfusionService.create(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (transfusion) => {
          console.log('✅ Réponse transfusion:', transfusion);
          
          // Marquer le produit comme traité
          this.produitsTraites.update(current => [...current, produitId]);
          
          // Créer les surveillances si l'ID de la transfusion est présent
          if (transfusion.id !== undefined && transfusion.id !== null) {
            this.createSurveillancesForTransfusion(transfusion.id, produitId);
          } else {
            console.warn('ID de la transfusion manquant, impossible de créer les surveillances');
          }
          
          // Désélectionner le produit
          this.deselectionnerProduit(produitId);
          
          // Marquer le produit comme utilisé
          this.marquerProduitCommeUtilise(produitId);
          
          // Réinitialiser le formulaire pour le produit suivant
          this.resetFormForNextProduct();
          
          // Réinitialiser les erreurs de validation
          this.showValidationErrors = false;
          
          // Afficher le succès
          this.showNotification('success', 'Transfusion créée avec succès');
          this.saving.set(false);
          
          // Si c'est le dernier produit, afficher un message spécial
          if (!this.produitsRestants()) {
            this.showNotification('success', 
              `Tous les produits de la délivrance #${this.selectedDelivrance()!.id} ont été transfusés !`);
          }
        },
        error: (error) => {
          console.error('❌ Erreur complète création transfusion:', error);
          console.error('❌ Message:', error.message);
          console.error('❌ Status:', error.status);
          console.error('❌ Error body:', error.error);
          
          this.showNotification('error', `Erreur: ${error.error?.message || error.message}`);
          this.saving.set(false);
        }
      });
  }

  /**
   * Récupère les IDs des produits sélectionnés
   */
  private getSelectedProductIds(): number[] {
    if (!this.selectedDelivrance() || !this.selectedDelivrance()!.produitsSanguins) {
      return [];
    }
    
    return this.selectedDelivrance()!.produitsSanguins!
      .filter((_, index) => this.selectedProducts()[index])
      .map(produit => produit.id!)
      .filter(id => id !== undefined);
  }

  /**
   * Prépare la requête de création de transfusion
   */
  private prepareTransfusionRequest(produitId: number): CreerTransfusionRequest {
    const formValue = this.transfusionForm.value;
    const dateTransfusion = this.formatDateForAPI(formValue.dateTransfusion);
    
    return {
      medecinId: formValue.medecinId,
      produitSanguinId: produitId,
      
      // Informations patient (depuis la délivrance)
      patientPrenom: this.selectedDelivrance()!.demande?.patientPrenom || '',
      patientNom: this.selectedDelivrance()!.demande?.patientNom || '',
      patientDateNaissance: this.selectedDelivrance()!.demande?.patientDateNaissance || '',
      patientNumDossier: this.selectedDelivrance()!.demande?.patientNumDossier || '',
      groupeSanguinPatient: this.selectedDelivrance()!.demande?.groupeSanguinPatient || '',
      
      // Informations transfusion
      dateTransfusion: dateTransfusion,
      heureDebut: formValue.heureDebut + ':00',
      volumeMl: formValue.volume,
      
      tolerance: formValue.tolerance,
      etatPatientApres: formValue.etatPatientApres,
      
      // Déclarant
      prenomDeclarant: formValue.prenomDeclarant,
      nomDeclarant: formValue.nomDeclarant,
      fonctionDeclarant: formValue.fonctionDeclarant,
      
      // Notes et effets
      notes: formValue.notes,
      
      effetsIndesirables: formValue.effetsIndesirables,
      typeEffet: formValue.typeEffet,
      graviteEffet: formValue.graviteEffet,
      
      // Champs optionnels
      heureFin: '',
      dateDeclaration: dateTransfusion
    };
  }

  /**
   * Désélectionne un produit après transfusion
   */
  private deselectionnerProduit(produitId: number): void {
    if (!this.selectedDelivrance() || !this.selectedDelivrance()!.produitsSanguins) {
      return;
    }
    
    const index = this.selectedDelivrance()!.produitsSanguins!.findIndex(p => p.id === produitId);
    if (index !== -1) {
      const current = [...this.selectedProducts()];
      current[index] = false;
      this.selectedProducts.set(current);
      this.produitEnCours.set(null);
    }
  }

  /**
   * Marquer le produit comme utilisé dans la base de données
   */
  private marquerProduitCommeUtilise(produitId: number): void {
    // Appel API pour mettre à jour l'état du produit
    fetch(`${environment.apiUrl}/produits-sanguins/${produitId}/utilise`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
      }
    })
    .then(response => {
      if (!response.ok) {
        console.error('Erreur lors du marquage du produit comme utilisé');
      }
    })
    .catch(error => {
      console.error('Erreur réseau:', error);
    });
  }

  /**
   * Crée les surveillances pour une transfusion
   */
  private createSurveillancesForTransfusion(transfusionId: number, produitId: number): void {
    console.log('🔍 Création surveillances pour transfusion:', transfusionId);
    
    const surveillancesRequests = this.convertSurveillancesToAPI(transfusionId);
    
    if (surveillancesRequests.length === 0) {
      console.warn('⚠️ Aucune surveillance à créer');
      return;
    }

    console.log('📤 Surveillances à envoyer:', surveillancesRequests.length);
    
    let completed = 0;
    let errors = 0;
    const total = surveillancesRequests.length;

    surveillancesRequests.forEach((surveillance, index) => {
      console.log(`📤 Envoi surveillance #${index + 1}:`, surveillance);
      
      fetch(`${environment.apiUrl}/surveillances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(surveillance)
      })
      .then(async response => {
        console.log(`📥 Réponse surveillance #${index + 1}:`, response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Erreur surveillance #${index + 1}:`, errorText);
          errors++;
        } else {
          const data = await response.json();
          console.log(`✅ Surveillance #${index + 1} créée:`, data);
          completed++;
        }
        
        // Vérifier si toutes sont terminées
        if (completed + errors === total) {
          console.log(`📊 Résultat: ${completed} créée(s), ${errors} échec(s)`);
        }
      })
      .catch(error => {
        console.error(`❌ Erreur réseau surveillance #${index + 1}:`, error);
        errors++;
      });
    });
  }

  /**
   * Convertit les surveillances du formulaire en format API
   */
  private convertSurveillancesToAPI(transfusionId: number): any[] {
    return this.surveillances()
      .filter(s => s.heure && s.heure.trim() !== '')
      .map(s => {
        // Nettoyer et valider la tension
        let tension = s.tension || '';
        if (tension && !this.isTensionValid(tension)) {
          console.warn(`Tension invalide: ${tension}`);
          tension = ''; // Si invalide, envoyer vide
        }
        
        // Vérifier que le pouls n'est pas null ou undefined
        // Si null, mettre une valeur par défaut (ex: 0 ou une valeur normale)
        let pouls = s.pouls;
        if (pouls === null || pouls === undefined) {
          pouls = 0; // Valeur par défaut
          console.warn('Pouls est null/undefined, mise à jour à 0 par défaut');
        }
        
        // Vérifier que la température n'est pas null ou undefined
        let temperature = s.temperature;
        if (temperature === null || temperature === undefined) {
          temperature = 0; // Valeur par défaut
          console.warn('Température est null/undefined, mise à jour à 0 par défaut');
        }
        
        return {
          transfusionId: transfusionId,
          heure: s.heure + ':00',
          tension: tension,
          temperature: temperature,
          pouls: pouls,
          signesCliniques: s.signesCliniques || '',
          observations: s.observations || ''
        };
      });
  }

  /**
   * Préparer le produit suivant
   */
  preparerProduitSuivant(): void {
    if (!this.selectedDelivrance() || this.arretEnCours()) return;
    
    // Réinitialiser le formulaire pour le produit suivant
    this.resetFormForNextProduct();
    
    // Désélectionner tous les produits
    this.selectedProducts.set(new Array(this.selectedProducts().length).fill(false));
    this.produitEnCours.set(null);
    
    // Réinitialiser les erreurs de validation
    this.showValidationErrors = false;
    
    this.showNotification('info', 'Prêt pour le produit suivant');
  }

  /**
   * Vérifier s'il reste des produits à traiter
   */
  produitsRestants(): boolean {
    if (!this.selectedDelivrance() || !this.selectedDelivrance()!.produitsSanguins) {
      return false;
    }
    
    const totalProduits = this.selectedDelivrance()!.produitsSanguins!.length;
    const produitsTraites = this.produitsTraites().length;
    
    return produitsTraites < totalProduits;
  }

  /**
   * Terminer et revenir à la liste
   */
  terminerEtRevenir(): void {
    const totalTransfusions = this.produitsTraites().length;
    this.showNotification('success', `${totalTransfusions} transfusion(s) créée(s) avec succès`);
    
    setTimeout(() => {
      this.router.navigate(['/app/transfusions']);
    }, 1500);
  }

  // ========== MÉTHODES POUR ARRÊTER ET DÉCLARER INCIDENT ==========

  /**
   * Arrête la transfusion en cours et redirige vers la déclaration d'incident
   */
  arreterTransfusionEtDeclarerIncident(): void {
    this.showValidationErrors = true;
    
    if (!this.isFormValidForIncident()) {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      this.markAllFieldsAsTouched();
      this.showNotification('error', 'Veuillez corriger les erreurs dans le formulaire');
      return;
    }
    
    console.log('🛑 Arrêt de transfusion et déclaration d\'incident demandé');
    
    if (!this.selectedDelivrance() || !this.produitEnCours()) {
      this.showNotification('error', 'Veuillez sélectionner un produit à transfuser d\'abord');
      return;
    }
    
    // Obtenir le produit sélectionné
    const selectedProductIds = this.getSelectedProductIds();
    if (selectedProductIds.length !== 1) {
      this.showNotification('error', 'Veuillez sélectionner un seul produit');
      return;
    }
    
    const produitId = selectedProductIds[0];
    const produit = this.selectedDelivrance()!.produitsSanguins!.find(p => p.id === produitId);
    
    if (!produit) {
      this.showNotification('error', 'Produit non trouvé');
      return;
    }
    
    // 1. D'abord créer la transfusion (comme dans la méthode normale)
    this.arretEnCours.set(true);
    this.saving.set(true);
    
    const request = this.prepareTransfusionRequest(produitId);
    
    console.log('📦 Création transfusion avant incident:', JSON.stringify(request, null, 2));
    
    this.transfusionService.create(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (transfusion) => {
          console.log('✅ Transfusion créée pour incident:', transfusion);
          
          if (!transfusion.id) {
            console.error('❌ ID de transfusion manquant');
            this.showNotification('error', 'Erreur lors de la création de la transfusion');
            this.saving.set(false);
            this.arretEnCours.set(false);
            return;
          }
          
          // 2. Marquer le produit comme traité localement
          this.produitsTraites.update(current => [...current, produitId]);
          
          // 3. Créer les surveillances
          this.createSurveillancesForTransfusion(transfusion.id, produitId);
          
          // 4. Marquer le produit comme utilisé
          this.marquerProduitCommeUtilise(produitId);
          
          // 5. Désélectionner le produit
          this.deselectionnerProduit(produitId);
          
          // 6. Rediriger vers la page de déclaration d'incident
          console.log(`🔗 Redirection vers déclaration incident pour transfusion #${transfusion.id}`);
          
          // Réinitialiser les erreurs de validation
          this.showValidationErrors = false;
          
          const incidentData = this.prepareIncidentData(transfusion.id, produitId);
          // Redirection directe
          this.router.navigate(['/app/incidents/creer'], {
            state: { 
              transfusionId: transfusion.id,
              context: 'arret-transfusion',
              prefillData: incidentData
            }
          });
          
          this.saving.set(false);
          this.arretEnCours.set(false);
        },
        error: (error) => {
          console.error('❌ Erreur création transfusion pour incident:', error);
          this.showNotification('error', `Erreur: ${error.error?.message || error.message}`);
          this.saving.set(false);
          this.arretEnCours.set(false);
        }
      });
  }

  /**
   * Prépare les données à transmettre au formulaire d'incident
   */
  private prepareIncidentData(transfusionId: number, produitId: number): any {
    const produit = this.findProduitById(produitId);
    const formValue = this.transfusionForm.value;
    const now = new Date();
    
    // S'assurer que la date est bien formatée
    const dateIncident = this.formatDateForAPI(now);
    
    return {
      transfusionId: transfusionId,
      
      // Informations patient (depuis la délivrance)
      patientNom: this.selectedDelivrance()!.demande?.patientNom || '',
      patientPrenom: this.selectedDelivrance()!.demande?.patientPrenom || '',
      patientDateNaissance: this.selectedDelivrance()!.demande?.patientDateNaissance || '',
      patientNumDossier: this.selectedDelivrance()!.demande?.patientNumDossier || '',
      
      // Informations produit
      typeProduitTransfuse: produit?.typeProduit || '',
      numeroLotProduit: produit?.codeProduit || '',
      datePeremptionProduit: produit?.datePeremption || '',
      
      // Informations incident
      dateIncident: dateIncident,
      heureIncident: this.getCurrentTime(),
      
      // Lieu (peut être déduit de la destination)
      lieuIncident: this.selectedDelivrance()!.destination || 'Unité de soins',
      
      // Effets indésirables saisis dans le formulaire de transfusion
      typeEffet: formValue.typeEffet || '',
      graviteEffet: formValue.graviteEffet || '',
      
      // Description pré-remplie
      descriptionIncident: formValue.typeEffet ? 
        `Arrêt de la transfusion suite à effet indésirable: ${formValue.typeEffet} (gravité: ${formValue.graviteEffet})` : 
        'Arrêt de la transfusion suite à effet indésirable observé.',
      signes: formValue.typeEffet || '',
      symptomes: formValue.typeEffet || '',
      actionsImmediates: 'Arrêt immédiat de la perfusion, monitoring du patient, appel du médecin.',
      
      // Déclarant (utilisateur courant)
      nomDeclarant: this.currentUser()?.nom || formValue.nomDeclarant || '',
      fonctionDeclarant: this.getFonctionFromUser() || formValue.fonctionDeclarant || ''
    };
  }

  private getFonctionFromUser(): string {
    const user = this.currentUser();
    if (!user) return '';
    
    // Déterminer la fonction selon le type d'utilisateur
    if (user.specialite) {
      return `Médecin ${user.specialite}`;
    } else if (user.fonction) {
      return user.fonction;
    } else if (user.type) {
      return user.type === 'MEDECIN' ? 'Médecin' : 
             user.type === 'PERSONNEL' ? 'Personnel soignant' :
             user.type === 'CHEF_SERVICE' ? 'Chef de service' :
             'Utilisateur';
    }
    
    return '';
  }

  // ========== MÉTHODES UTILITAIRES ==========

  /**
   * Trouve un produit par son ID
   */
  findProduitById(produitId: number): ProduitSanguin | null {
    if (!this.selectedDelivrance() || !this.selectedDelivrance()!.produitsSanguins) {
      return null;
    }
    return this.selectedDelivrance()!.produitsSanguins!.find(p => p.id === produitId) || null;
  }

  /**
   * Formatte l'heure pour l'affichage
   */
  formatTime(dateString: any): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch {
      return '';
    }
  }

  /**
   * Obtient l'heure actuelle au format HH:mm
   */
  private getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Formatte une date pour l'API (format YYYY-MM-DD)
   */
  private formatDateForAPI(date: any): string {
    if (!date) return '';
    
    try {
      if (date instanceof Date) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      if (typeof date === 'string') {
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
          const year = parsedDate.getFullYear();
          const month = (parsedDate.getMonth() + 1).toString().padStart(2, '0');
          const day = parsedDate.getDate().toString().padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      
      return String(date);
    } catch {
      return '';
    }
  }

  /**
   * Formatte une date pour l'affichage (dd/MM/yyyy)
   */
  formatDate(date: any): string {
    if (!date) return '';
    
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return String(date);
      
      const day = d.getDate().toString().padStart(2, '0');
      const month = (d.getMonth() + 1).toString().padStart(2, '0');
      const year = d.getFullYear();
      
      return `${day}/${month}/${year}`;
    } catch {
      return String(date);
    }
  }

  /**
   * Affiche une notification
   */
  private showNotification(type: 'success' | 'error' | 'info' | 'warning', message: string): void {
    const duration = type === 'error' ? 5000 : 3000;
    
    this.snackBar.open(message, 'Fermer', {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [`snackbar-${type}`]
    });
  }

  // ========== MÉTHODES DE VALIDATION DE TENSION ==========

  /**
   * Valide le format de la tension
   */
  validateTensionFormat(index: number): void {
    const tension = this.surveillances()[index].tension;
    
    if (!tension || tension.trim() === '') {
      return; // Vide est acceptable
    }
    
    // Valider le format "systolique/diastolique"
    const regex = /^\d{2,3}\/\d{2,3}$/;
    if (!regex.test(tension.trim())) {
      this.showNotification('warning', 
        `Format de tension invalide à la surveillance #${index + 1}. Format attendu: "120/80"`);
      
      // Optionnel: effacer la valeur invalide
      const updated = [...this.surveillances()];
      updated[index].tension = '';
      this.surveillances.set(updated);
    }
  }

  /**
   * Vérifie si une tension a un format valide
   */
  isTensionValid(tension: string): boolean {
    if (!tension || tension.trim() === '') {
      return true; // Vide est acceptable
    }
    
    const regex = /^\d{2,3}\/\d{2,3}$/;
    return regex.test(tension.trim());
  }

  /**
   * Vérifie si une tension a une erreur de format
   */
  tensionHasError(index: number): boolean {
    const tension = this.surveillances()[index].tension;
    // Ensure tension is a string before calling string methods
    return typeof tension === 'string' && tension.trim() !== '' && !this.isTensionValid(tension);
  }

  /**
   * Marque tous les champs du formulaire comme touchés pour afficher les erreurs
   */
  private markAllFieldsAsTouched(): void {
    Object.keys(this.transfusionForm.controls).forEach(key => {
      const control = this.transfusionForm.get(key);
      control?.markAsTouched();
    });
  }
}