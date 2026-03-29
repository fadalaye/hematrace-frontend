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
import { DelivranceService, CreerDelivranceData, ApiResponse } from '../../../services/delivrance.service';
import { DemandeService } from '../../../services/demande.service';
import { ProduitSanguinService } from '../../../services/produit-sanguin.service';
import { AuthService } from '../../../services/auth.service';
import { AnyUtilisateur, getUserType } from '../../../interfaces/any-utilisateur.interface';

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
  public authService = inject(AuthService); // IMPORTANT: public pour le template
  private router = inject(Router);

  /* ---------- ÉTATS ---------- */
  delivrances = signal<Delivrance[]>([]);
  demandesValidees = signal<Demande[]>([]);
  produitsDisponibles = signal<ProduitSanguin[]>([]);
  loadingIndicator = signal<boolean>(false);
  savingIndicator = signal<boolean>(false);
  modalRef = signal<BsModalRef | null>(null);

  /* ---------- CRÉATION ---------- */
  selectedDemande = signal<Demande | null>(null);
  selectedProduits = signal<ProduitSanguin[]>([]);
  searchTerm = signal<string>('');
  step = signal<number>(1);

  /* ---------- TABLE ---------- */
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
  today = new Date();

  /* ---------- NOUVEAUX SIGNALS ---------- */
  produitSearchTerm = signal<string>('');
  selectedDelivranceForDetails = signal<Delivrance | null>(null);
  detailsModalRef = signal<BsModalRef | null>(null);

  /* ---------- LIFECYCLE ---------- */
  ngOnInit() {
    this.getDelivrances();
    this.getDemandesValidees();
    this.getProduitsDisponibles();
    this.initializeUserPermissions();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /* ---------- PERMISSIONS ---------- */
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

  /**
   * Vérifie si l'utilisateur peut créer une délivrance
   */
  canCreateDelivrance(): boolean {
    return this.authService.canCreateDelivrance();
  }

  /**
   * Vérifie si l'utilisateur peut supprimer une délivrance
   */
  canDeleteDelivrance(): boolean {
    return this.authService.canDeleteDelivrance();
  }

  /**
   * Vérifie si l'utilisateur peut modifier cette délivrance spécifique
   */
  canModifySpecificDelivrance(delivrance: Delivrance): boolean {
    return this.authService.canUpdateDelivrance(delivrance);
  }

  /**
   * Vérifie si l'utilisateur peut créer une transfusion à partir de cette délivrance
   */
  canCreateTransfusionFromDelivrance(delivrance: Delivrance): boolean {
    if (!this.authService.canCreateTransfusion()) {
      return false;
    }
    
    // Vérifie que la délivrance a des produits
    return delivrance?.produitsSanguins?.length > 0;
  }

  /**
   * Vérifie si l'utilisateur a des actions disponibles sur cette délivrance
   */
  showActionButtons(delivrance: Delivrance): boolean {
    return this.authService.canUpdateDelivrance(delivrance) || 
           this.authService.canCreateTransfusion() || 
           this.authService.canDeleteDelivrance();
  }

  /* ---------- DONNÉES ---------- */
getDelivrances() {
  this.loadingIndicator.set(true);
  
  this.delivranceService.getAll().subscribe({
    next: (delivrances: Delivrance[]) => {
      console.log('✅ Délivrances chargées:', delivrances);
      
      // Formater les dates
      const formattedDelivrances = delivrances.map(d => ({
        ...d,
        dateHeureDelivrance: d.dateHeureDelivrance ? new Date(d.dateHeureDelivrance) : new Date(),
        produitsSanguins: d.produitsSanguins || []
      }));
      
      // Appliquer le filtre selon les permissions
      const filteredDelivrances = this.authService.filterDelivrancesByPermission(formattedDelivrances);
      
      console.log('🔍 Délivrances après filtrage:', {
        formattedDelivrances,
        delivrances,
        total: formattedDelivrances.length,
        filtrees: filteredDelivrances.length
      });
      
      this.delivrances.set(filteredDelivrances);
      this.dataSource.data = filteredDelivrances;
      this.loadingIndicator.set(false);
    },
    error: (error) => {
      console.error('❌ Erreur chargement délivrances:', error);
      this.loadingIndicator.set(false);
      alert('Erreur lors du chargement des délivrances: ' + error.message);
    }
  });
}

refreshDelivrances() {
  this.getDelivrances();
}

  getDemandesValidees() {
    this.demandeService.getDemandesByStatut('VALIDÉE').subscribe({
      next: (demandes: Demande[]) => {
        this.demandesValidees.set(demandes);
        console.log('📋 Demandes validées:', demandes.length);
      },
      error: (error) => {
        console.error('❌ Erreur demandes validées:', error);
        this.demandesValidees.set([]);
      }
    });
  }

  getProduitsDisponibles() {
    this.produitSanguinService.getByEtat('DISPONIBLE').subscribe({
      next: (produits: ProduitSanguin[]) => {
        this.produitsDisponibles.set(produits);
        console.log('🧪 Produits disponibles:', produits.length);
      },
      error: (error) => {
        console.error('❌ Erreur produits disponibles:', error);
        this.produitsDisponibles.set([]);
      }
    });
  }

  /* ---------- LOGIQUE DE FILTRAGE ---------- */
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
    return this.getDemandesFiltrees().filter(d => 
      this.getProduitsCompatibles(d).length > 0
    );
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

  /* ---------- MODALES ---------- */
  openDelivranceModal(template: TemplateRef<any>) {
    // Vérification des permissions
    if (!this.authService.canCreateDelivrance()) {
      alert('❌ Vous n\'avez pas les droits pour créer des délivrances');
      return;
    }

    this.selectedDemande.set(null);
    this.selectedProduits.set([]);
    this.step.set(1);
    this.modalRef.set(
      this.modalService.show(template, { 
        class: 'modal-xl', 
        ignoreBackdropClick: true,
        backdrop: 'static'
      })
    );
  }

  closeModal() {
    this.modalRef()?.hide();
    this.selectedDemande.set(null);
    this.selectedProduits.set([]);
    this.step.set(1);
    this.searchTerm.set('');
    this.produitSearchTerm.set('');
  }

  /* ---------- LOGIQUE MÉTIER ---------- */
  selectDemandeInModal(demande: Demande) {
    const compatibles = this.getProduitsCompatibles(demande);
    if (compatibles.length === 0) {
      alert(`Aucun produit compatible disponible pour le patient ${demande.groupeSanguinPatient}`);
      return;
    }
    
    console.log('✅ Demande sélectionnée:', {
      patient: `${demande.patientPrenom} ${demande.patientNom}`,
      groupe: demande.groupeSanguinPatient,
      produitsCompatibles: compatibles.length
    });
    
    this.selectedDemande.set(demande);
    this.selectedProduits.set([]);
    this.step.set(2);
  }

  toggleProduitSelection(produit: ProduitSanguin) {
    // Vérification péremption
    if (!this.estProduitNonPerime(produit)) {
      alert(`Le produit ${produit.codeProduit} est périmé (${this.formatDateForDisplay(produit.datePeremption)})`);
      return;
    }

    // Vérification compatibilité
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
    
    console.log('🎯 Produit sélectionné:', {
      produit: produit.codeProduit,
      groupe: produit.groupeSanguin + (produit.rhesus || '+'),
      selectionnes: this.selectedProduits().length
    });
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

    // Tableau de compatibilité sanguine
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

    // Normaliser le groupe sanguin du produit
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

  /* ---------- CRÉATION DE DÉLIVRANCE ---------- */
  creerDelivrance() {
    // Vérification des permissions
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

    // Validation finale
    const produitsPerimes = produits.filter(p => !this.estProduitNonPerime(p));
    if (produitsPerimes.length > 0) {
      alert(`Certains produits sont périmés. Veuillez les désélectionner.`);
      return;
    }

    // Récupérer l'utilisateur connecté
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      alert('Veuillez vous connecter pour créer une délivrance');
      return;
    }

    // Préparer la requête
    const request: CreerDelivranceData = {
      demandeId: Number(demande.id),
      produitIds: produits.map(p => Number(p.id)),
      personnelId: Number(currentUser.id),
      destination: demande.serviceDemandeur || 'Service non spécifié',
      modeTransport: 'Transport interne',
      observations: `Délivrance pour ${demande.patientPrenom} ${demande.patientNom} - ${demande.serviceDemandeur}`
    };

    console.log('📦 Envoi création délivrance:', request);
    
    this.savingIndicator.set(true);
    this.delivranceService.creerDelivrance(request).subscribe({
      next: (delivrance: Delivrance) => {
        console.log('✅ Délivrance créée:', delivrance);
        this.savingIndicator.set(false);
        
        // Mettre à jour la liste
        this.delivrances.update(list => [delivrance, ...list]);
        this.dataSource.data = this.delivrances();
        
        // Recharger les données
        this.getDemandesValidees();
        this.getProduitsDisponibles();
        
        // Fermer la modale et afficher message
        this.closeModal();
        alert('Délivrance créée avec succès !');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur création délivrance:', error);
        
        let messageErreur = 'Erreur lors de la création de la délivrance';
        if (error.error?.erreur) {
          messageErreur = error.error.erreur;
        } else if (error.error?.message) {
          messageErreur = error.error.message;
        } else if (error.message) {
          messageErreur = error.message;
        }
        
        alert(messageErreur);
      }
    });
  }

  /* ---------- GESTION DES DÉLIVRANCES ---------- */
  deleteDelivrance(delivrance: Delivrance) {
    // Vérification des permissions
    if (!this.authService.canDeleteDelivrance()) {
      alert('❌ Vous n\'avez pas les droits pour supprimer des délivrances');
      return;
    }
    
    if (!delivrance.id) {
      alert('Délivrance invalide');
      return;
    }
    
    const confirmation = confirm(
      `Êtes-vous sûr de vouloir supprimer la délivrance pour ${delivrance.demande?.patientPrenom} ${delivrance.demande?.patientNom} ?\n\n` +
      `Cette action est irréversible et libérera les produits associés.`
    );
    
    if (!confirmation) return;
    
    this.delivranceService.delete(delivrance.id).subscribe({
      next: (response: any) => {
        console.log('✅ Délivrance supprimée:', response);
        
        // Mettre à jour la liste
        this.delivrances.update(list => list.filter(d => d.id !== delivrance.id));
        this.dataSource.data = this.delivrances();
        
        // Recharger les données
        this.getDemandesValidees();
        this.getProduitsDisponibles();
        
        alert('Délivrance supprimée avec succès');
      },
      error: (error) => {
        console.error('❌ Erreur suppression délivrance:', error);
        alert('Erreur lors de la suppression de la délivrance');
      }
    });
  }

  /**
   * Modifier une délivrance existante
   */
  modifierDelivrance(delivrance: Delivrance) {
    // Vérification des permissions
    if (!this.authService.canUpdateDelivrance(delivrance)) {
      alert('❌ Vous n\'avez pas les droits pour modifier cette délivrance');
      return;
    }
    
    console.log('📝 Modification de la délivrance:', delivrance);
    
    // TODO: Implémenter la modal de modification
    // this.openEditDelivranceModal(delivrance);
    
    alert('Fonctionnalité de modification à implémenter');
  }

  /* ---------- DÉTAILS ET IMPRESSION ---------- */
  voirDetailsDelivrance(delivrance: Delivrance) {
    this.selectedDelivranceForDetails.set(delivrance);
    this.detailsModalRef.set(
      this.modalService.show(this.detailsModalTemplate, { 
        class: 'modal-xl',
        ignoreBackdropClick: true,
        backdrop: 'static'
      })
    );
  }

  closeDetailsModal() {
    this.detailsModalRef()?.hide();
    this.selectedDelivranceForDetails.set(null);
  }

  creerTransfusionDepuisDelivrance(delivrance: Delivrance) {
    // Vérification des permissions
    if (!this.authService.canCreateTransfusion()) {
      alert('❌ Vous n\'avez pas les droits pour créer des transfusions');
      return;
    }
    
    if (!delivrance || !delivrance.id) {
      alert('Délivrance invalide');
      return;
    }

    // Vérifier que la délivrance a des produits
    if (!delivrance.produitsSanguins || delivrance.produitsSanguins.length === 0) {
      alert('Cette délivrance ne contient aucun produit');
      return;
    }

    // Stocker les informations nécessaires
    const delivranceData = {
      id: delivrance.id,
      patientNom: delivrance.demande?.patientNom,
      patientPrenom: delivrance.demande?.patientPrenom,
      patientNumDossier: delivrance.demande?.patientNumDossier,
      patientDateNaissance: delivrance.demande?.patientDateNaissance,
      groupeSanguinPatient: delivrance.demande?.groupeSanguinPatient,
      serviceDemandeur: delivrance.demande?.serviceDemandeur,
      produitsSanguins: delivrance.produitsSanguins
    };

    localStorage.setItem('selectedDelivranceForTransfusion', JSON.stringify(delivranceData));
    
    // Naviguer vers la page de création de transfusion
    this.router.navigate(['/app/transfusions/creer']);
  }

  creerTransfusionDepuisDetails() {
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

  imprimerDetails() {
    window.print();
  }

  /* ---------- UTILITAIRES ---------- */
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
    
    const groupesUniques = [...new Set(groupes)];
    return groupesUniques.join(', ') || 'N/A';
  }

  exportToExcel() {
    // Vérifier qu'il y a des données à exporter
    if (this.delivrances().length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    const data = this.delivrances().map(d => ({
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

      // Ajuster les largeurs de colonnes
      const colWidths = [
        { wch: 8 },   // ID
        { wch: 20 },  // Patient
        { wch: 15 },  // Groupe Sanguin
        { wch: 20 },  // Service
        { wch: 25 },  // Produits
        { wch: 20 },  // Date Délivrance
        { wch: 20 },  // Destination
        { wch: 15 },  // Transport
        { wch: 20 },  // Personnel
        { wch: 30 }   // Observations
      ];
      ws['!cols'] = colWidths;

      const excelBuffer: any = XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array' 
      });
      
      const file = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const fileName = `delivrances_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(file, fileName);
      
      console.log('✅ Fichier exporté:', fileName);
    } catch (error) {
      console.error('❌ Erreur export Excel:', error);
      alert('Erreur lors de l\'export Excel');
    }
  }

  private formatDateForDisplay(dateInput: string | Date): string {
    if (!dateInput) return 'N/A';
    
    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      
      if (isNaN(date.getTime())) {
        return String(dateInput);
      }
      
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(dateInput);
    }
  }

  /* ---------- ÉVÉNEMENTS ---------- */
  onSearchTermChange(event: any) {
    this.searchTerm.set(event.target.value);
  }

  onProduitSearchTermChange(event: any) {
    this.produitSearchTerm.set(event.target.value);
  }


}