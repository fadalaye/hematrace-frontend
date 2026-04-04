import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, ActivatedRoute } from '@angular/router';
import { forkJoin, Subject, of } from 'rxjs';
import { catchError, finalize, takeUntil } from 'rxjs/operators';

import { Delivrance } from '../../../../interfaces/delivrance.interface';
import {
  Transfusion,
  CreerTransfusionRequest,
  SurveillanceRequest
} from '../../../../interfaces/transfusion.interface';
import { Medecin } from '../../../../interfaces/medecin.interface';
import { ProduitSanguin } from '../../../../interfaces/produit-sanguin.interface';
import { CorrectionCliniqueTransfusionRequest } from '../../../../interfaces/CorrectionCliniqueTransfusionRequest.interface';

import { AuthService } from '../../../../services/auth.service';
import { DelivranceService } from '../../../../services/delivrance.service';
import { TransfusionService } from '../../../../services/transfusion.service';
import { UtilisateurService } from '../../../../services/utilisateur.service';

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
  private fb = inject(FormBuilder);
  private delivranceService = inject(DelivranceService);
  private transfusionService = inject(TransfusionService);
  private utilisateurService = inject(UtilisateurService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  private destroy$ = new Subject<void>();

  loading = signal<boolean>(true);
  saving = signal<boolean>(false);
  arretEnCours = signal<boolean>(false);
  mode = signal<'create' | 'edit'>('create');
  transfusionId = signal<number | null>(null);
  currentUser = signal<any>(null);
  currentTransfusion = signal<Transfusion | null>(null);
  showValidationErrors = false;

  delivrances = signal<Delivrance[]>([]);
  filteredDelivrances = signal<Delivrance[]>([]);
  medecins = signal<Medecin[]>([]);
  selectedDelivrance = signal<Delivrance | null>(null);

  searchTerm = signal<string>('');
  destinationFilter = signal<string>('');
  destinations = signal<string[]>([]);

  selectedProducts = signal<boolean[]>([]);
  produitsTraites = signal<number[]>([]);
  produitEnCours = signal<ProduitSanguin | null>(null);

  surveillances = signal<SurveillanceForm[]>([{
    heure: this.getCurrentTime(),
    pouls: null,
    temperature: null,
    tension: '',
    observations: '',
    signesCliniques: ''
  }]);

  minDate: Date;
  maxDate: Date;

  transfusionForm: FormGroup;

  produitsDisponibles = computed(() => {
    if (!this.selectedDelivrance() || !this.selectedDelivrance()!.produitsSanguins) {
      return [];
    }

    const idsTraites = this.produitsTraites();

    return this.selectedDelivrance()!.produitsSanguins!.filter(produit => {
      if (!produit.id) return false;
      return !idsTraites.includes(produit.id);
    });
  });

  produitsRestants = computed(() => this.produitsDisponibles().length);

  progressionProduits = computed(() => {
    const delivrance = this.selectedDelivrance();
    if (!delivrance?.produitsSanguins?.length) return 0;

    const total = delivrance.produitsSanguins.length;
    const traites = this.produitsTraites().length;
    return Math.round((traites / total) * 100);
  });

  constructor() {
    const now = new Date();
    this.minDate = new Date(2000, 0, 1);
    this.maxDate = now;

    this.transfusionForm = this.fb.group({
      medecinId: ['', Validators.required],
      dateTransfusion: [now, [Validators.required, this.futureDateValidator]],
      heureDebut: [this.getCurrentTime(), Validators.required],
      volume: [null, [Validators.min(0), Validators.max(5000)]],
      temperatureProduit: [null, [Validators.min(1), Validators.max(40)]],
      tolerance: ['Bonne', Validators.required],
      etatPatientApres: ['', Validators.required],

      prenomDeclarant: ['', [Validators.required, Validators.minLength(2)]],
      nomDeclarant: ['', [Validators.required, Validators.minLength(2)]],
      fonctionDeclarant: ['', [Validators.required, Validators.minLength(2)]],

      notes: [''],
      observations: [''],

      effetsIndesirables: [false],
      typeEffet: [''],
      graviteEffet: ['']
    });

    this.transfusionForm.get('effetsIndesirables')?.valueChanges.subscribe(value => {
      const typeEffet = this.transfusionForm.get('typeEffet');
      const graviteEffet = this.transfusionForm.get('graviteEffet');

      if (value) {
        typeEffet?.setValidators([Validators.required]);
        graviteEffet?.setValidators([Validators.required]);
      } else {
        typeEffet?.clearValidators();
        graviteEffet?.clearValidators();
      }

      typeEffet?.updateValueAndValidity();
      graviteEffet?.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.loadCurrentUser();

    this.route.url.pipe(takeUntil(this.destroy$)).subscribe(segments => {
      const path = segments.map(s => s.path).join('/');
      this.mode.set(path.startsWith('modifier') ? 'edit' : 'create');
    });

    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      if (params['id']) {
        this.transfusionId.set(+params['id']);
      }
    });

    if (this.isCorrectionMode() && this.transfusionId()) {
      this.loadInitialDataForEdit(this.transfusionId()!);
    } else {
      this.loadInitialDataForCreate();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  isCorrectionMode(): boolean {
    return this.mode() === 'edit';
  }

  /* =======================
     VALIDATEURS
  ======================= */
  private futureDateValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const inputDate = new Date(control.value);
    inputDate.setHours(0, 0, 0, 0);

    return inputDate > today ? { futureDate: true } : null;
  }

  /* =======================
     INIT DATA
  ======================= */
  private loadInitialDataForCreate(): void {
    this.loading.set(true);

    forkJoin({
      delivrances: this.delivranceService.getAll().pipe(catchError(() => of([]))),
      medecins: this.utilisateurService.getAllUtilisateurs().pipe(catchError(() => of([])))
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: ({ delivrances, medecins }: any) => {
          const delivrancesDisponibles = (delivrances || []).filter((d: Delivrance) => this.hasAvailableProducts(d));
          this.delivrances.set(delivrancesDisponibles);
          this.filteredDelivrances.set(delivrancesDisponibles);
          this.extractDestinations(delivrancesDisponibles);
          this.medecins.set((medecins || []).filter((u: any) => this.estMedecin(u)));
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erreur chargement données initiales:', error);
          this.showNotification('error', 'Erreur lors du chargement des données');
        }
      });
  }

  private loadInitialDataForEdit(id: number): void {
    this.loading.set(true);

    forkJoin({
      transfusion: this.transfusionService.getById(id).pipe(catchError(() => of(null))),
      medecins: this.utilisateurService.getAllUtilisateurs().pipe(catchError(() => of([])))
    })
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: ({ transfusion, medecins }: any) => {
          if (!transfusion) {
            this.showNotification('error', 'Transfusion introuvable');
            this.router.navigate(['/app/transfusions']);
            return;
          }

          this.currentTransfusion.set(transfusion);
          this.medecins.set((medecins || []).filter((u: any) => this.estMedecin(u)));
          this.populateFormWithTransfusionData(transfusion);
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Erreur chargement transfusion:', error);
          this.showNotification('error', 'Erreur lors du chargement de la transfusion');
          this.router.navigate(['/app/transfusions']);
        }
      });
  }

  private loadCurrentUser(): void {
    const user = this.authService.getCurrentUser();
    this.currentUser.set(user);

    if (user) {
      this.transfusionForm.patchValue({
        prenomDeclarant: user.prenom || '',
        nomDeclarant: user.nom || '',
        //fonctionDeclarant: user.fonction || user.role || ''
      });
    }
  }

  private estMedecin(user: any): boolean {
    const role = (user?.role || user?.fonction || '').toString().toUpperCase();
    return role.includes('MEDECIN') || role.includes('MÉDECIN');
  }

  private extractDestinations(delivrances: Delivrance[]): void {
    const set = new Set<string>();
    delivrances.forEach(d => {
      if (d.destination && d.destination.trim()) {
        set.add(d.destination);
      }
    });
    this.destinations.set(Array.from(set).sort());
  }

  private populateFormWithTransfusionData(transfusion: Transfusion): void {
    this.transfusionForm.patchValue({
      medecinId: transfusion.medecinId || transfusion.medecin?.id || '',
      dateTransfusion: transfusion.dateTransfusion ? new Date(transfusion.dateTransfusion) : new Date(),
      heureDebut: transfusion.heureDebut?.substring(0, 5) || this.getCurrentTime(),
      volume: transfusion.volumeMl ?? null,
      tolerance: transfusion.tolerance || 'Bonne',
      etatPatientApres: transfusion.etatPatientApres || '',
      prenomDeclarant: transfusion.prenomDeclarant || '',
      nomDeclarant: transfusion.nomDeclarant || '',
      fonctionDeclarant: transfusion.fonctionDeclarant || '',
      notes: transfusion.notes || '',
      effetsIndesirables: transfusion.effetsIndesirables || false,
      typeEffet: transfusion.typeEffet || '',
      graviteEffet: transfusion.graviteEffet || ''
    });

    if (transfusion.surveillances && transfusion.surveillances.length > 0) {
      const mapped = transfusion.surveillances.map((s: any) => ({
        heure: s.heure?.substring(0, 5) || '',
        pouls: s.pouls ?? null,
        temperature: s.temperature ?? null,
        tension: s.tension || '',
        observations: s.observations || '',
        signesCliniques: s.signesCliniques || ''
      }));
      this.surveillances.set(mapped);
    }
  }

  /* =======================
     ETAPE 1 CREATION
  ======================= */
  onInputChange(event: any): void {
    this.searchTerm.set((event.target.value || '').toLowerCase());
    this.filterDelivrances();
  }

  filterDelivrances(): void {
    const term = this.searchTerm().trim();
    const destination = this.destinationFilter().trim();

    let filtered = [...this.delivrances()];

    if (term) {
      filtered = filtered.filter(d =>
        (d.demande?.patientNom || '').toLowerCase().includes(term) ||
        (d.demande?.patientPrenom || '').toLowerCase().includes(term) ||
        (d.demande?.patientNumDossier || '').toLowerCase().includes(term) ||
        (d.destination || '').toLowerCase().includes(term)
      );
    }

    if (destination) {
      filtered = filtered.filter(d => d.destination === destination);
    }

    this.filteredDelivrances.set(filtered);
  }

  selectDelivrance(delivrance: Delivrance): void {
    if (!this.hasAvailableProducts(delivrance)) {
      this.showNotification('warning', 'Tous les produits de cette délivrance ont déjà été transfusés');
      return;
    }

    this.selectedDelivrance.set(delivrance);

    const produits = delivrance.produitsSanguins || [];
    this.selectedProducts.set(new Array(produits.length).fill(false));
    this.produitsTraites.set(
      produits
        .filter(p => this.isProductTransfused(p))
        .map(p => p.id!)
        .filter(Boolean)
    );
    this.produitEnCours.set(null);
    this.showValidationErrors = false;
  }

  backToSelection(): void {
    if (this.isCorrectionMode()) return;

    this.selectedDelivrance.set(null);
    this.selectedProducts.set([]);
    this.produitEnCours.set(null);
    this.showValidationErrors = false;
  }

  hasAvailableProducts(delivrance: Delivrance): boolean {
    if (!delivrance.produitsSanguins?.length) return false;
    return delivrance.produitsSanguins.some(p => !this.isProductTransfused(p));
  }

  isProductTransfused(produit: ProduitSanguin): boolean {
    if (!produit.etat) return false;
    const etat = produit.etat.toUpperCase();
    return etat === 'UTILISÉ' || etat === 'UTILISE';
  }

  getTransfusedProductsCount(delivrance: Delivrance): number {
    return (delivrance.produitsSanguins || []).filter(p => this.isProductTransfused(p)).length;
  }

  getRemainingProductsCount(delivrance: Delivrance): number {
    return (delivrance.produitsSanguins || []).filter(p => !this.isProductTransfused(p)).length;
  }

  /* =======================
     PRODUITS
  ======================= */
  selectProduct(index: number): void {
    if (this.isCorrectionMode()) return;

    const delivrance = this.selectedDelivrance();
    if (!delivrance?.produitsSanguins?.[index]) return;

    const produit = delivrance.produitsSanguins[index];
    if (!produit.id || this.produitsTraites().includes(produit.id) || this.isProductTransfused(produit)) {
      return;
    }

    const selection = new Array(delivrance.produitsSanguins.length).fill(false);
    selection[index] = true;
    this.selectedProducts.set(selection);
    this.produitEnCours.set(produit);
    this.showValidationErrors = false;
  }

  deselectionnerProduit(produitId: number): void {
    const delivrance = this.selectedDelivrance();
    if (!delivrance?.produitsSanguins?.length) return;

    const index = delivrance.produitsSanguins.findIndex(p => p.id === produitId);
    if (index === -1) return;

    const selection = [...this.selectedProducts()];
    selection[index] = false;
    this.selectedProducts.set(selection);

    if (this.produitEnCours()?.id === produitId) {
      this.produitEnCours.set(null);
    }
  }

  getSelectedProductIds(): number[] {
    const delivrance = this.selectedDelivrance();
    if (!delivrance?.produitsSanguins?.length) return [];

    return delivrance.produitsSanguins
      .filter((_, index) => this.selectedProducts()[index])
      .map(p => p.id!)
      .filter(Boolean);
  }

  isProduitUniqueSelectionne(): boolean {
    return this.getSelectedProductIds().length === 1;
  }

  getProduitStatutLabel(produit: ProduitSanguin, index: number): string {
    if (this.isProductTransfused(produit) || this.produitsTraites().includes(produit.id!)) {
      return 'Acte terminé';
    }

    if (this.selectedProducts()[index]) {
      return 'Produit actif';
    }

    return 'Disponible';
  }

  /* =======================
     SURVEILLANCES
  ======================= */
  addSurveillance(): void {
    const current = [...this.surveillances()];
    current.push({
      heure: this.getCurrentTime(),
      pouls: null,
      temperature: null,
      tension: '',
      observations: '',
      signesCliniques: ''
    });
    this.surveillances.set(current);
  }

  removeSurveillance(index: number): void {
    const current = [...this.surveillances()];
    if (current.length === 1) {
      this.showNotification('warning', 'Au moins une surveillance est requise');
      return;
    }
    current.splice(index, 1);
    this.surveillances.set(current);
  }

  updateSurveillance(index: number, field: keyof SurveillanceForm, value: any): void {
    const current = [...this.surveillances()];
    current[index] = {
      ...current[index],
      [field]: value
    };
    this.surveillances.set(current);
  }

  private mapSurveillancesToRequest(): SurveillanceRequest[] {
    return this.surveillances().map(s => ({
      heure: s.heure.length === 5 ? `${s.heure}:00` : s.heure,
      tension: s.tension,
      temperature: s.temperature ?? 0,
      pouls: s.pouls ?? 0,
      signesCliniques: s.signesCliniques,
      observations: s.observations || ''
    }));
  }

  /* =======================
     VALIDATION
  ======================= */
  isFormValidForTransfusion(): boolean {
    if (!this.selectedDelivrance()) return false;
    if (!this.isProduitUniqueSelectionne()) return false;
    if (!this.validateRequiredFields()) return false;
    if (!this.validateSurveillances()) return false;
    if (!this.validateDeclarant()) return false;
    return true;
  }

  isFormValidForCorrectionClinique(): boolean {
    if (!this.validateRequiredFieldsForCorrection()) return false;
    if (!this.validateSurveillances()) return false;
    return true;
  }

  isFormValidForIncident(): boolean {
    if (!this.isFormValidForTransfusion()) return false;

    const form = this.transfusionForm.value;
    if (form.effetsIndesirables) {
      if (!form.typeEffet || !form.graviteEffet) {
        return false;
      }
    }

    return true;
  }

  private validateRequiredFields(): boolean {
    const form = this.transfusionForm;
    const requiredFields = [
      form.get('medecinId'),
      form.get('dateTransfusion'),
      form.get('heureDebut'),
      form.get('tolerance'),
      form.get('etatPatientApres')
    ];

    for (const control of requiredFields) {
      if (!control?.value || control.invalid) {
        control?.markAsTouched();
        return false;
      }
    }

    return true;
  }

  private validateRequiredFieldsForCorrection(): boolean {
    const form = this.transfusionForm;
    const requiredFields = [
      form.get('tolerance'),
      form.get('etatPatientApres')
    ];

    for (const control of requiredFields) {
      if (!control?.value || control.invalid) {
        control?.markAsTouched();
        return false;
      }
    }

    if (form.get('effetsIndesirables')?.value) {
      if (!form.get('typeEffet')?.value || !form.get('graviteEffet')?.value) {
        form.get('typeEffet')?.markAsTouched();
        form.get('graviteEffet')?.markAsTouched();
        return false;
      }
    }

    return true;
  }

  private validateSurveillances(): boolean {
    const list = this.surveillances();
    if (!list.length) return false;

    return list.every(s =>
      !!s.heure &&
      s.pouls !== null &&
      s.temperature !== null &&
      !!s.tension
    );
  }

  private validateDeclarant(): boolean {
    const form = this.transfusionForm;
    const fields = [
      form.get('prenomDeclarant'),
      form.get('nomDeclarant'),
      form.get('fonctionDeclarant')
    ];

    for (const control of fields) {
      if (!control?.value || control.invalid) {
        control?.markAsTouched();
        return false;
      }
    }

    return true;
  }

  markAllFieldsAsTouched(): void {
    Object.values(this.transfusionForm.controls).forEach(control => control.markAsTouched());
  }

  getValidationChecklist() {
    if (this.isCorrectionMode()) {
      return [
        { label: 'Tolérance renseignée', ok: !!this.transfusionForm.get('tolerance')?.value },
        { label: 'État patient après', ok: !!this.transfusionForm.get('etatPatientApres')?.value },
        { label: 'Surveillance renseignée', ok: this.validateSurveillances() },
        {
          label: 'Effet documenté si incident',
          ok: !this.transfusionForm.get('effetsIndesirables')?.value ||
            (!!this.transfusionForm.get('typeEffet')?.value && !!this.transfusionForm.get('graviteEffet')?.value)
        }
      ];
    }

    return [
      { label: 'Produit sélectionné', ok: this.isProduitUniqueSelectionne() },
      { label: 'Médecin renseigné', ok: !!this.transfusionForm.get('medecinId')?.value },
      {
        label: 'Date/heure renseignées',
        ok: !!this.transfusionForm.get('dateTransfusion')?.value && !!this.transfusionForm.get('heureDebut')?.value
      },
      { label: 'Surveillance renseignée', ok: this.validateSurveillances() },
      { label: 'Déclarant renseigné', ok: this.validateDeclarant() },
      { label: 'État patient après', ok: !!this.transfusionForm.get('etatPatientApres')?.value }
    ];
  }

  /* =======================
     CREATE / CORRECTION / INCIDENT
  ======================= */
  submitTransfusion(): void {
    this.showValidationErrors = true;

    if (!this.isFormValidForTransfusion()) {
      this.markAllFieldsAsTouched();
      this.showNotification('error', 'Veuillez corriger les erreurs du formulaire');
      return;
    }

    const selectedProductIds = this.getSelectedProductIds();
    if (selectedProductIds.length !== 1) {
      this.showNotification('error', 'Veuillez sélectionner un seul produit');
      return;
    }

    const produitId = selectedProductIds[0];
    const request = this.prepareTransfusionRequest(produitId);

    this.saving.set(true);

    this.transfusionService.create(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (transfusion) => {
          if (!transfusion.id) {
            this.showNotification('error', 'Transfusion créée mais ID manquant');
            this.saving.set(false);
            return;
          }

          this.marquerProduitCommeUtilise(produitId);

          this.produitsTraites.update(current => [...current, produitId]);
          this.deselectionnerProduit(produitId);

          this.resetFormAfterProduct();

          const restants = this.produitsRestants();
          if (restants > 0) {
            this.showNotification('success', 'Produit transfusé avec succès. Passez au produit suivant.');
          } else {
            this.showNotification('success', 'Tous les produits de cette délivrance ont été transfusés');
          }

          this.saving.set(false);
        },
        error: (error) => {
          console.error('Erreur création transfusion:', error);
          this.showNotification('error', `Erreur: ${error.error?.message || error.message}`);
          this.saving.set(false);
        }
      });
  }

  saveCorrectionClinique(): void {
    this.showValidationErrors = true;

    if (!this.isFormValidForCorrectionClinique()) {
      this.markAllFieldsAsTouched();
      this.showNotification('error', 'Veuillez corriger les erreurs du formulaire');
      return;
    }

    const id = this.transfusionId();
    if (!id) {
      this.showNotification('error', 'ID de transfusion manquant');
      return;
    }

    const payload = this.prepareCorrectionCliniqueRequest();
    this.saving.set(true);

    this.transfusionService.corrigerCliniquement(id, payload)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.saving.set(false))
      )
      .subscribe({
        next: () => {
          this.showNotification('success', 'Correction clinique enregistrée avec succès');
          this.router.navigate(['/app/transfusions']);
        },
        error: (error) => {
          console.error('Erreur correction clinique:', error);
          this.showNotification('error', error?.error?.message || 'Erreur lors de la correction clinique');
        }
      });
  }

  arreterTransfusionEtDeclarerIncident(): void {
    this.showValidationErrors = true;

    if (!this.isFormValidForIncident()) {
      this.markAllFieldsAsTouched();
      this.showNotification('error', 'Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    if (!this.selectedDelivrance() || !this.produitEnCours()) {
      this.showNotification('error', 'Veuillez sélectionner un produit à transfuser d\'abord');
      return;
    }

    const selectedProductIds = this.getSelectedProductIds();
    if (selectedProductIds.length !== 1) {
      this.showNotification('error', 'Veuillez sélectionner un seul produit');
      return;
    }

    const produitId = selectedProductIds[0];
    const request = this.prepareTransfusionRequest(produitId);

    this.arretEnCours.set(true);
    this.saving.set(true);

    this.transfusionService.create(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (transfusion) => {
          if (!transfusion.id) {
            this.showNotification('error', 'Erreur lors de la création de la transfusion');
            this.saving.set(false);
            this.arretEnCours.set(false);
            return;
          }

          this.marquerProduitCommeUtilise(produitId);
          this.produitsTraites.update(current => [...current, produitId]);
          this.deselectionnerProduit(produitId);

          this.router.navigate(['/app/incidents/declarer'], {
            state: {
              transfusionId: transfusion.id,
              context: 'arret-transfusion',
              prefillData: this.prepareIncidentData(transfusion.id, produitId)
            }
          });

          this.saving.set(false);
          this.arretEnCours.set(false);
        },
        error: (error) => {
          console.error('Erreur création transfusion pour incident:', error);
          this.showNotification('error', `Erreur: ${error.error?.message || error.message}`);
          this.saving.set(false);
          this.arretEnCours.set(false);
        }
      });
  }

  private prepareTransfusionRequest(produitId: number): CreerTransfusionRequest {
    const form = this.transfusionForm.value;
    const demande = this.selectedDelivrance()?.demande;

    return {
      medecinId: Number(form.medecinId),
      produitSanguinId: produitId,
      patientPrenom: demande?.patientPrenom || '',
      patientNom: demande?.patientNom || '',
      patientDateNaissance: this.formatDateForAPI(demande?.patientDateNaissance) || '',
      patientNumDossier: demande?.patientNumDossier || '',
      groupeSanguinPatient: demande?.groupeSanguinPatient || '',
      dateTransfusion: this.formatDateForAPI(form.dateTransfusion) || this.formatDateForAPI(new Date()) || '',
      heureDebut: this.formatTimeForAPI(form.heureDebut) || '00:00:00',
      etatPatientApres: form.etatPatientApres,
      tolerance: form.tolerance,
      effetsIndesirables: form.effetsIndesirables || false,
      typeEffet: form.typeEffet || undefined,
      prenomDeclarant: form.prenomDeclarant,
      nomDeclarant: form.nomDeclarant,
      fonctionDeclarant: form.fonctionDeclarant,
      notes: form.notes || '',
      volumeMl: form.volume || undefined,
      graviteEffet: form.graviteEffet || undefined,
      dateDeclaration: this.formatDateForAPI(new Date()) || undefined,
      surveillances: this.mapSurveillancesToRequest()
    } as CreerTransfusionRequest;
  }

  private prepareCorrectionCliniqueRequest(): CorrectionCliniqueTransfusionRequest {
    const form = this.transfusionForm.value;

    return {
      tolerance: form.tolerance,
      etatPatientApres: form.etatPatientApres,
      effetsIndesirables: form.effetsIndesirables || false,
      typeEffet: form.typeEffet || undefined,
      graviteEffet: form.graviteEffet || undefined,
      notes: form.notes || '',
      surveillances: this.mapSurveillancesToRequest()
    };
  }

  private prepareIncidentData(transfusionId: number, produitId: number): any {
    const produit = this.findProduitById(produitId);
    const formValue = this.transfusionForm.value;
    const now = new Date();

    return {
      transfusionId,
      patientNom: this.selectedDelivrance()!.demande?.patientNom || '',
      patientPrenom: this.selectedDelivrance()!.demande?.patientPrenom || '',
      patientDateNaissance: this.selectedDelivrance()!.demande?.patientDateNaissance || '',
      patientNumDossier: this.selectedDelivrance()!.demande?.patientNumDossier || '',
      groupeSanguinPatient: this.selectedDelivrance()!.demande?.groupeSanguinPatient || '',
      typeProduitTransfuse: produit?.typeProduit || '',
      numeroLotProduit: produit?.codeProduit || '',
      datePeremptionProduit: produit?.datePeremption || '',
      dateIncident: this.formatDateForAPI(now),
      heureIncident: this.formatTimeForAPI(this.getCurrentTime()),
      nomDeclarant: formValue.nomDeclarant,
      fonctionDeclarant: formValue.fonctionDeclarant,
      signes: formValue.typeEffet || '',
      descriptionIncident: formValue.notes || '',
      gravite: formValue.graviteEffet || ''
    };
  }

  private resetFormAfterProduct(): void {
    const currentUser = this.currentUser();

    this.transfusionForm.patchValue({
      medecinId: this.transfusionForm.get('medecinId')?.value || '',
      dateTransfusion: new Date(),
      heureDebut: this.getCurrentTime(),
      volume: null,
      temperatureProduit: null,
      tolerance: 'Bonne',
      etatPatientApres: '',
      notes: '',
      observations: '',
      effetsIndesirables: false,
      typeEffet: '',
      graviteEffet: '',
      prenomDeclarant: currentUser?.prenom || this.transfusionForm.get('prenomDeclarant')?.value || '',
      nomDeclarant: currentUser?.nom || this.transfusionForm.get('nomDeclarant')?.value || '',
      fonctionDeclarant: currentUser?.fonction || currentUser?.role || this.transfusionForm.get('fonctionDeclarant')?.value || ''
    });

    this.surveillances.set([{
      heure: this.getCurrentTime(),
      pouls: null,
      temperature: null,
      tension: '',
      observations: '',
      signesCliniques: ''
    }]);

    this.produitEnCours.set(null);
    this.showValidationErrors = false;
  }

  private marquerProduitCommeUtilise(_: number): void {
    // Le backend doit idéalement gérer cela automatiquement.
  }

  /* =======================
     UTILS UI
  ======================= */
  getCurrentTime(): string {
    const now = new Date();
    return now.toTimeString().substring(0, 5);
  }

  getSelectedProductVolume(): number | null {
    return this.produitEnCours()?.volumeMl || null;
  }

  getSelectedProductPeremption(): string {
    return this.produitEnCours()?.datePeremption || '';
  }

  getProduitProgressLabel(): string {
    const delivrance = this.selectedDelivrance();
    if (!delivrance?.produitsSanguins?.length) return '0/0';

    const total = delivrance.produitsSanguins.length;
    const traites = this.produitsTraites().length;
    return `${traites}/${total}`;
  }

  isTolerance(level: string): boolean {
    return this.transfusionForm.get('tolerance')?.value === level;
  }

  setTolerance(level: string): void {
    this.transfusionForm.patchValue({ tolerance: level });
  }

  formatDate(date: any): string {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('fr-FR');
    } catch {
      return String(date);
    }
  }

  formatTime(date: any): string {
    if (!date) return '';
    try {
      return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }

  private formatDateForAPI(date: any): string | null {
    if (!date) return null;
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return null;
    }
  }

  private formatTimeForAPI(time: string): string | null {
    if (!time) return null;
    if (/^\d{2}:\d{2}$/.test(time)) {
      return `${time}:00`;
    }
    return time;
  }

  private findProduitById(produitId: number): ProduitSanguin | undefined {
    return this.selectedDelivrance()?.produitsSanguins?.find(p => p.id === produitId);
  }

  getReadonlyMedecinLabel(): string {
    const transfusion = this.currentTransfusion();
    if (transfusion?.medecin) {
      return `Dr ${transfusion.medecin.prenom || ''} ${transfusion.medecin.nom || ''}`.trim();
    }

    const medecinId = this.transfusionForm.get('medecinId')?.value;
    const medecin = this.medecins().find(m => m.id === medecinId);
    if (medecin) {
      return `Dr ${medecin.prenom || ''} ${medecin.nom || ''}`.trim();
    }

    return 'N/A';
  }

  showNotification(type: 'success' | 'error' | 'warning' | 'info', message: string): void {
    this.snackBar.open(message, 'Fermer', {
      duration: 4000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [`snackbar-${type}`]
    });
  }

  backToList(): void {
    this.router.navigate(['/app/transfusions']);
  }
}