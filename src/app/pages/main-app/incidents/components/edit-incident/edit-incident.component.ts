import {
  Component,
  inject,
  input,
  OnInit,
  output,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, CommonModule } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import { Subject } from 'rxjs';
import { takeUntil, debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { AuthService } from '../../../../../services/auth.service';
import {
  CreerIncidentRequest,
  IncidentTransfusionnelService
} from '../../../../../services/Incident-transfusionnel.service';
import { IncidentTransfusionnel } from '../../../../../interfaces/incident-transfusionnel.interface';
import { Transfusion } from '../../../../../interfaces/transfusion.interface';
import { TransfusionService } from '../../../../../services/transfusion.service';
import {
  getUserType,
  isPersonnel,
  isChefService,
  isAdmin
} from '../../../../../interfaces/any-utilisateur.interface';
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
  updateItem = input<IncidentTransfusionnel | null>();
  addedData = output<CreerIncidentRequest>();
  saved = output<IncidentTransfusionnel>();
  cancelled = output<void>();

  form!: FormGroup;

  private formBuilder = inject(FormBuilder);
  private datePipe = inject(DatePipe);
  private authService = inject(AuthService);
  private incidentService = inject(IncidentTransfusionnelService);
  private transfusionService = inject(TransfusionService);
  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  currentUser = this.authService.getCurrentUser();
  transfusionsCompatibles: Transfusion[] = [];
  loadingTransfusions = false;
  selectedTransfusion: Transfusion | null = null;
  isEditMode = false;
  isArretTransfusion = false;
  transfusionIdFromContext: number | null = null;

  typeProduitOptions = [
    { value: 'CGR', label: 'CGR (Concentré de Globules Rouges)' },
    { value: 'CPP', label: 'CPP (Concentré de Plaquettes)' },
    { value: 'PFC', label: 'PFC (Plasma Frais Congelé)' },
    { value: 'CGL', label: 'CGL (Concentré de Globules Leucoplaquettaires)' },
    { value: 'OTHER', label: 'Autre produit' }
  ];

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

  private readonlyFieldsInEdit = [
    'transfusionId',
    'patientNom',
    'patientPrenom',
    'patientDateNaissance',
    'patientNumDossier',
    'typeProduitTransfuse',
    'numeroLotProduit',
    'datePeremptionProduit'
  ];

  ngOnInit() {
    const navigationState = history.state || {};
    this.isEditMode = !!this.updateItem();

    if (navigationState.transfusionId) {
      this.transfusionIdFromContext = Number(navigationState.transfusionId);

      if (navigationState.context === 'arret-transfusion') {
        this.isArretTransfusion = true;
      }
    }

    this.initForm();

    if (navigationState.transfusionId) {
      const transfusionId = Number(navigationState.transfusionId);

      if (navigationState.context === 'arret-transfusion') {
        this.prepareArretTransfusionData(transfusionId, navigationState.prefillData);
      } else {
        this.form.patchValue({
          transfusionId
        });
        this.loadTransfusionDetails(transfusionId);
      }
    }

    if (!this.isEditMode && !this.isArretTransfusion) {
      this.loadTransfusionsCompatibles();
    }

    this.setupFormListeners();

    setTimeout(() => {
      this.debugFormState();
    }, 100);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm() {
    const item = this.updateItem();
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().split(' ')[0].substring(0, 5);

    let transfusionIdValue = 0;
    let transfusionIdDisabled = false;

    if (this.isArretTransfusion && this.transfusionIdFromContext) {
      transfusionIdValue = this.transfusionIdFromContext;
      transfusionIdDisabled = true;
    } else if (this.isEditMode && item?.transfusion?.id) {
      transfusionIdValue = Number(item.transfusion.id);
      transfusionIdDisabled = true;
    }

    this.form = this.formBuilder.group({
      transfusionId: [
        {
          value: transfusionIdValue,
          disabled: transfusionIdDisabled
        },
        this.isEditMode || this.isArretTransfusion
          ? []
          : [Validators.required, Validators.min(1)]
      ],

      patientNom: [item?.patientNom ?? '', Validators.required],
      patientPrenom: [item?.patientPrenom ?? '', Validators.required],
      patientDateNaissance: [
        item?.patientDateNaissance ? this.formatDateForInput(item.patientDateNaissance) : '',
        Validators.required
      ],
      patientNumDossier: [item?.patientNumDossier ?? '', Validators.required],

      dateIncident: [
        item?.dateIncident ? this.formatDateForInput(item.dateIncident) : today,
        Validators.required
      ],
      heureIncident: [
        item?.heureIncident ? this.formatHeurePourInput(item.heureIncident) : now,
        Validators.required
      ],
      lieuIncident: [item?.lieuIncident ?? this.lieuSuggestions[0], Validators.required],

      typeProduitTransfuse: [item?.typeProduitTransfuse ?? 'CGR', Validators.required],
      numeroLotProduit: [item?.numeroLotProduit ?? '', Validators.required],
      datePeremptionProduit: [
        item?.datePeremptionProduit ? this.formatDateForInput(item.datePeremptionProduit) : '',
        Validators.required
      ],

      descriptionIncident: [item?.descriptionIncident ?? ''],
      signes: [item?.signes ?? ''],
      symptomes: [(item as any)?.symptomes ?? ''],
      actionsImmediates: [(item as any)?.actionsImmediates ?? ''],

      nomDeclarant: [item?.nomDeclarant ?? this.getCurrentUserFullName(), Validators.required],
      fonctionDeclarant: [item?.fonctionDeclarant ?? this.getDefaultFonction(), Validators.required],
      personnesInformees: [(item as any)?.personnesInformees ?? ''],

      registreHemovigilance: [(item as any)?.registreHemovigilance ?? ''],
      analysePreliminaire: [(item as any)?.analysePreliminaire ?? ''],
      actionsCorrectives: [(item as any)?.actionsCorrectives ?? ''],

      signatureDeclarant: [(item as any)?.signatureDeclarant ?? '']
    });

    if (transfusionIdValue > 0) {
      this.loadTransfusionDetails(transfusionIdValue);
    }

    if (this.isEditMode) {
      this.readonlyFieldsInEdit.forEach(field => {
        this.form.get(field)?.disable();
      });
    }
  }

  private setupFormListeners() {
    if (!this.isEditMode && !this.isArretTransfusion) {
      this.form.get('transfusionId')?.valueChanges
        .pipe(
          takeUntil(this.destroy$),
          debounceTime(300),
          distinctUntilChanged()
        )
        .subscribe((transfusionId: number) => {
          if (transfusionId && transfusionId > 0) {
            this.loadTransfusionDetails(transfusionId);
          } else {
            this.selectedTransfusion = null;
          }
        });
    }
  }

  private loadTransfusionsCompatibles() {
    if (this.isArretTransfusion) return;

    this.loadingTransfusions = true;

    this.transfusionService.getTransfusionsCompatibles().subscribe({
      next: (transfusions) => {
        this.transfusionsCompatibles = transfusions || [];
        this.loadingTransfusions = false;
      },
      error: (error) => {
        console.error('❌ Erreur chargement transfusions compatibles:', error);
        this.loadingTransfusions = false;
      }
    });
  }

  private loadTransfusionDetails(transfusionId: number) {
    this.transfusionService.getById(transfusionId).subscribe({
      next: (transfusion) => {
        this.selectedTransfusion = transfusion;
        this.prefillFormWithTransfusion(transfusion);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Erreur chargement détails transfusion:', error);
      }
    });
  }

  private prepareArretTransfusionData(transfusionId: number, prefillData: any) {
    this.form.patchValue({
      transfusionId
    });

    if (prefillData) {
      this.form.patchValue({
        patientNom: prefillData.patientNom || '',
        patientPrenom: prefillData.patientPrenom || '',
        patientDateNaissance: this.formatDateForInput(prefillData.patientDateNaissance),
        patientNumDossier: prefillData.patientNumDossier || '',
        typeProduitTransfuse: prefillData.typeProduitTransfuse || 'CGR',
        numeroLotProduit: prefillData.numeroLotProduit || '',
        datePeremptionProduit: this.formatDateForInput(prefillData.datePeremptionProduit),
        dateIncident: this.formatDateForInput(prefillData.dateIncident) || new Date().toISOString().split('T')[0],
        heureIncident: this.formatHeurePourInput(prefillData.heureIncident) || '',
        descriptionIncident: prefillData.descriptionIncident || 'Arrêt de la transfusion suite à effet indésirable observé.',
        signes: prefillData.signes || '',
        actionsImmediates: prefillData.actionsImmediates || 'Arrêt immédiat de la perfusion, monitoring du patient, appel du médecin.',
        nomDeclarant: prefillData.nomDeclarant || this.getCurrentUserFullName(),
        fonctionDeclarant: prefillData.fonctionDeclarant || this.getDefaultFonction()
      });
    }

    this.loadTransfusionDetails(transfusionId);
  }

  private prefillFormWithTransfusion(transfusion: Transfusion) {
    this.form.patchValue({
      patientNom: transfusion.patientNom || '',
      patientPrenom: transfusion.patientPrenom || '',
      patientDateNaissance: this.formatDateForInput(transfusion.patientDateNaissance),
      patientNumDossier: transfusion.patientNumDossier || ''
    });

    if (transfusion.produitSanguin) {
      const produit = transfusion.produitSanguin;

      const typeProduit = produit.typeProduit || 'CGR';
      const numeroLot = produit.codeProduit
        ? this.genererNumeroLotDepuisCodeProduit(produit.codeProduit, transfusion.id)
        : this.genererNumeroLotParDefaut(transfusion.id || 0);

      const datePeremption =
        produit.datePeremption || this.estimerDatePeremption(transfusion.dateTransfusion);

      this.form.patchValue({
        typeProduitTransfuse: typeProduit,
        numeroLotProduit: numeroLot,
        datePeremptionProduit: this.formatDateForInput(datePeremption)
      });
    }

    const now = new Date();
    const heureActuelle = this.formatHeurePourInput(now.toTimeString().split(' ')[0]);

    if (!this.isEditMode) {
      this.form.patchValue({
        dateIncident: this.formatDateForInput(transfusion.dateTransfusion),
        heureIncident: heureActuelle
      });
    }

    if (transfusion.patientNumDossier && !this.form.get('lieuIncident')?.value) {
      const lieuSuggestion = this.genererLieuSuggestion(transfusion.patientNumDossier);
      this.form.patchValue({
        lieuIncident: lieuSuggestion
      });
    }

    if (this.isArretTransfusion) {
      this.form.patchValue({
        descriptionIncident:
          this.form.get('descriptionIncident')?.value ||
          'Arrêt de la transfusion suite à effet indésirable observé.',
        actionsImmediates:
          this.form.get('actionsImmediates')?.value ||
          'Arrêt immédiat de la perfusion, monitoring du patient, appel du médecin.'
      });
    }
  }

  onSubmit() {
    this.debugFormState();

    if (this.form.invalid) {
      this.markFormGroupTouched();
      this.afficherErreursValidation();
      return;
    }

    if (!this.isEditMode && !this.peutDeclarerIncident()) {
      alert('Vous n\'avez pas les permissions pour déclarer un incident');
      return;
    }

    if (!this.validateIncident()) {
      return;
    }

    this.saveIncident();
  }

  private saveIncident() {
    const formValue = this.form.getRawValue();

    const payload: CreerIncidentRequest = {
      transfusionId: Number(formValue.transfusionId),
      dateIncident: formValue.dateIncident,
      heureIncident: this.formatHeurePourBackend(formValue.heureIncident),
      lieuIncident: formValue.lieuIncident,
      patientPrenom: formValue.patientPrenom,
      patientNom: formValue.patientNom,
      patientDateNaissance: formValue.patientDateNaissance,
      patientNumDossier: formValue.patientNumDossier,
      typeProduitTransfuse: formValue.typeProduitTransfuse,
      numeroLotProduit: formValue.numeroLotProduit,
      datePeremptionProduit: formValue.datePeremptionProduit,
      descriptionIncident: formValue.descriptionIncident || '',
      signes: formValue.signes || '',
      symptomes: formValue.symptomes || '',
      actionsImmediates: formValue.actionsImmediates || '',
      personnesInformees: formValue.personnesInformees || '',
      analysePreliminaire: formValue.analysePreliminaire || '',
      actionsCorrectives: formValue.actionsCorrectives || '',
      nomDeclarant: formValue.nomDeclarant,
      fonctionDeclarant: formValue.fonctionDeclarant,
      registreHemovigilance: formValue.registreHemovigilance || '',
      signatureDeclarant: formValue.signatureDeclarant || ''
    };

    if (this.isEditMode && this.updateItem()?.id) {
      const updatedItem: IncidentTransfusionnel = {
        ...(this.updateItem() as IncidentTransfusionnel),
        ...payload,
        id: this.updateItem()!.id
      } as unknown as IncidentTransfusionnel;

      this.saved.emit(updatedItem);
      return;
    }

    this.addedData.emit(payload);
  }

  private validateIncident(): boolean {
    const formValue = this.form.getRawValue();

    const transfusionId = Number(formValue.transfusionId);
    if (!transfusionId || transfusionId <= 0) {
      alert('Erreur: Veuillez sélectionner une transfusion valide');
      return false;
    }

    const birthDate = new Date(formValue.patientDateNaissance);
    if (birthDate > new Date()) {
      alert('La date de naissance ne peut pas être dans le futur');
      return false;
    }

    const peremptionDate = new Date(formValue.datePeremptionProduit);
    if (peremptionDate < new Date()) {
      if (!confirm('ATTENTION : Le produit transfusé semble périmé. Voulez-vous continuer ?')) {
        return false;
      }
    }

    const incidentDate = new Date(formValue.dateIncident);
    if (incidentDate > new Date()) {
      alert('La date de l\'incident ne peut pas être dans le futur');
      return false;
    }

    if (!this.validateHeureFormat(formValue.heureIncident)) {
      alert('Format d\'heure invalide. Utilisez HH:mm (ex: 14:30)');
      return false;
    }

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
    const labels: { [key: string]: string } = {
      transfusionId: 'Transfusion',
      patientNom: 'Nom du patient',
      patientPrenom: 'Prénom du patient',
      patientDateNaissance: 'Date de naissance',
      patientNumDossier: 'Numéro de dossier',
      dateIncident: 'Date de l\'incident',
      heureIncident: 'Heure de l\'incident',
      lieuIncident: 'Lieu de l\'incident',
      typeProduitTransfuse: 'Type de produit',
      numeroLotProduit: 'Numéro de lot',
      datePeremptionProduit: 'Date de péremption',
      nomDeclarant: 'Nom du déclarant',
      fonctionDeclarant: 'Fonction du déclarant'
    };

    return labels[field] || field;
  }

  private markFormGroupTouched() {
    Object.keys(this.form.controls).forEach(key => {
      this.form.get(key)?.markAsTouched();
    });
  }

  isFieldReadOnly(field: string): boolean {
    return this.isEditMode && this.readonlyFieldsInEdit.includes(field);
  }

  peutDeclarerIncident(): boolean {
    if (!this.currentUser) return false;

    const userType = getUserType(this.currentUser as any);
    return ['ADMIN', 'MEDECIN', 'PERSONNEL', 'CHEF_SERVICE'].includes(userType);
  }

  getCurrentUserFullName(): string {
    if (!this.currentUser) return '';
    return `${this.currentUser.prenom || ''} ${this.currentUser.nom || ''}`.trim();
  }

  getDefaultFonction(): string {
    if (!this.currentUser) return '';

    if (isAdmin(this.currentUser as any)) return 'Administrateur';
    if (isChefService(this.currentUser as any)) return 'Chef de service';
    if (isPersonnel(this.currentUser as any)) return (this.currentUser as any).fonction || 'Personnel';
    return (this.currentUser as any).role || '';
  }

  getTransfusionDescription(transfusion: Transfusion): string {
    return `#${transfusion.id} - ${transfusion.patientPrenom} ${transfusion.patientNom} (${this.formatDateForDisplay(transfusion.dateTransfusion)})`;
  }

  private debugFormState() {
    console.log('=== DEBUG INCIDENT FORM ===');
    console.log('Mode édition:', this.isEditMode);
    console.log('Mode arrêt:', this.isArretTransfusion);
    console.log('selectedTransfusion:', this.selectedTransfusion);
    console.log('form raw value:', this.form?.getRawValue());
    console.log('form valid:', this.form?.valid);
  }

  cancel() {
    this.cancelled.emit();
  }

  formatDateForInput(date: any): string {
    if (!date) return '';
    try {
      return this.datePipe.transform(date, 'yyyy-MM-dd') || '';
    } catch {
      return '';
    }
  }

  formatDateForDisplay(date: any): string {
    if (!date) return '';
    try {
      return this.datePipe.transform(date, 'dd/MM/yyyy') || '';
    } catch {
      return '';
    }
  }

  formatHeurePourInput(heure: string): string {
    if (!heure) return '';
    if (heure.length >= 5) return heure.substring(0, 5);
    return heure;
  }

  private formatHeurePourBackend(heure: string): string {
    if (!heure) return '00:00:00';
    if (/^\d{1,2}:\d{2}$/.test(heure)) {
      const parts = heure.split(':');
      const hours = parts[0].padStart(2, '0');
      const minutes = parts[1].padStart(2, '0');
      return `${hours}:${minutes}:00`;
    }
    return heure;
  }

  private validateHeureFormat(heure: string): boolean {
    return /^([01]?\d|2[0-3]):[0-5]\d$/.test(heure) || /^([01]?\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(heure);
  }

  private genererNumeroLotDepuisCodeProduit(codeProduit: string, transfusionId?: number): string {
    const date = new Date();
    const year = date.getFullYear().toString().substring(2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const idSuffix = transfusionId ? `-TR${transfusionId}` : '';
    return `LOT-${codeProduit}-${year}${month}${idSuffix}`;
  }

  private genererNumeroLotParDefaut(transfusionId: number): string {
    const date = new Date();
    const year = date.getFullYear().toString().substring(2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `LOT-DEF-${year}${month}${day}-TR${transfusionId}`;
  }

  private estimerDatePeremption(dateTransfusion: any): string {
    const d = new Date(dateTransfusion || new Date());
    d.setDate(d.getDate() + 35);
    return d.toISOString().split('T')[0];
  }

  private genererLieuSuggestion(numDossier: string): string {
    if (!numDossier) return this.lieuSuggestions[0];

    const dossier = numDossier.toUpperCase();
    if (dossier.includes('URG')) return 'Urgences';
    if (dossier.includes('REA')) return 'Réanimation';
    if (dossier.includes('MAT')) return 'Maternité';
    if (dossier.includes('ONC')) return 'Oncologie';
    return this.lieuSuggestions[0];
  }
}