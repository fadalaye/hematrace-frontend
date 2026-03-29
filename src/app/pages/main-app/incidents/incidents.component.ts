import { Component, inject, signal, TemplateRef, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { 
  MatTableModule, 
  MatTableDataSource 
} from '@angular/material/table';
import { 
  MatPaginatorModule, 
  MatPaginator 
} from '@angular/material/paginator';
import { 
  MatSortModule, 
  MatSort 
} from '@angular/material/sort';
import { 
  MatFormFieldModule 
} from '@angular/material/form-field';
import { 
  MatInputModule 
} from '@angular/material/input';
import { 
  MatButtonModule 
} from '@angular/material/button';
import { 
  MatIconModule 
} from '@angular/material/icon';
import { 
  MatChipsModule 
} from '@angular/material/chips';
import { 
  MatTooltipModule 
} from '@angular/material/tooltip';
import { 
  MatProgressSpinnerModule 
} from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ModalModule, BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Interfaces et services
import { IncidentTransfusionnel } from '../../../interfaces/incident-transfusionnel.interface';
import { CreerIncidentRequest, IncidentTransfusionnelService, StatistiquesIncident } from '../../../services/Incident-transfusionnel.service';
import { EditIncidentComponent } from "./components/edit-incident/edit-incident.component";
import { AuthService, getUserType } from '../../../services/auth.service'; // 🔥 IMPORT getUserType
import { RouterOutlet } from "@angular/router";

interface StatutOption {
  value: string;
  label: string;
  icon: string;
}

interface TypeProduitOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-incidents',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
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
    MatDatepickerModule,
    MatNativeDateModule,
    ModalModule,
    EditIncidentComponent,
    RouterOutlet
],
  templateUrl: './incidents.component.html',
  styleUrl: './incidents.component.scss'
})
export class IncidentsComponent implements OnInit, AfterViewInit {
  // Services
  private modalService = inject(BsModalService);
  private incidentService = inject(IncidentTransfusionnelService);
  public authService = inject(AuthService); // IMPORTANT: public pour le template

  // États
  private allIncidents = signal<IncidentTransfusionnel[]>([]); // Données brutes filtrées par permission
  incidents = signal<IncidentTransfusionnel[]>([]); // Données après filtres UI
  loadingIndicator = signal<boolean>(false);
  savingIndicator = signal<boolean>(false);
  modalRef = signal<BsModalRef | null>(null);
  selectedIncident = signal<IncidentTransfusionnel | null>(null);
  searchTerm = signal<string>('');
  selectedStatut = signal<string>('TOUS');
  selectedTypeProduit = signal<string>('TOUS');
  startDate = signal<Date | null>(null);
  endDate = signal<Date | null>(null);

  // Options de filtre
  statutOptions: StatutOption[] = [
    { value: 'TOUS', label: 'Tous les statuts', icon: 'list' },
    { value: 'NON_VALIDE', label: 'Non validés', icon: 'schedule' },
    { value: 'VALIDE', label: 'Validés', icon: 'check_circle' }
  ];

  typeProduitOptions: TypeProduitOption[] = [
    { value: 'TOUS', label: 'Tous les types' },
    { value: 'CGR', label: 'CGR (Concentré de Globules Rouges)' },
    { value: 'CPP', label: 'CPP (Concentré de Plaquettes)' },
    { value: 'PFC', label: 'PFC (Plasma Frais Congelé)' },
    { value: 'CGL', label: 'CGL (Concentré de Globules Leucoplaquettaires)' },
    { value: 'OTHER', label: 'Autre produit' }
  ];

  // Table Material
  displayedColumns: string[] = [
    'dateIncident',
    'patientNom',
    'patientPrenom', 
    'patientNumDossier',
    'typeProduitTransfuse',
    'lieuIncident',
    'statut',
    'dateHeureDeclaration',
    'info',
    'actions'
  ];
  dataSource = new MatTableDataSource<IncidentTransfusionnel>([]);
  
