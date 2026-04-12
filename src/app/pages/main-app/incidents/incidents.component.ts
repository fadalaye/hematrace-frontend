import {
  Component,
  inject,
  signal,
  TemplateRef,
  ViewChild,
  AfterViewInit,
  OnInit,
  computed
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ModalModule, BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

import { IncidentTransfusionnel } from '../../../interfaces/incident-transfusionnel.interface';
import {
  CreerIncidentRequest,
  IncidentTransfusionnelService,
  StatistiquesIncident
} from '../../../services/Incident-transfusionnel.service';
import { EditIncidentComponent } from './components/edit-incident/edit-incident.component';
import { AuthService } from '../../../services/auth.service';
import { getUserType } from '../../../interfaces/any-utilisateur.interface';
import { RouterOutlet } from '@angular/router';

interface StatutOption {
  value: string;
  label: string;
  icon: string;
}

interface TypeProduitOption {
  value: string;
  label: string;
}

interface GraviteOption {
  value: string;
  label: string;
  icon: string;
}

interface ViewModeOption {
  value: IncidentViewMode;
  label: string;
  icon: string;
}

type IncidentViewMode = 'table' | 'cards' | 'timeline';

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
  private modalService = inject(BsModalService);
  private incidentService = inject(IncidentTransfusionnelService);
  public authService = inject(AuthService);

  private allIncidents = signal<IncidentTransfusionnel[]>([]);
  incidents = signal<IncidentTransfusionnel[]>([]);
  loadingIndicator = signal<boolean>(false);
  savingIndicator = signal<boolean>(false);
  modalRef = signal<BsModalRef | null>(null);
  selectedIncident = signal<IncidentTransfusionnel | null>(null);

  searchTerm = signal<string>('');
  selectedStatut = signal<string>('TOUS');
  selectedTypeProduit = signal<string>('TOUS');
  selectedGravite = signal<string>('TOUTES');
  selectedLieu = signal<string>('TOUS');
  startDate = signal<Date | null>(null);
  endDate = signal<Date | null>(null);
  viewMode = signal<IncidentViewMode>('table');

  statistiques = signal<StatistiquesIncident | null>(null);

  statutOptions: StatutOption[] = [
    { value: 'TOUS', label: 'Tous les statuts', icon: 'list' },
    { value: 'NON_VALIDE', label: 'Non validés', icon: 'schedule' },
    { value: 'VALIDE', label: 'Validés', icon: 'check_circle' }
  ];

  typeProduitOptions: TypeProduitOption[] = [
    { value: 'TOUS', label: 'Tous les types' },
    { value: 'CGR', label: 'CGR' },
    { value: 'CPP', label: 'CPP' },
    { value: 'PFC', label: 'PFC' },
    { value: 'CGL', label: 'CGL' },
    { value: 'OTHER', label: 'Autre produit' }
  ];

  graviteOptions: GraviteOption[] = [
    { value: 'TOUTES', label: 'Toutes les gravités', icon: 'filter_alt' },
    { value: 'MINEURE', label: 'Mineure', icon: 'info' },
    { value: 'MODEREE', label: 'Modérée', icon: 'report' },
    { value: 'SEVERE', label: 'Sévère', icon: 'warning' },
    { value: 'CRITIQUE', label: 'Critique', icon: 'dangerous' }
  ];

  viewModeOptions: ViewModeOption[] = [
    { value: 'table', label: 'Tableau', icon: 'table_rows' },
    { value: 'cards', label: 'Cartes', icon: 'view_module' },
    { value: 'timeline', label: 'Timeline', icon: 'timeline' }
  ];

  displayedColumns: string[] = [
    'dateIncident',
    'patientNom',
    'patientPrenom',
    'patientNumDossier',
    'typeProduitTransfuse',
    'lieuIncident',
    'gravite',
    'statut',
    'dateHeureDeclaration',
    'info',
    'actions'
  ];

  dataSource = new MatTableDataSource<IncidentTransfusionnel>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // ========= COMPUTED =========
  lieuxDisponibles = computed(() => {
    const lieux = this.allIncidents()
      .map(i => i.lieuIncident)
      .filter((x): x is string => !!x && x.trim().length > 0);
    return Array.from(new Set(lieux)).sort();
  });

  incidentsTriesParDate = computed(() => {
    return [...this.incidents()].sort((a, b) => {
      const da = new Date(a.dateIncident as any).getTime();
      const db = new Date(b.dateIncident as any).getTime();
      return db - da;
    });
  });

  // ========= LIFECYCLE =========
  ngOnInit() {
    this.getIncidents();
    this.getStatistiques();
    this.initializeUserPermissions();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  // ========= PERMISSIONS =========
  private initializeUserPermissions(): void {
    const user = this.authService.getCurrentUser();
    console.log('👤 Permissions utilisateur pour incidents:', {
      user: user ? {
        id: user.id,
        type: getUserType(user),
        nom: `${user.prenom} ${user.nom}`
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

  canEditIncident(incident: IncidentTransfusionnel): boolean {
    return incident.dateValidation == null && this.authService.canUpdateIncident();
  }

  // ========= VUES =========
  setViewMode(mode: IncidentViewMode): void {
    this.viewMode.set(mode);
  }

  getViewMode(): IncidentViewMode {
    return this.viewMode();
  }

  // ========= DONNÉES =========
  getIncidents() {
    this.loadingIndicator.set(true);

    this.incidentService.getAll().subscribe({
      next: (incidents) => {
        const incidentsAvecPermission = this.authService.filterIncidentsByPermission(incidents || []);
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

  refreshIncidents() {
    this.getIncidents();
    this.getStatistiques();
  }

  getStatistiques() {
    this.incidentService.getStatistiquesGlobales().subscribe({
      next: (stats) => {
        this.statistiques.set(stats);
      },
      error: (error) => {
        console.error('❌ Erreur chargement statistiques:', error);
      }
    });
  }

  // ========= FILTRES =========
  applyFilters() {
    const searchTerm = this.searchTerm().toLowerCase().trim();
    const selectedStatut = this.selectedStatut();
    const selectedTypeProduit = this.selectedTypeProduit();
    const selectedGravite = this.selectedGravite();
    const selectedLieu = this.selectedLieu();
    const startDate = this.startDate();
    const endDate = this.endDate();

    let filteredData = this.allIncidents();

    if (searchTerm) {
      filteredData = filteredData.filter((item) =>
        (item.patientNom || '').toLowerCase().includes(searchTerm) ||
        (item.patientPrenom || '').toLowerCase().includes(searchTerm) ||
        (item.patientNumDossier || '').toLowerCase().includes(searchTerm) ||
        (item.typeProduitTransfuse || '').toLowerCase().includes(searchTerm) ||
        (item.lieuIncident || '').toLowerCase().includes(searchTerm) ||
        (item.numeroLotProduit || '').toLowerCase().includes(searchTerm) ||
        (item.descriptionIncident || '').toLowerCase().includes(searchTerm) ||
        (item.signes || '').toLowerCase().includes(searchTerm) ||
        (item.symptomes || '').toLowerCase().includes(searchTerm) ||
        (this.getTransfusionReference(item) || '').toLowerCase().includes(searchTerm)
      );
    }

    if (selectedStatut !== 'TOUS') {
      filteredData = filteredData.filter((item) => {
        if (selectedStatut === 'VALIDE') return item.dateValidation != null;
        if (selectedStatut === 'NON_VALIDE') return item.dateValidation == null;
        return true;
      });
    }

    if (selectedTypeProduit !== 'TOUS') {
      filteredData = filteredData.filter((item) =>
        (item.typeProduitTransfuse || '').toLowerCase().includes(selectedTypeProduit.toLowerCase())
      );
    }

    if (selectedGravite !== 'TOUTES') {
      filteredData = filteredData.filter((item) =>
        this.getGraviteValue(item) === selectedGravite
      );
    }

    if (selectedLieu !== 'TOUS') {
      filteredData = filteredData.filter((item) => item.lieuIncident === selectedLieu);
    }

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filteredData = filteredData.filter((item) => new Date(item.dateIncident as any) >= start);
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filteredData = filteredData.filter((item) => new Date(item.dateIncident as any) <= end);
    }

    this.incidents.set(filteredData);
    this.dataSource.data = filteredData;

    setTimeout(() => {
      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    });
  }

  onStatutFilterChange(event: any) {
    this.selectedStatut.set(event.value);
    this.applyFilters();
  }

  onTypeProduitFilterChange(event: any) {
    this.selectedTypeProduit.set(event.value);
    this.applyFilters();
  }

  onGraviteFilterChange(event: any) {
    this.selectedGravite.set(event.value);
    this.applyFilters();
  }

  onLieuFilterChange(event: any) {
    this.selectedLieu.set(event.value);
    this.applyFilters();
  }

  onStartDateChange(date: Date | null) {
    this.startDate.set(date);
    this.applyFilters();
  }

  onEndDateChange(date: Date | null) {
    this.endDate.set(date);
    this.applyFilters();
  }

  onFilterChange(event: any) {
    this.searchTerm.set((event.target.value || '').toLowerCase());
    this.applyFilters();
  }

  resetFilters() {
    this.selectedStatut.set('TOUS');
    this.selectedTypeProduit.set('TOUS');
    this.selectedGravite.set('TOUTES');
    this.selectedLieu.set('TOUS');
    this.searchTerm.set('');
    this.startDate.set(null);
    this.endDate.set(null);
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return (
      this.selectedStatut() !== 'TOUS' ||
      this.selectedTypeProduit() !== 'TOUS' ||
      this.selectedGravite() !== 'TOUTES' ||
      this.selectedLieu() !== 'TOUS' ||
      this.searchTerm().length > 0 ||
      this.startDate() !== null ||
      this.endDate() !== null
    );
  }

  // ========= KPI =========
  getTotalCount(): number {
    return this.incidents().length;
  }

  getFilteredCount(): number {
    return this.incidents().length;
  }

  getValidatedCount(): number {
    return this.incidents().filter(i => i.dateValidation != null).length;
  }

  getPendingCount(): number {
    return this.incidents().filter(i => i.dateValidation == null).length;
  }

  getGraveCount(): number {
    return this.incidents().filter(i => {
      const gravite = this.getGraviteValue(i);
      return gravite === 'SEVERE' || gravite === 'CRITIQUE';
    }).length;
  }

  getThisMonthCount(): number {
    const now = new Date();
    return this.incidents().filter(i => {
      const d = new Date(i.dateIncident as any);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }

  getIncidentsAvecLienTransfusionCount(): number {
    return this.incidents().filter(i => !!this.getTransfusionId(i)).length;
  }

  // ========= AIDES MÉTIER / LIAISONS =========
  getGraviteValue(incident: IncidentTransfusionnel): string {
    const asAny = incident as any;
    const raw = (asAny.gravite || asAny.graviteEffet || '').toString().trim().toUpperCase();

    if (!raw) return '';

    if (raw.includes('CRIT')) return 'CRITIQUE';
    if (raw.includes('SEV') || raw.includes('SÉV')) return 'SEVERE';
    if (raw.includes('MOD')) return 'MODEREE';
    if (raw.includes('MIN')) return 'MINEURE';

    return raw;
  }

  getGraviteLabel(incident: IncidentTransfusionnel): string {
    const g = this.getGraviteValue(incident);
    if (!g) return 'Non précisée';

    const labels: Record<string, string> = {
      MINEURE: 'Mineure',
      MODEREE: 'Modérée',
      SEVERE: 'Sévère',
      CRITIQUE: 'Critique'
    };

    return labels[g] || g;
  }

  getGraviteBadgeClass(incident: IncidentTransfusionnel): string {
    const g = this.getGraviteValue(incident);

    if (g === 'CRITIQUE') return 'badge bg-danger';
    if (g === 'SEVERE') return 'badge bg-danger';
    if (g === 'MODEREE') return 'badge bg-warning text-dark';
    if (g === 'MINEURE') return 'badge bg-info';

    return 'badge bg-secondary';
  }

  getGraviteIcon(incident: IncidentTransfusionnel): string {
    const g = this.getGraviteValue(incident);

    if (g === 'CRITIQUE') return 'dangerous';
    if (g === 'SEVERE') return 'warning';
    if (g === 'MODEREE') return 'report';
    if (g === 'MINEURE') return 'info';

    return 'help';
  }

  getTransfusionId(incident: IncidentTransfusionnel): number | null {
    const asAny = incident as any;
    return asAny.transfusionId ?? asAny.transfusion?.id ?? null;
  }

  getTransfusionReference(incident: IncidentTransfusionnel): string {
    const asAny = incident as any;
    const id = this.getTransfusionId(incident);

    if (id) return `Transfusion #${id}`;
    if (asAny.transfusion?.dateTransfusion) {
      return `Transfusion ${this.formatDate(asAny.transfusion.dateTransfusion)}`;
    }

    return '';
  }

  getProduitReference(incident: IncidentTransfusionnel): string {
    const asAny = incident as any;

    if (asAny.produitSanguin?.codeProduit) {
      return `${asAny.produitSanguin.codeProduit} - ${asAny.produitSanguin.typeProduit || 'Produit'}`;
    }

    if (incident.numeroLotProduit) {
      return incident.numeroLotProduit;
    }

    return 'N/A';
  }

  getProduitPeremption(incident: IncidentTransfusionnel): string {
    const asAny = incident as any;
    return asAny.datePeremptionProduit || asAny.produitSanguin?.datePeremption || 'N/A';
  }

  getTimelineClass(incident: IncidentTransfusionnel): string {
    const gravite = this.getGraviteValue(incident);

    if (gravite === 'CRITIQUE') return 'timeline-marker-critical';
    if (gravite === 'SEVERE') return 'timeline-marker-severe';
    if (gravite === 'MODEREE') return 'timeline-marker-moderate';
    if (incident.dateValidation) return 'timeline-marker-validated';

    return 'timeline-marker-pending';
  }

  // ========= STATUT =========
  getStatutBadgeClass(incident: IncidentTransfusionnel): string {
    return incident.dateValidation ? 'badge bg-success' : 'badge bg-warning text-dark';
  }

  getStatutIcon(incident: IncidentTransfusionnel): string {
    return incident.dateValidation ? 'check_circle' : 'schedule';
  }

  getStatutLabel(incident: IncidentTransfusionnel): string {
    return incident.dateValidation ? 'VALIDÉ' : 'EN ATTENTE';
  }

  // ========= ACTIONS =========
  validerIncident(incident: IncidentTransfusionnel) {
    if (!this.authService.canValidateIncident()) {
      alert('❌ Vous n\'avez pas les droits pour valider des incidents');
      return;
    }

    if (!incident.id) return;

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

  deleteIncident(incident: IncidentTransfusionnel) {
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
        this.allIncidents.update(list => list.filter(i => i.id !== incident.id));
        this.incidents.update(list => list.filter(i => i.id !== incident.id));
        this.dataSource.data = this.incidents();
        this.getIncidents();
        this.getStatistiques();
        alert('Incident supprimé avec succès !');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur suppression incident:', error);
        alert('Erreur lors de la suppression de l\'incident');
      }
    });
  }

  // ========= EXPORTS =========
  exportToExcel() {
    const data = this.incidents().map(i => ({
      'Date incident': this.formatDate(i.dateIncident),
      'Heure incident': i.heureIncident || 'N/A',
      'Patient': `${i.patientPrenom || ''} ${i.patientNom || ''}`.trim(),
      'N° Dossier': i.patientNumDossier || 'N/A',
      'Type produit': i.typeProduitTransfuse || 'N/A',
      'Produit / lot': this.getProduitReference(i),
      'Lieu': i.lieuIncident || 'N/A',
      'Gravité': this.getGraviteLabel(i),
      'Statut': i.dateValidation ? 'VALIDÉ' : 'EN ATTENTE',
      'Date déclaration': i.dateHeureDeclaration || 'N/A',
      'Date validation': i.dateValidation || 'N/A',
      'Signes': i.signes || 'N/A',
      'Symptômes': (i as any).symptomes || 'N/A',
      'Description': i.descriptionIncident || 'N/A',
      'Actions immédiates': (i as any).actionsImmediates || 'N/A',
      'Analyse préliminaire': (i as any).analysePreliminaire || 'N/A',
      'Actions correctives': (i as any).actionsCorrectives || 'N/A',
      'Transfusion liée': this.getTransfusionReference(i) || 'N/A'
    }));

    if (data.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    try {
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [
        { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 14 }, { wch: 18 },
        { wch: 22 }, { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
        { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 26 },
        { wch: 26 }, { wch: 26 }, { wch: 18 }
      ];

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

  // ========= MODALES / CRUD =========
  openIncidentFormModal(template: TemplateRef<any>, incident?: IncidentTransfusionnel) {
    if (!incident && !this.authService.canCreateIncident()) {
      alert('❌ Vous n\'avez pas les droits pour déclarer des incidents');
      return;
    }

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

  addIncident(incidentData: CreerIncidentRequest) {
    if (!this.authService.canCreateIncident()) {
      alert('❌ Vous n\'avez pas les droits pour déclarer des incidents');
      return;
    }

    this.savingIndicator.set(true);

    const validation = this.incidentService.verifierDonneesObligatoires(incidentData);
    if (!validation.valide) {
      this.savingIndicator.set(false);
      alert('Données incomplètes:\n' + validation.erreurs.join('\n'));
      return;
    }

    this.incidentService.create(incidentData).subscribe({
      next: () => {
        this.savingIndicator.set(false);
        this.getIncidents();
        this.getStatistiques();
        this.closeIncidentModal();
        alert('Incident déclaré avec succès !');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur lors de l\'ajout:', error);
        alert('Erreur lors de la déclaration de l\'incident: ' + error.message);
      }
    });
  }

  updateIncident(incidentData: IncidentTransfusionnel) {
    if (!this.authService.canUpdateIncident()) {
      alert('❌ Vous n\'avez pas les droits pour modifier cet incident');
      return;
    }

    if (!incidentData.id) return;

    this.savingIndicator.set(true);

    this.incidentService.update(incidentData.id, incidentData as any).subscribe({
      next: () => {
        this.savingIndicator.set(false);
        this.getIncidents();
        this.getStatistiques();
        this.closeIncidentModal();
        alert('Incident mis à jour avec succès !');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur mise à jour:', error);
        alert('Erreur lors de la mise à jour de l\'incident');
      }
    });
  }

  // ========= FORMAT / HELPERS =========
  formatDate(date: any): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('fr-FR');
    } catch {
      return String(date);
    }
  }

  formatDateTime(dateTime: any): string {
    if (!dateTime) return 'N/A';
    try {
      return new Date(dateTime).toLocaleString('fr-FR');
    } catch {
      return String(dateTime);
    }
  }

  getFilterInfoMessage(): string {
    const user = this.authService.getCurrentUser();
    if (!user) return 'Non connecté';

    const userType = getUserType(user);
    const total = this.allIncidents().length;
    const filtered = this.incidents().length;

    const messages: { [key: string]: string } = {
      'ADMIN': `👑 Administrateur - Tous les incidents (${filtered}/${total})`,
      'MEDECIN': `🩺 Médecin - Incidents déclarés (${filtered}/${total})`,
      'PERSONNEL_QUALITE': `🧪 Qualité - Consultation / validation (${filtered}/${total})`
    };

    return messages[userType] || `${userType} - ${filtered}/${total}`;
  }
}