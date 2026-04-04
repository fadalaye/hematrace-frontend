import { Component, inject, signal, TemplateRef, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

/* ---------- Material ---------- */
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';

/* ---------- 3rd-party ---------- */
import { ModalModule, BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/* ---------- Domain ---------- */
import { Delivrance } from '../../../interfaces/delivrance.interface';
import { Demande } from '../../../interfaces/demande.interface';
import { ProduitSanguin } from '../../../interfaces/produit-sanguin.interface';
import { DelivranceService, CreerDelivranceData, ModifierDelivranceData } from '../../../services/delivrance.service';
import { DemandeService } from '../../../services/demande.service';
import { ProduitSanguinService } from '../../../services/produit-sanguin.service';
import { AuthService } from '../../../services/auth.service';

type DelivranceViewMode = 'table' | 'cards' | 'timeline';

@Component({
  selector: 'app-delivrances',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatCardModule,
    MatCheckboxModule,
    ModalModule
  ],
  templateUrl: './delivrances.component.html',
  styleUrls: ['./delivrances.component.scss']
})
export class DelivrancesComponent implements OnInit, AfterViewInit {
  /* ---------- Services ---------- */
  private modalService = inject(BsModalService);
  private delivranceService = inject(DelivranceService);
  private demandeService = inject(DemandeService);
  private produitSanguinService = inject(ProduitSanguinService);
  public authService = inject(AuthService);
  private router = inject(Router);

  /* ---------- États ---------- */
  delivrances = signal<Delivrance[]>([]);
  demandesValidees = signal<Demande[]>([]);
  produitsDisponibles = signal<ProduitSanguin[]>([]);
  loadingIndicator = signal<boolean>(false);
  savingIndicator = signal<boolean>(false);
  modalRef = signal<BsModalRef | null>(null);

  selectedDelivranceForEdit = signal<Delivrance | null>(null);
  editDestination = signal<string>('');
  editModeTransport = signal<string>('');
  editObservations = signal<string>('');

  /* ---------- Création ---------- */
  selectedDemande = signal<Demande | null>(null);
  selectedProduits = signal<ProduitSanguin[]>([]);
  searchTerm = signal<string>('');
  produitSearchTerm = signal<string>('');
  step = signal<number>(1);

  /* ---------- Vue ---------- */
  viewMode = signal<DelivranceViewMode>('table');

  @ViewChild('editDelivranceModalTemplate') editDelivranceModalTemplate!: TemplateRef<any>;

  /* ---------- Filtres avancés ---------- */
  selectedSearchTerm = signal<string>('');
  selectedService = signal<string>('TOUS');
  selectedDestination = signal<string>('TOUS');
  dateDebut = signal<string>('');
  dateFin = signal<string>('');

  /* ---------- Table ---------- */
  displayedColumns: string[] = [
    'demandeInfo',
    'produitsInfo',
    'dateHeureDelivrance',
    'personnel',
    'destination',
    'actions'
  ];
  dataSource = new MatTableDataSource<Delivrance>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('detailsModalTemplate') detailsModalTemplate!: TemplateRef<any>;

  /* ---------- Détails ---------- */
  selectedDelivranceForDetails = signal<Delivrance | null>(null);
  detailsModalRef = signal<BsModalRef | null>(null);

  today = new Date();

  ngOnInit(): void {
    this.getDelivrances();
    this.getDemandesValidees();
    this.getProduitsDisponibles();
    this.initializeUserPermissions();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private initializeUserPermissions(): void {
    console.log('👤 Permissions utilisateur pour délivrances:', {
      estPersonnel: this.authService.isPersonnel(),
      estMedecin: this.authService.isMedecin(),
      estSuperUser: this.authService.isSuperUser(),
      peutCreerDelivrance: this.authService.canCreateDelivrance(),
      peutModifierDelivrance: this.authService.canUpdateDelivrance({}),
      peutSupprimerDelivrance: this.authService.canDeleteDelivrance(),
      peutCreerTransfusion: this.authService.canCreateTransfusion(),
      peutVoirDelivrances: this.authService.canViewDelivrances()
    });
  }

  /* ---------- Vue ---------- */
  setViewMode(mode: DelivranceViewMode): void {
    this.viewMode.set(mode);
  }

  getViewMode(): DelivranceViewMode {
    return this.viewMode();
  }

  /* ---------- Filtres avancés ---------- */
  onMainSearchChange(event: any): void {
    const term = event?.target?.value?.toLowerCase() || '';
    this.selectedSearchTerm.set(term);
    this.refreshDataSource();
  }

  onServiceFilterChange(event: any): void {
    this.selectedService.set(event.value || 'TOUS');
    this.refreshDataSource();
  }

  onDestinationFilterChange(event: any): void {
    this.selectedDestination.set(event.value || 'TOUS');
    this.refreshDataSource();
  }

  onDateDebutChange(event: any): void {
    this.dateDebut.set(event?.target?.value || '');
    this.refreshDataSource();
  }

  onDateFinChange(event: any): void {
    this.dateFin.set(event?.target?.value || '');
    this.refreshDataSource();
  }

  resetMainFilters(): void {
    this.selectedSearchTerm.set('');
    this.selectedService.set('TOUS');
    this.selectedDestination.set('TOUS');
    this.dateDebut.set('');
    this.dateFin.set('');
    this.refreshDataSource();
  }

  getServicesDisponibles(): string[] {
    const services = this.delivrances()
      .map(d => d.demande?.serviceDemandeur)
      .filter((x): x is string => !!x && x.trim().length > 0);
    return Array.from(new Set(services)).sort();
  }

  getDestinationsDisponibles(): string[] {
    const destinations = this.delivrances()
      .map(d => d.destination)
      .filter((x): x is string => !!x && x.trim().length > 0);
    return Array.from(new Set(destinations)).sort();
  }

  getFilteredDelivrances(): Delivrance[] {
    const term = this.selectedSearchTerm().trim().toLowerCase();
    const selectedService = this.selectedService();
    const selectedDestination = this.selectedDestination();
    const dateDebut = this.dateDebut();
    const dateFin = this.dateFin();

    let all = [...this.delivrances()];

    if (term) {
      all = all.filter(d =>
        `${d.demande?.patientPrenom || ''} ${d.demande?.patientNom || ''}`.toLowerCase().includes(term) ||
        (d.demande?.serviceDemandeur || '').toLowerCase().includes(term) ||
        (d.demande?.typeProduitDemande || '').toLowerCase().includes(term) ||
        (d.demande?.groupeSanguinPatient || '').toLowerCase().includes(term) ||
        (d.destination || '').toLowerCase().includes(term) ||
        (d.modeTransport || '').toLowerCase().includes(term) ||
        this.getProduitsDisplay(d.produitsSanguins || []).toLowerCase().includes(term)
      );
    }

    if (selectedService !== 'TOUS') {
      all = all.filter(d => (d.demande?.serviceDemandeur || '') === selectedService);
    }

    if (selectedDestination !== 'TOUS') {
      all = all.filter(d => (d.destination || '') === selectedDestination);
    }

    if (dateDebut) {
      const debut = new Date(dateDebut);
      debut.setHours(0, 0, 0, 0);
      all = all.filter(d => {
        if (!d.dateHeureDelivrance) return false;
        return new Date(d.dateHeureDelivrance) >= debut;
      });
    }

    if (dateFin) {
      const fin = new Date(dateFin);
      fin.setHours(23, 59, 59, 999);
      all = all.filter(d => {
        if (!d.dateHeureDelivrance) return false;
        return new Date(d.dateHeureDelivrance) <= fin;
      });
    }

    return all;
  }

  private refreshDataSource(): void {
    this.dataSource.data = this.getFilteredDelivrances();
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  /* ---------- KPI ---------- */
  getTotalDelivrancesCount(): number {
    return this.getFilteredDelivrances().length;
  }

  getDelivrancesDuJourCount(): number {
    const today = new Date();
    return this.getFilteredDelivrances().filter(d => {
      if (!d.dateHeureDelivrance) return false;
      const date = new Date(d.dateHeureDelivrance);
      return date.getFullYear() === today.getFullYear()
        && date.getMonth() === today.getMonth()
        && date.getDate() === today.getDate();
    }).length;
  }

  getTotalProduitsDelivresCount(): number {
    return this.getFilteredDelivrances().reduce((total, d) => total + (d.produitsSanguins?.length || 0), 0);
  }

  getDestinationsCount(): number {
    const destinations = this.getFilteredDelivrances()
      .map(d => d.destination)
      .filter((x): x is string => !!x && x.trim().length > 0);
    return new Set(destinations).size;
  }

  getDemandesValideesEnAttenteCount(): number {
    return this.demandesValidees().length;
  }

  getDelivrancesAvecTransfusionPossibleCount(): number {
    return this.getFilteredDelivrances().filter(d => this.canCreateTransfusionFromDelivrance(d)).length;
  }

  /* ---------- Permissions ---------- */
  canCreateDelivrance(): boolean {
    return this.authService.canCreateDelivrance();
  }

  canDeleteDelivrance(): boolean {
    return this.authService.canDeleteDelivrance();
  }

  canModifySpecificDelivrance(delivrance: Delivrance): boolean {
    return this.authService.canUpdateDelivrance(delivrance);
  }

  canCreateTransfusionFromDelivrance(delivrance: Delivrance): boolean {
    if (!this.authService.canCreateTransfusion()) {
      return false;
    }

    const produits = delivrance?.produitsSanguins || [];

    if (produits.length === 0) {
      return false;
    }

    return produits.some(produit => {
      const etat = (produit.etat || '').toUpperCase();
      return etat !== 'UTILISÉ' && etat !== 'UTILISE';
    });
  }

  showActionButtons(delivrance: Delivrance): boolean {
    return this.authService.canUpdateDelivrance(delivrance)
      || this.authService.canCreateTransfusion()
      || this.authService.canDeleteDelivrance();
  }

  /* ---------- Données ---------- */
  getDelivrances(): void {
    this.loadingIndicator.set(true);

    this.delivranceService.getAll().subscribe({
      next: (delivrances: Delivrance[]) => {
        const formattedDelivrances = (delivrances || []).map(d => ({
          ...d,
          dateHeureDelivrance: d.dateHeureDelivrance ? new Date(d.dateHeureDelivrance) : new Date(),
          produitsSanguins: d.produitsSanguins || []
        }));

        const filteredDelivrances = this.authService.filterDelivrancesByPermission(formattedDelivrances);

        this.delivrances.set(filteredDelivrances);
        this.refreshDataSource();
        this.loadingIndicator.set(false);
      },
      error: (error) => {
        console.error('❌ Erreur chargement délivrances:', error);
        this.loadingIndicator.set(false);
        alert('Erreur lors du chargement des délivrances');
      }
    });
  }

  refreshDelivrances(): void {
    this.getDelivrances();
  }

  getDemandesValidees(): void {
    this.demandeService.getDemandesByStatut('VALIDÉE').subscribe({
      next: (demandes: Demande[]) => {
        this.demandesValidees.set(demandes || []);
      },
      error: (error) => {
        console.error('❌ Erreur demandes validées:', error);
        this.demandesValidees.set([]);
      }
    });
  }

  getProduitsDisponibles(): void {
    this.produitSanguinService.getByEtat('DISPONIBLE').subscribe({
      next: (produits: ProduitSanguin[]) => {
        this.produitsDisponibles.set(produits || []);
      },
      error: (error) => {
        console.error('❌ Erreur produits disponibles:', error);
        this.produitsDisponibles.set([]);
      }
    });
  }

  /* ---------- Filtrage modale ---------- */
  onSearchTermChange(_: any): void {
    this.searchTerm.set(this.searchTerm());
  }

  onProduitSearchTermChange(_: any): void {
    this.produitSearchTerm.set(this.produitSearchTerm());
  }

  getDemandesFiltrees(): Demande[] {
    const term = this.searchTerm().toLowerCase();
    const allDemandes = this.demandesValidees();

    if (!term.trim()) return allDemandes;

    return allDemandes.filter(d =>
      (d.patientNom?.toLowerCase() || '').includes(term) ||
      (d.patientPrenom?.toLowerCase() || '').includes(term) ||
      (d.serviceDemandeur?.toLowerCase() || '').includes(term) ||
      (d.groupeSanguinPatient?.toLowerCase() || '').includes(term) ||
      (d.typeProduitDemande?.toLowerCase() || '').includes(term)
    );
  }

  getDemandesFiltreesAvecStock(): Demande[] {
    return this.getDemandesFiltrees().filter(d => this.getProduitsCompatibles(d).length > 0);
  }

  filterProduitsDisponibles(): ProduitSanguin[] {
    if (!this.selectedDemande()) return [];

    const term = this.produitSearchTerm().toLowerCase();
    const compatibles = this.getProduitsCompatibles(this.selectedDemande()!);

    if (!term) return compatibles;

    return compatibles.filter(p =>
      (p?.codeProduit?.toLowerCase() || '').includes(term) ||
      (p?.typeProduit?.toLowerCase() || '').includes(term) ||
      ((p?.groupeSanguin || '') + (p?.rhesus || '')).toLowerCase().includes(term) ||
      (p?.datePeremption && this.formatDateForDisplay(p.datePeremption).toLowerCase().includes(term))
    );
  }

  getProduitsFiltres(): ProduitSanguin[] {
    return this.filterProduitsDisponibles();
  }

  /* ---------- Modales ---------- */
  openDelivranceModal(template: TemplateRef<any>): void {
    if (!this.authService.canCreateDelivrance()) {
      alert('❌ Vous n\'avez pas les droits pour créer des délivrances');
      return;
    }

    this.selectedDemande.set(null);
    this.selectedProduits.set([]);
    this.step.set(1);
    this.searchTerm.set('');
    this.produitSearchTerm.set('');

    this.modalRef.set(
      this.modalService.show(template, {
        class: 'modal-xl',
        ignoreBackdropClick: true,
        backdrop: 'static'
      })
    );
  }

  closeModal(): void {
    this.modalRef()?.hide();
    this.modalRef.set(null);
    this.selectedDemande.set(null);
    this.selectedProduits.set([]);
    this.step.set(1);
    this.searchTerm.set('');
    this.produitSearchTerm.set('');
  }

  voirDetailsDelivrance(delivrance: Delivrance): void {
    this.selectedDelivranceForDetails.set(delivrance);
    const ref = this.modalService.show(this.detailsModalTemplate, {
      class: 'modal-xl modal-dialog-scrollable',
      ignoreBackdropClick: false
    });
    this.detailsModalRef.set(ref);
  }

  closeDetailsModal(): void {
    this.detailsModalRef()?.hide();
    this.detailsModalRef.set(null);
    this.selectedDelivranceForDetails.set(null);
  }

  /* ---------- Logique métier ---------- */
  selectDemandeInModal(demande: Demande): void {
    const compatibles = this.getProduitsCompatibles(demande);

    if (compatibles.length === 0) {
      alert(`Aucun produit compatible disponible pour le patient ${demande.groupeSanguinPatient}`);
      return;
    }

    this.selectedDemande.set(demande);
    this.selectedProduits.set([]);
    this.step.set(2);
  }

  toggleProduitSelection(produit: ProduitSanguin): void {
    if (!this.estProduitNonPerime(produit)) {
      alert(`Le produit ${produit.codeProduit} est périmé (${this.formatDateForDisplay(produit.datePeremption)})`);
      return;
    }

    const demande = this.selectedDemande();
    if (demande && !this.estProduitCompatible(produit, demande)) {
      alert(`Le produit ${produit.codeProduit} (${produit.groupeSanguin}${produit.rhesus}) n'est pas compatible avec le patient ${demande.groupeSanguinPatient}`);
      return;
    }

    const current = this.selectedProduits();
    const exists = current.some(p => p.id === produit.id);

    this.selectedProduits.set(
      exists
        ? current.filter(p => p.id !== produit.id)
        : [...current, produit]
    );
  }

  isProduitSelected(produit: ProduitSanguin): boolean {
    return this.selectedProduits().some(p => p.id === produit.id);
  }

  getProduitsCompatibles(demande: Demande): ProduitSanguin[] {
    if (!demande || !demande.groupeSanguinPatient) return [];

    return this.produitsDisponibles().filter(p =>
      this.estProduitCompatible(p, demande) &&
      this.estProduitNonPerime(p) &&
      p.etat?.toUpperCase() === 'DISPONIBLE'
    );
  }

  estProduitNonPerime(produit: ProduitSanguin): boolean {
    if (!produit.datePeremption) return true;

    const aujourdHui = new Date();
    const datePeremption = new Date(produit.datePeremption);

    return datePeremption > aujourdHui;
  }

  estProduitCompatible(produit: ProduitSanguin, demande: Demande): boolean {
    if (!demande.groupeSanguinPatient || !produit.groupeSanguin) {
      return false;
    }

    const compatibilite: { [key: string]: string[] } = {
      'A+': ['A+', 'A-', 'O+', 'O-'],
      'A-': ['A-', 'O-'],
      'B+': ['B+', 'B-', 'O+', 'O-'],
      'B-': ['B-', 'O-'],
      'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      'AB-': ['A-', 'B-', 'AB-', 'O-'],
      'O+': ['O+', 'O-'],
      'O-': ['O-']
    };

    let groupeProduit = produit.groupeSanguin.toUpperCase();
    if (produit.rhesus) {
      groupeProduit += produit.rhesus;
    } else {
      groupeProduit += '+';
    }

    const groupePatient = demande.groupeSanguinPatient.toUpperCase();
    const groupesCompatibles = compatibilite[groupePatient] || [];

    return groupesCompatibles.includes(groupeProduit);
  }

  /* ---------- Création ---------- */
  creerDelivrance(): void {
    if (!this.authService.canCreateDelivrance()) {
      alert('❌ Vous n\'avez pas les droits pour créer des délivrances');
      return;
    }

    const demande = this.selectedDemande();
    const produits = this.selectedProduits();

    if (!demande || produits.length === 0) {
      alert('Veuillez sélectionner une demande et au moins un produit');
      return;
    }

    const produitsPerimes = produits.filter(p => !this.estProduitNonPerime(p));
    if (produitsPerimes.length > 0) {
      alert('Certains produits sont périmés. Veuillez les désélectionner.');
      return;
    }

    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      alert('Veuillez vous connecter pour créer une délivrance');
      return;
    }

    const request: CreerDelivranceData = {
      demandeId: Number(demande.id),
      produitIds: produits.map(p => Number(p.id)),
      personnelId: Number(currentUser.id),
      destination: demande.serviceDemandeur || 'Service non spécifié',
      modeTransport: 'Transport interne',
      observations: `Délivrance pour ${demande.patientPrenom} ${demande.patientNom} - ${demande.serviceDemandeur}`
    };

    this.savingIndicator.set(true);

    this.delivranceService.create(request).subscribe({
      next: (delivrance: Delivrance) => {
        const newDelivrance: Delivrance = {
          ...delivrance,
          demande,
          produitsSanguins: produits,
          personnel: delivrance.personnel || undefined
        };

        this.delivrances.update(list => [newDelivrance, ...list]);
        this.refreshDataSource();

        this.getDemandesValidees();
        this.getProduitsDisponibles();

        this.savingIndicator.set(false);
        this.closeModal();
        alert('✅ Délivrance créée avec succès');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur création délivrance:', error);
        alert('Erreur lors de la création de la délivrance');
      }
    });
  }

modifierDelivrance(delivrance: Delivrance): void {
  if (!this.authService.canUpdateDelivrance(delivrance)) {
    alert('❌ Vous n’avez pas les droits pour modifier cette délivrance');
    return;
  }

  const contientProduitUtilise = (delivrance.produitsSanguins || []).some(produit => {
    const etat = (produit.etat || '').toUpperCase();
    return etat === 'UTILISÉ' || etat === 'UTILISE';
  });

  if (contientProduitUtilise) {
    alert('❌ Impossible de modifier cette délivrance : au moins un produit a déjà été transfusé');
    return;
  }

  this.selectedDelivranceForEdit.set(delivrance);
  this.selectedProduits.set([...(delivrance.produitsSanguins || [])]);

  this.editDestination.set(delivrance.destination || '');
  this.editModeTransport.set(delivrance.modeTransport || '');
  this.editObservations.set(delivrance.observations || '');

  this.modalRef.set(
    this.modalService.show(this.editDelivranceModalTemplate, {
      class: 'modal-xl',
      ignoreBackdropClick: true,
      backdrop: 'static'
    })
  );
}

  deleteDelivrance(delivrance: Delivrance): void {
    if (!this.authService.canDeleteDelivrance()) {
      alert('❌ Vous n\'avez pas les droits pour supprimer des délivrances');
      return;
    }

    if (!delivrance.id) return;

    const confirmation = confirm(
      `Êtes-vous sûr de vouloir supprimer cette délivrance ?\n\n` +
      `Patient: ${delivrance.demande?.patientPrenom || ''} ${delivrance.demande?.patientNom || ''}\n` +
      `Cette action est irréversible.`
    );

    if (!confirmation) return;

    this.savingIndicator.set(true);

    this.delivranceService.delete(delivrance.id).subscribe({
      next: () => {
        this.delivrances.update(list => list.filter(d => d.id !== delivrance.id));
        this.refreshDataSource();
        this.savingIndicator.set(false);
        alert('✅ Délivrance supprimée avec succès');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur suppression délivrance:', error);
        alert('Erreur lors de la suppression de la délivrance');
      }
    });
  }

  creerTransfusionDepuisDelivrance(delivrance: Delivrance): void {
    if (!this.authService.canCreateTransfusion()) {
      alert('❌ Vous n\'avez pas les droits pour créer une transfusion');
      return;
    }

    if (!this.canCreateTransfusionFromDelivrance(delivrance)) {
      alert('Cette délivrance ne contient aucun produit disponible pour une transfusion');
      return;
    }

    sessionStorage.setItem('selectedDelivranceForTransfusion', JSON.stringify(delivrance));
    this.router.navigate(['/app/transfusions/creer']);
  }

  creerTransfusionDepuisDetails(): void {
    const delivrance = this.selectedDelivranceForDetails();
    if (!delivrance) return;

    this.creerTransfusionDepuisDelivrance(delivrance);
    this.closeDetailsModal();
  }

  isProduitPerime(produit: ProduitSanguin): boolean {
    return !this.estProduitNonPerime(produit);
  }

  getInitials(personnel: any): string {
    if (!personnel) return '??';
    const prenom = personnel.prenom || '';
    const nom = personnel.nom || '';
    return (prenom.charAt(0) + nom.charAt(0)).toUpperCase();
  }

  imprimerDetails(): void {
    window.print();
  }

  /* ---------- Helpers UI ---------- */
  getDelivranceCardClass(delivrance: Delivrance): string {
    const count = delivrance.produitsSanguins?.length || 0;

    if (count >= 3) return 'delivrance-card-strong';
    if (count >= 1) return 'delivrance-card-normal';
    return 'delivrance-card-default';
  }

  getTimelineDateLabel(delivrance: Delivrance): string {
    if (!delivrance.dateHeureDelivrance) return 'Date inconnue';
    return new Date(delivrance.dateHeureDelivrance).toLocaleDateString('fr-FR');
  }

  getTimelineTimeLabel(delivrance: Delivrance): string {
    if (!delivrance.dateHeureDelivrance) return '';
    return new Date(delivrance.dateHeureDelivrance).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /* ---------- Utilitaires ---------- */
  getProduitsDisplay(produits: ProduitSanguin[] | undefined): string {
    if (!produits || produits.length === 0) return 'Aucun';
    return produits.map(p => p?.codeProduit).filter(Boolean).join(', ');
  }

  getGroupeSanguinDisplay(delivrance: Delivrance): string {
    if (!delivrance?.produitsSanguins || delivrance.produitsSanguins.length === 0) {
      return 'N/A';
    }

    const groupes = delivrance.produitsSanguins
      .filter(p => p?.groupeSanguin)
      .map(p => {
        const groupe = p.groupeSanguin || '';
        const rhesus = p.rhesus || '+';
        return groupe + rhesus;
      });

    const groupesUniques = Array.from(new Set(groupes));
    return groupesUniques.join(', ') || 'N/A';
  }

  exportToExcel(): void {
    if (this.getFilteredDelivrances().length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const data = this.getFilteredDelivrances().map(d => ({
      'ID': d.id,
      'Patient': `${d.demande?.patientPrenom || ''} ${d.demande?.patientNom || ''}`.trim(),
      'Groupe Sanguin': d.demande?.groupeSanguinPatient || 'N/A',
      'Service': d.demande?.serviceDemandeur || 'N/A',
      'Produits': d.produitsSanguins?.map(p => p.codeProduit).join(', ') || 'Aucun',
      'Date Délivrance': this.formatDateForDisplay(d.dateHeureDelivrance),
      'Destination': d.destination || 'N/A',
      'Transport': d.modeTransport || 'N/A',
      'Personnel': d.personnel ? `${d.personnel.prenom} ${d.personnel.nom}` : 'N/A',
      'Observations': d.observations || ''
    }));

    try {
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = {
        Sheets: { 'Délivrances': ws },
        SheetNames: ['Délivrances']
      };

      const excelBuffer: any = XLSX.write(wb, {
        bookType: 'xlsx',
        type: 'array'
      });

      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8'
      });

      saveAs(blob, `delivrances_${this.getFormattedDateForFile()}.xlsx`);
    } catch (error) {
      console.error('Erreur export Excel:', error);
      alert('Erreur lors de l’export Excel');
    }
  }

  formatDateForDisplay(date: any): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('fr-FR');
  }

  getFormattedDateForFile(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}_${hh}-${min}`;
  }



canEditDelivrance(delivrance: Delivrance): boolean {
  if (!this.authService.canUpdateDelivrance(delivrance)) {
    return false;
  }

  const produits = delivrance?.produitsSanguins || [];

  if (produits.length === 0) {
    return true;
  }

  const contientProduitUtilise = produits.some(produit => {
    const etat = (produit.etat || '').toUpperCase();
    return etat === 'UTILISÉ' || etat === 'UTILISE';
  });

  return !contientProduitUtilise;
}

isProduitEditable(produit: ProduitSanguin): boolean {
  const etat = (produit.etat || '').toUpperCase();
  return etat !== 'UTILISÉ' && etat !== 'UTILISE';
}

updateDelivranceComplete(): void {
  const delivrance = this.selectedDelivranceForEdit();

  if (!delivrance || !delivrance.id) {
    alert('❌ Délivrance invalide');
    return;
  }

  const produitsSelectionnes = this.selectedProduits();

  if (!this.editDestination().trim()) {
    alert('❌ La destination est obligatoire');
    return;
  }

  if (!this.editModeTransport().trim()) {
    alert('❌ Le mode de transport est obligatoire');
    return;
  }

  if (produitsSelectionnes.length === 0) {
    alert('❌ Veuillez sélectionner au moins un produit');
    return;
  }

  const contientProduitUtilise = produitsSelectionnes.some(produit => {
    const etat = (produit.etat || '').toUpperCase();
    return etat === 'UTILISÉ' || etat === 'UTILISE';
  });

  if (contientProduitUtilise) {
    alert('❌ Impossible d’enregistrer : un ou plusieurs produits sélectionnés sont déjà utilisés');
    return;
  }

  const payload: ModifierDelivranceData = {
    produitIds: produitsSelectionnes
      .map(p => p.id)
      .filter((id): id is number => typeof id === 'number'),
    destination: this.editDestination().trim(),
    modeTransport: this.editModeTransport().trim(),
    observations: this.editObservations().trim() || undefined
  };

  this.savingIndicator.set(true);

  this.delivranceService.updateComplete(delivrance.id, payload).subscribe({
    next: (updatedDelivrance) => {
      this.delivrances.update(list =>
        list.map(d => d.id === updatedDelivrance.id ? updatedDelivrance : d)
      );

      this.refreshDataSource();
      this.getProduitsDisponibles();

      this.savingIndicator.set(false);
      this.closeEditModal();

      alert('✅ Délivrance modifiée avec succès');
    },
    error: (error) => {
      this.savingIndicator.set(false);
      console.error('❌ Erreur modification délivrance:', error);
      alert(error?.message || 'Erreur lors de la modification de la délivrance');
    }
  });
}

closeEditModal(): void {
  this.modalRef()?.hide();
  this.modalRef.set(null);

  this.selectedDelivranceForEdit.set(null);
  this.editDestination.set('');
  this.editModeTransport.set('');
  this.editObservations.set('');
  this.selectedProduits.set([]);
}

getProduitsDisponiblesPourEdition(): ProduitSanguin[] {
  const delivrance = this.selectedDelivranceForEdit();
  const demande = delivrance?.demande;

  if (!demande) return [];

  const produitsCompatibles = this.getProduitsCompatibles(demande);
  const produitsActuels = delivrance?.produitsSanguins || [];

  const mapProduits = new Map<number, ProduitSanguin>();

  produitsCompatibles.forEach(produit => {
    if (produit.id != null) {
      mapProduits.set(produit.id, produit);
    }
  });

  produitsActuels.forEach(produit => {
    if (produit.id != null) {
      mapProduits.set(produit.id, produit);
    }
  });

  return Array.from(mapProduits.values());
}
}