  // Statistiques
  statistiques = signal<StatistiquesIncident | null>(null);
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  /* ---------- LIFECYCLE ---------- */
  ngOnInit() {
    this.getIncidents();
    this.getStatistiques();
    this.initializeUserPermissions();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /* ---------- PERMISSIONS ---------- */
  private initializeUserPermissions(): void {
    const user = this.authService.getCurrentUser();
    console.log('👤 Permissions utilisateur pour incidents:', {
      user: user ? {
        id: user.id,
        // 🔥 CORRECTION: Utiliser la fonction importée directement
        type: getUserType(user),
        nom: `${user.prenom} ${user.nom}`,
        medecinId: user.id,
        personnelId: user.id
      } : 'Non connecté',
      estPersonnel: this.authService.isPersonnel(),
      estMedecin: this.authService.isMedecin(),
      estSuperUser: this.authService.isSuperUser(),
      peutCreerIncident: this.authService.canCreateIncident(),
      peutModifierIncident: this.authService.canUpdateIncident(),
      peutValiderIncident: this.authService.canValidateIncident(),
      peutSupprimerIncident: this.authService.canDeleteIncident(),
      peutVoirIncidents: this.authService.canViewIncidents()
    });
  }

  canCreateIncident(): boolean {
    return this.authService.canCreateIncident();
  }

  canUpdateIncident(): boolean {
    return this.authService.canUpdateIncident();
  }

  canDeleteIncident(): boolean {
    return this.authService.canDeleteIncident();
  }

  canValidateIncident(): boolean {
    return this.authService.canValidateIncident();
  }

  canEditIncident(incident: IncidentTransfusionnel): boolean {
    // Seuls les incidents non validés peuvent être modifiés
    return incident.dateValidation == null && this.authService.canUpdateIncident();
  }

  /* ---------- DONNÉES ---------- */
  /**
   * Charge la liste des incidents avec filtrage par permission
   */
  getIncidents() {
    this.loadingIndicator.set(true);
    
    this.incidentService.getAll().subscribe({
      next: (incidents) => {
        console.log('📦 Nombre d\'incidents bruts:', incidents?.length);
        
        // 🔥 APPLIQUER LE FILTRE DE PERMISSION
        const incidentsAvecPermission = this.authService.filterIncidentsByPermission(incidents || []);
        
        console.log('🔍 Filtrage par permission:', {
          totalBrut: incidents?.length || 0,
          totalFiltre: incidentsAvecPermission.length,
          utilisateur: this.authService.getCurrentUser()?.prenom + ' ' + this.authService.getCurrentUser()?.nom,
          // 🔥 CORRECTION: Utiliser la fonction importée
          role: this.authService.getCurrentUser() ? 
            getUserType(this.authService.getCurrentUser()!) : 'Non connecté'
        });
        
        this.allIncidents.set(incidentsAvecPermission);
        this.incidents.set(incidentsAvecPermission);
        this.dataSource.data = incidentsAvecPermission;
        this.applyFilters();
        this.loadingIndicator.set(false);
      },
      error: (error) => {
        console.error('❌ Erreur chargement incidents:', error);
        this.loadingIndicator.set(false);
      }
    });
  }

  /**
   * Rafraîchit les données en réappliquant le filtre de permission
   */
  refreshIncidents() {
    console.log('🔄 Rafraîchissement des incidents avec filtre de permission');
    this.getIncidents();
  }

  /**
   * Charge les statistiques
   */
  getStatistiques() {
    this.incidentService.getStatistiquesGlobales().subscribe({
      next: (stats) => {
        this.statistiques.set(stats);
        console.log('📊 Statistiques chargées:', stats);
      },
      error: (error) => {
        console.error('❌ Erreur chargement statistiques:', error);
      }
    });
  }

  /* ---------- FILTRES UI ---------- */
  /**
   * Applique tous les filtres UI (recherche, statut, type, dates)
   */
  applyFilters() {
    const searchTerm = this.searchTerm().toLowerCase();
    const selectedStatut = this.selectedStatut();
    const selectedTypeProduit = this.selectedTypeProduit();
    const startDate = this.startDate();
    const endDate = this.endDate();

    let filteredData = this.allIncidents(); // Filtrer depuis les données déjà filtrées par permission

    // Filtre par recherche
    if (searchTerm) {
      filteredData = filteredData.filter((item) =>
        item.patientNom?.toLowerCase().includes(searchTerm) ||
        item.patientPrenom?.toLowerCase().includes(searchTerm) ||
        item.patientNumDossier?.toLowerCase().includes(searchTerm) ||
        item.typeProduitTransfuse?.toLowerCase().includes(searchTerm) ||
        item.lieuIncident?.toLowerCase().includes(searchTerm) ||
        item.numeroLotProduit?.toLowerCase().includes(searchTerm)
      );
    }

    // Filtre par statut
    if (selectedStatut !== 'TOUS') {
      filteredData = filteredData.filter((item) => {
        if (selectedStatut === 'VALIDE') {
          return item.dateValidation != null;
        } else if (selectedStatut === 'NON_VALIDE') {
          return item.dateValidation == null;
        }
        return true;
      });
    }

    // Filtre par type de produit
    if (selectedTypeProduit !== 'TOUS') {
      filteredData = filteredData.filter((item) => 
        item.typeProduitTransfuse?.toLowerCase().includes(selectedTypeProduit.toLowerCase())
      );
    }

    // Filtre par date
    if (startDate) {
      filteredData = filteredData.filter((item) => {
        const incidentDate = new Date(item.dateIncident);
        return incidentDate >= startDate;
      });
    }

    if (endDate) {
      filteredData = filteredData.filter((item) => {
        const incidentDate = new Date(item.dateIncident);
        return incidentDate <= endDate;
      });
    }

    this.incidents.set(filteredData);
    this.dataSource.data = filteredData;
    
    // Reset pagination
    setTimeout(() => {
      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    });
  }

  onStatutFilterChange(event: any) {
    const statut = event.value;
    this.selectedStatut.set(statut);
    this.applyFilters();
  }

  onTypeProduitFilterChange(event: any) {
    const typeProduit = event.value;
    this.selectedTypeProduit.set(typeProduit);
    this.applyFilters();
  }

  onStartDateChange(date: Date) {
    this.startDate.set(date);
    this.applyFilters();
  }

  onEndDateChange(date: Date) {
    this.endDate.set(date);
    this.applyFilters();
  }

  onFilterChange(event: any) {
    const term = event.target.value.toLowerCase();
    this.searchTerm.set(term);
    this.applyFilters();
  }

  resetFilters() {
    this.selectedStatut.set('TOUS');
    this.selectedTypeProduit.set('TOUS');
    this.searchTerm.set('');
    this.startDate.set(null);
    this.endDate.set(null);
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return (
      this.selectedStatut() !== 'TOUS' ||
      this.selectedTypeProduit() !== 'TOUS' ||
      this.searchTerm().length > 0 ||
      this.startDate() !== null ||
      this.endDate() !== null
    );
  }

  /* ---------- GESTION DES INCIDENTS ---------- */
  /**
   * Valide un incident
   */
  validerIncident(incident: IncidentTransfusionnel) {
    // Vérification des permissions
    if (!this.authService.canValidateIncident()) {
      alert('❌ Vous n\'avez pas les droits pour valider des incidents');
      return;
    }
    
    if (!incident.id) {
      console.error('❌ ID d\'incident manquant');
      return;
    }

    const signature = prompt('Veuillez entrer votre signature pour valider cet incident:');
    if (!signature) {
      alert('Validation annulée : signature requise');
      return;
    }

    const confirmation = confirm(
      `Êtes-vous sûr de vouloir valider cet incident ?\n\n` +
      `Patient: ${incident.patientPrenom} ${incident.patientNom}\n` +
      `Produit: ${incident.typeProduitTransfuse}\n` +
      `Date: ${incident.dateIncident}`
    );

    if (!confirmation) return;

    this.savingIndicator.set(true);

    this.incidentService.validerIncident(incident.id, signature).subscribe({
      next: () => {
        // Rafraîchir l'incident pour obtenir les données mises à jour
        this.incidentService.getById(incident.id!).subscribe({
          next: (incidentMiseAJour) => {
            this.mettreAJourListeIncidents(incidentMiseAJour);
            this.savingIndicator.set(false);
            this.getStatistiques();
            alert('Incident validé avec succès !');
          },
          error: (error) => {
            this.gestionErreurValidation(error);
          }
        });
      },
      error: (error) => {
        this.gestionErreurValidation(error);
      }
    });
  }

  /**
   * Mettre à jour la liste des incidents
   */
  private mettreAJourListeIncidents(incidentMiseAJour: IncidentTransfusionnel) {
    this.allIncidents.update(list => 
      list.map(i => i.id === incidentMiseAJour.id ? incidentMiseAJour : i)
    );
    this.incidents.update(list => 
      list.map(i => i.id === incidentMiseAJour.id ? incidentMiseAJour : i)
    );
    this.dataSource.data = this.incidents();
    
    if (this.selectedIncident()?.id === incidentMiseAJour.id) {
      this.selectedIncident.set(incidentMiseAJour);
    }
  }

  /**
   * Gestion des erreurs de validation
   */
  private gestionErreurValidation(error: any) {
    this.savingIndicator.set(false);
    console.error('❌ Erreur lors de la validation:', error);
    
    let errorMessage = 'Erreur lors de la validation de l\'incident';
    if (error.status === 0) {
      errorMessage += ' - Problème de connexion au serveur';
    } else if (error.error?.message) {
      errorMessage += `: ${error.error.message}`;
    } else if (error.message) {
      errorMessage += `: ${error.message}`;
    }
    alert(errorMessage);
  }

  /**
   * Supprime un incident
   */
  deleteIncident(incident: IncidentTransfusionnel) {
    // Vérification des permissions
    if (!this.authService.canDeleteIncident()) {
      alert('❌ Vous n\'avez pas les droits pour supprimer des incidents');
      return;
    }
    
    if (!incident.id) return;

    const confirmation = confirm(
      `Êtes-vous sûr de vouloir supprimer cet incident ?\n\n` +
      `Patient: ${incident.patientPrenom} ${incident.patientNom}\n` +
      `Date: ${incident.dateIncident}\n` +
      `Cette action est irréversible.`
    );

    if (!confirmation) return;

    this.savingIndicator.set(true);
      
    this.incidentService.delete(incident.id).subscribe({
      next: () => {
        this.savingIndicator.set(false);
        
        // Mise à jour optimiste
        this.allIncidents.update(list => list.filter(i => i.id !== incident.id));
        this.incidents.update(list => list.filter(i => i.id !== incident.id));
        this.dataSource.data = this.incidents();
        
        // Recharger pour être sûr d'avoir les dernières données filtrées
        this.getIncidents();
        this.getStatistiques();
        
        console.log('✅ Incident supprimé avec succès');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur suppression incident:', error);
        alert('Erreur lors de la suppression de l\'incident');
      }
    });
  }

  /* ---------- VISUEL ---------- */
  getStatutBadgeClass(incident: IncidentTransfusionnel): string {
    if (incident.dateValidation) {
      return 'badge bg-success';
    } else {
      return 'badge bg-warning text-dark';
    }
  }

  getStatutIcon(incident: IncidentTransfusionnel): string {
    if (incident.dateValidation) {
      return 'check_circle';
    } else {
      return 'schedule';
    }
  }

  getStatutLabel(incident: IncidentTransfusionnel): string {
    if (incident.dateValidation) {
      return 'VALIDÉ';
    } else {
      return 'EN ATTENTE';
    }
  }

  /**
   * Obtient le message d'information sur le filtrage par permission
   */
  getFilterInfoMessage(): string {
    const user = this.authService.getCurrentUser();
    if (!user) return 'Non connecté';
    
    // 🔥 CORRECTION: Utiliser la fonction importée directement
    const userType = getUserType(user);
    const total = this.allIncidents().length;
    const filtered = this.incidents().length;
    
    const messages: { [key: string]: string } = {
      'ADMIN': `👑 Administrateur - Tous les incidents (${filtered}/${total})`,
      'CHEF_SERVICE': `👑 Chef de service - Tous les incidents (${filtered}/${total})`,
      'MEDECIN': `👨‍⚕️ Médecin - Incidents de vos patients (${filtered}/${total})`,
      'PERSONNEL': `👥 Personnel - ${this.authService.hasPermission('QUALITY_INCIDENT_MANAGEMENT') ? 
        `Tous les incidents (${filtered}/${total})` : 
        `Incidents de votre service (${filtered}/${total})`}`
    };
    
    return messages[userType] || `Affichage de ${filtered} incident(s) sur ${total}`;
  }

  /* ---------- EXPORT ---------- */
  exportToExcel() {
    const data = this.incidents().map(i => ({
      'Date Incident': i.dateIncident,
      'Heure Incident': i.heureIncident,
      'Patient': `${i.patientPrenom} ${i.patientNom}`,
      'Date Naissance': i.patientDateNaissance,
      'N° Dossier': i.patientNumDossier,
      'Type Produit': i.typeProduitTransfuse,
      'N° Lot': i.numeroLotProduit,
      'Date Péremption': i.datePeremptionProduit,
      'Lieu Incident': i.lieuIncident,
      'Description': i.descriptionIncident || 'N/A',
      'Signes': i.signes || 'N/A',
      'Symptômes': i.symptomes || 'N/A',
      'Actions Immédiates': i.actionsImmediates || 'N/A',
      'Déclarant': i.nomDeclarant,
      'Fonction Déclarant': i.fonctionDeclarant,
      'Date Déclaration': i.dateHeureDeclaration,
      'Statut': i.dateValidation ? 'VALIDÉ' : 'EN ATTENTE',
      'Date Validation': i.dateValidation || 'N/A',
      'Analyse Préliminaire': i.analysePreliminaire || 'N/A',
      'Actions Correctives': i.actionsCorrectives || 'N/A'
    }));

    if (data.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    try {
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = { 
        Sheets: { 'Incidents': ws }, 
        SheetNames: ['Incidents'] 
      };
      
      const excelBuffer: any = XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array'
      });
      
      const file = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const fileName = `incidents_transfusionnels_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(file, fileName);
      
      console.log('✅ Fichier exporté:', fileName);
    } catch (error) {
      console.error('❌ Erreur export Excel:', error);
      alert('Erreur lors de l\'export Excel');
    }
  }

  exportIncidentPDF(incident: IncidentTransfusionnel) {
    if (!incident.id) return;

    this.savingIndicator.set(true);

    this.incidentService.telechargerRapportPDF(incident.id).subscribe({
      next: (blob) => {
        this.savingIndicator.set(false);
        const fileName = `incident_${incident.id}_${incident.patientNom}_${incident.dateIncident}.pdf`;
        saveAs(blob, fileName);
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur téléchargement PDF:', error);
        alert('Erreur lors du téléchargement du PDF');
      }
    });
  }

  /* ---------- MODALES ---------- */
  openIncidentFormModal(template: TemplateRef<any>, incident?: IncidentTransfusionnel) {
    // Vérification des permissions pour la création
    if (!incident && !this.authService.canCreateIncident()) {
      alert('❌ Vous n\'avez pas les droits pour déclarer des incidents');
      return;
    }
    
    // Vérification des permissions pour la modification
    if (incident && !this.authService.canUpdateIncident()) {
      alert('❌ Vous n\'avez pas les droits pour modifier cet incident');
      return;
    }
    
    this.selectedIncident.set(incident || null);
    this.modalRef.set(this.modalService.show(template, { 
      class: 'modal-xl',
      ignoreBackdropClick: true,
      keyboard: false
    }));
  }

  openInfoModal(template: TemplateRef<any>, incident: IncidentTransfusionnel) {
    this.selectedIncident.set(incident);
    this.modalRef.set(this.modalService.show(template, { 
      class: 'modal-xl',
      ignoreBackdropClick: true,
      keyboard: false
    }));
  }

  closeIncidentModal() {
    this.modalRef()?.hide();
    this.selectedIncident.set(null);
  }

  /* ---------- CRUD ---------- */
  addIncident(incidentData: CreerIncidentRequest) {
    // Vérification des permissions
    if (!this.authService.canCreateIncident()) {
      alert('❌ Vous n\'avez pas les droits pour déclarer des incidents');
      return;
    }

    this.savingIndicator.set(true);

    // Validation des données obligatoires
    const validation = this.incidentService.verifierDonneesObligatoires(incidentData);
    if (!validation.valide) {
      this.savingIndicator.set(false);
      alert('Données incomplètes:\n' + validation.erreurs.join('\n'));
      return;
    }

    this.incidentService.create(incidentData).subscribe({
      next: (newIncident) => {
        this.savingIndicator.set(false);
        
        // 🔥 IMPORTANT: Recharger toutes les données pour appliquer le filtre
        this.getIncidents();
        this.getStatistiques();
        
        this.closeIncidentModal();
        console.log('✅ Incident ajouté avec succès:', newIncident);
        alert('Incident déclaré avec succès !');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur lors de l\'ajout:', error);
        alert('Erreur lors de la déclaration de l\'incident: ' + error.message);
      }
    });
  }

  updateIncident(incident: IncidentTransfusionnel) {
    // Vérification des permissions
    if (!this.authService.canUpdateIncident()) {
      alert('❌ Vous n\'avez pas les droits pour modifier cet incident');
      return;
    }

    this.savingIndicator.set(true);
    
    if (!incident.id) {
      console.error('❌ Impossible de modifier: ID manquant');
      this.savingIndicator.set(false);
      return;
    }

    this.incidentService.update(incident.id, incident).subscribe({
      next: (updatedIncident) => {
        this.savingIndicator.set(false);
        
        // 🔥 Recharger toutes les données pour appliquer le filtre
        this.getIncidents();
        this.getStatistiques();
        
        this.closeIncidentModal();
        console.log('✅ Incident modifié avec succès:', updatedIncident);
        alert('Incident modifié avec succès !');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur lors de la modification:', error);
        alert('Erreur lors de la modification de l\'incident');
      }
    });
  }

  /* ---------- UTILITAIRES ---------- */
  getFilteredCount(): number {
    return this.incidents().length;
  }

  getTotalCount(): number {
    return this.allIncidents().length;
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

  formatDateTime(dateTimeString: string): string {
    if (!dateTimeString) return 'N/A';
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString('fr-FR');
    } catch {
      return dateTimeString;
    }
  }
}