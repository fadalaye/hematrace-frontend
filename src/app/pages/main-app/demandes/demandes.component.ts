import { Component, inject, signal, TemplateRef, ViewChild, AfterViewInit, OnInit } from '@angular/core';
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
import { ModalModule, BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

import { Demande } from '../../../interfaces/demande.interface';
import { EditDemandeComponent } from './components/edit-demande/edit-demande.component';
import { DemandeService } from '../../../services/demande.service';
import { AuthService } from '../../../services/auth.service';
import { isPersonnel, getUserType } from '../../../interfaces/any-utilisateur.interface';

interface StatutOption {
  value: string;
  label: string;
  icon: string;
}

type DemandeViewMode = 'table' | 'cards' | 'kanban';
type StatutAction = 'VALIDÉE' | 'REJETÉE';

@Component({
  selector: 'app-demandes',
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
    ModalModule,
    EditDemandeComponent
  ],
  templateUrl: './demandes.component.html',
  styleUrl: './demandes.component.scss'
})
export class DemandesComponent implements OnInit, AfterViewInit {
  private modalService = inject(BsModalService);
  private demandeService = inject(DemandeService);
  public authService = inject(AuthService);

  temp = signal<Demande[]>([]);
  demandes = signal<Demande[]>([]);
  loadingIndicator = signal<boolean>(false);
  savingIndicator = signal<boolean>(false);
  modalRef = signal<BsModalRef | null>(null);
  selectedDemande = signal<Demande | null>(null);
  searchTerm = signal<string>('');
  selectedStatut = signal<string>('TOUS');
  viewMode = signal<DemandeViewMode>('table');

  statutOptions: StatutOption[] = [
    { value: 'TOUS', label: 'Tous les statuts', icon: 'list' },
    { value: 'EN ATTENTE', label: 'En attente', icon: 'schedule' },
    { value: 'VALIDÉE', label: 'Validées', icon: 'check_circle' },
    { value: 'REJETÉE', label: 'Rejetées', icon: 'cancel' },
    { value: 'DÉLIVRÉE', label: 'Délivrées', icon: 'local_shipping' }
  ];

  displayedColumns: string[] = [
    'patientNom',
    'patientPrenom',
    'serviceDemandeur',
    'typeProduitDemande',
    'groupeSanguinPatient',
    'quantiteDemande',
    'urgence',
    'statut',
    'dateHeureDemande',
    'info',
    'actions'
  ];

  dataSource = new MatTableDataSource<Demande>([]);

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.getDemandes();
    this.initializeUserPermissions();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  private initializeUserPermissions(): void {
    console.log('👤 Permissions utilisateur pour demandes:', {
      estPersonnel: this.authService.isPersonnel(),
      estMedecin: this.authService.isMedecin(),
      estSuperUser: this.authService.isSuperUser(),
      peutCreerDemande: this.authService.showCreateDemandeButton(),
      peutValiderDemande: this.authService.canValidateDemande(),
      peutSupprimerDemande: this.authService.canDeleteDemande()
    });
  }

  getDemandes(): void {
    this.loadingIndicator.set(true);

    this.demandeService.getAll().subscribe({
      next: (demandes) => {
        const demandesFiltrees = this.authService.filterDemandesByPermission(demandes ?? []);
        this.temp.set(demandesFiltrees);
        this.demandes.set(demandesFiltrees);
        this.dataSource.data = demandesFiltrees;
        this.applyFilters();
        this.loadingIndicator.set(false);
      },
      error: (error) => {
        console.error('❌ Erreur chargement demandes:', error);
        this.loadingIndicator.set(false);
      }
    });
  }

  applyFilters(): void {
    const searchTerm = this.searchTerm().trim().toLowerCase();
    const selectedStatut = this.selectedStatut();

    let filteredData = [...this.temp()];

    if (searchTerm) {
      filteredData = filteredData.filter((item) =>
        (item.patientNom || '').toLowerCase().includes(searchTerm) ||
        (item.patientPrenom || '').toLowerCase().includes(searchTerm) ||
        (item.serviceDemandeur || '').toLowerCase().includes(searchTerm) ||
        (item.typeProduitDemande || '').toLowerCase().includes(searchTerm) ||
        (item.statut || '').toLowerCase().includes(searchTerm) ||
        (item.groupeSanguinPatient || '').toLowerCase().includes(searchTerm) ||
        (item.patientNumDossier || '').toLowerCase().includes(searchTerm)
      );
    }

    if (selectedStatut !== 'TOUS') {
      filteredData = filteredData.filter((item) => item.statut === selectedStatut);
    }

    this.demandes.set(filteredData);
    this.dataSource.data = filteredData;

    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  onStatutFilterChange(event: any): void {
    this.selectedStatut.set(event.value);
    this.applyFilters();
  }

  onFilterChange(event: any): void {
    const term = event.target.value?.toLowerCase() || '';
    this.searchTerm.set(term);
    this.applyFilters();
  }

  resetFilters(): void {
    this.selectedStatut.set('TOUS');
    this.searchTerm.set('');
    this.applyFilters();
  }

  setViewMode(mode: DemandeViewMode): void {
    this.viewMode.set(mode);
  }

  getViewMode(): DemandeViewMode {
    return this.viewMode();
  }

  getDemandesAffichees(): Demande[] {
    return this.demandes();
  }

  getDemandesByStatut(statut: string): Demande[] {
    return this.getDemandesAffichees().filter(
      demande => (demande.statut || '').toUpperCase() === statut.toUpperCase()
    );
  }

  getStatutColumns() {
    return [
      {
        key: 'EN ATTENTE',
        title: 'En attente',
        icon: 'schedule',
        className: 'kanban-attente'
      },
      {
        key: 'VALIDÉE',
        title: 'Validées',
        icon: 'check_circle',
        className: 'kanban-validee'
      },
      {
        key: 'REJETÉE',
        title: 'Rejetées',
        icon: 'cancel',
        className: 'kanban-rejetee'
      },
      {
        key: 'DÉLIVRÉE',
        title: 'Délivrées',
        icon: 'local_shipping',
        className: 'kanban-delivree'
      }
    ];
  }

  getTotalCount(): number {
    return this.temp().length;
  }

  getFilteredCount(): number {
    return this.demandes().length;
  }

  getDemandesUrgentesCount(): number {
    return this.demandes().filter(d => !!d.urgence).length;
  }

  getDemandesEnAttenteCount(): number {
    return this.demandes().filter(d => d.statut === 'EN ATTENTE').length;
  }

  getDemandesValideesCount(): number {
    return this.demandes().filter(d => d.statut === 'VALIDÉE').length;
  }

  getDemandesRejeteesCount(): number {
    return this.demandes().filter(d => d.statut === 'REJETÉE').length;
  }

  getDemandesDelivreesCount(): number {
    return this.demandes().filter(d => ((d.statut ?? '') as string).toUpperCase() === 'DÉLIVRÉE').length;
  }

  getDemandesDuJourCount(): number {
    const today = new Date();

    return this.demandes().filter(d => {
      if (!d.dateHeureDemande) return false;
      const dateDemande = new Date(d.dateHeureDemande);
      return dateDemande.getFullYear() === today.getFullYear()
        && dateDemande.getMonth() === today.getMonth()
        && dateDemande.getDate() === today.getDate();
    }).length;
  }

  getCardBorderClass(demande: Demande): string {
    if (demande.urgence) return 'demande-card-urgent';

    const statut = String(demande.statut).toUpperCase();

    switch (statut) {
      case 'EN ATTENTE':
        return 'demande-card-attente';
      case 'VALIDÉE':
        return 'demande-card-validee';
      case 'REJETÉE':
        return 'demande-card-rejetee';
      case 'DÉLIVRÉE':
        return 'demande-card-delivree';
      default:
        return 'demande-card-default';
    }
  }

  getUrgenceLabel(demande: Demande): string {
    return demande.urgence ? 'URGENT' : 'Normale';
  }

  changerStatutDemande(demande: Demande, nouveauStatut: StatutAction): void {
    if (!this.authService.canValidateDemande()) {
      alert('❌ Vous n’avez pas les droits pour changer le statut des demandes');
      return;
    }

    if (!demande.id) {
      alert('❌ ID de demande manquant');
      return;
    }

    if (demande.statut !== 'EN ATTENTE') {
      alert('❌ Seules les demandes en attente peuvent être validées ou rejetées');
      return;
    }

    const action = nouveauStatut === 'VALIDÉE' ? 'valider' : 'rejeter';
    const confirmation = confirm(
      `Êtes-vous sûr de vouloir ${action} cette demande ?\n\n` +
      `Patient : ${demande.patientPrenom} ${demande.patientNom}\n` +
      `Produit : ${demande.typeProduitDemande}`
    );

    if (!confirmation) {
      return;
    }

    this.savingIndicator.set(true);

    if (nouveauStatut === 'VALIDÉE') {
      const utilisateurConnecte = this.authService.getCurrentUser();

      if (!utilisateurConnecte?.id) {
        this.savingIndicator.set(false);
        alert('❌ Aucun utilisateur connecté');
        return;
      }

      if (!isPersonnel(utilisateurConnecte)) {
        const userType = getUserType(utilisateurConnecte);
        this.savingIndicator.set(false);
        alert(`❌ Seul le personnel médical peut valider les demandes\n\nType d'utilisateur : ${userType}`);
        return;
      }

      this.demandeService.validerDemande(demande.id, utilisateurConnecte.id).subscribe({
        next: (demandeMiseAJour: Demande) => {
          this.mettreAJourListeDemandes(demandeMiseAJour);
          this.savingIndicator.set(false);
          alert('✅ Demande validée avec succès');
        },
        error: (error) => {
          this.gestionErreurValidation(error);
        }
      });

      return;
    }

    this.demandeService.updateStatut(demande.id, nouveauStatut).subscribe({
      next: () => {
        const demandeMiseAJour: Demande = {
          ...demande,
          statut: nouveauStatut,
          personnel: undefined
        };

        this.mettreAJourListeDemandes(demandeMiseAJour);
        this.savingIndicator.set(false);
        alert('✅ Demande rejetée avec succès');
      },
      error: (error) => {
        this.gestionErreurValidation(error);
      }
    });
  }

  private mettreAJourListeDemandes(demandeMiseAJour: Demande): void {
    this.demandes.update(list =>
      list.map(d => d.id === demandeMiseAJour.id ? demandeMiseAJour : d)
    );

    this.temp.update(list =>
      list.map(d => d.id === demandeMiseAJour.id ? demandeMiseAJour : d)
    );

    this.dataSource.data = this.demandes();

    if (this.selectedDemande()?.id === demandeMiseAJour.id) {
      this.selectedDemande.set(demandeMiseAJour);
    }
  }

  private gestionErreurValidation(error: any): void {
    this.savingIndicator.set(false);
    console.error('❌ Erreur lors du changement de statut:', error);

    let errorMessage = 'Erreur lors du changement de statut';

    if (error.status === 0) {
      errorMessage += ' - Problème de connexion au serveur';
    } else if (error.error?.message) {
      errorMessage += ` : ${error.error.message}`;
    } else if (error.message) {
      errorMessage += ` : ${error.message}`;
    }

    alert(errorMessage);
  }

  canEditDemande(demande: Demande): boolean {
    return demande.statut === 'EN ATTENTE';
  }

  getStatutBadgeClass(statut: string): string {
    const classes: Record<string, string> = {
      'EN ATTENTE': 'badge bg-warning text-dark',
      'VALIDÉE': 'badge bg-success',
      'REJETÉE': 'badge bg-danger',
      'DÉLIVRÉE': 'badge bg-info'
    };

    return classes[statut] || 'badge bg-secondary';
  }

  getStatutIcon(statut: string): string {
    const icons: Record<string, string> = {
      'EN ATTENTE': 'schedule',
      'VALIDÉE': 'check_circle',
      'REJETÉE': 'cancel',
      'DÉLIVRÉE': 'local_shipping'
    };

    return icons[statut] || 'help';
  }

  deleteDemande(demande: Demande): void {
    if (!this.authService.canDeleteDemande()) {
      alert('❌ Vous n’avez pas les droits pour supprimer des demandes');
      return;
    }

    if (!demande.id) return;

    const confirmation = confirm(
      `Êtes-vous sûr de vouloir supprimer cette demande ?\n\n` +
      `Patient : ${demande.patientPrenom} ${demande.patientNom}\n` +
      `Cette action est irréversible.`
    );

    if (!confirmation) return;

    this.savingIndicator.set(true);

    this.demandeService.delete(demande.id).subscribe({
      next: () => {
        this.savingIndicator.set(false);
        this.demandes.update(list => list.filter(d => d.id !== demande.id));
        this.temp.update(list => list.filter(d => d.id !== demande.id));
        this.dataSource.data = this.demandes();
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur suppression demande:', error);
        alert('Erreur lors de la suppression de la demande');
      }
    });
  }

  exportToExcel(): void {
    const data = this.demandes().map(d => ({
      'Patient': `${d.patientPrenom} ${d.patientNom}`,
      'N° Dossier': d.patientNumDossier,
      'Service Demandeur': d.serviceDemandeur,
      'Type Produit': d.typeProduitDemande,
      'Groupe Sanguin': d.groupeSanguinPatient,
      'Quantité': d.quantiteDemande,
      'Urgence': d.urgence ? 'OUI' : 'NON',
      'Statut': d.statut,
      'Date Demande': this.formatDateForDisplay(d.dateHeureDemande),
      'Indication': d.indicationTransfusion,
      'Observations': d.observations || '',
      'Personnel Validateur': d.personnel ? `${d.personnel.prenom} ${d.personnel.nom}` : 'Non assigné'
    }));

    if (data.length === 0) {
      alert('Aucune donnée à exporter');
      return;
    }

    try {
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = {
        Sheets: { 'Demandes': ws },
        SheetNames: ['Demandes']
      };

      const excelBuffer: ArrayBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob(
        [excelBuffer],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' }
      );

      saveAs(blob, `demandes_${this.getFormattedDateForFile()}.xlsx`);
    } catch (error) {
      console.error('❌ Erreur export Excel:', error);
      alert('Erreur lors de l’export Excel');
    }
  }

  private getFormattedDateForFile(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}_${hh}-${min}`;
  }

  private formatDateForDisplay(date: string | Date | undefined): string {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('fr-FR');
    } catch {
      return String(date);
    }
  }

  openDemandeFormModal(template: TemplateRef<any>, demande?: Demande): void {
    if (demande) {
      if (!this.authService.canModifierDemande(demande)) {
        alert('Vous n’avez pas les droits pour modifier cette demande');
        return;
      }
    } else {
      if (!this.authService.showCreateDemandeButton()) {
        alert('Vous n’avez pas les droits pour créer des demandes');
        return;
      }
    }

    this.selectedDemande.set(demande ?? null);
    this.modalRef.set(this.modalService.show(template, {
      class: 'modal-xl modal-dialog-scrollable',
      ignoreBackdropClick: true,
      keyboard: false
    }));
  }

  openInfoModal(template: TemplateRef<any>, demande: Demande): void {
    this.selectedDemande.set(demande);
    this.modalRef.set(this.modalService.show(template, {
      class: 'modal-xl modal-dialog-scrollable',
      ignoreBackdropClick: true,
      keyboard: false
    }));
  }

  closeDemandeModal(): void {
    this.modalRef()?.hide();
    this.modalRef.set(null);
    this.selectedDemande.set(null);
  }

  addDemande(demande: Demande): void {
    if (!this.authService.showCreateDemandeButton()) {
      alert('Vous n’avez pas les droits pour créer des demandes');
      return;
    }

    this.savingIndicator.set(true);

    const demandeToAdd = { ...demande };
    delete demandeToAdd.id;

    this.demandeService.create(demandeToAdd).subscribe({
      next: (newDemande) => {
        this.savingIndicator.set(false);
        this.temp.update(list => [newDemande, ...list]);
        this.applyFilters();
        this.closeDemandeModal();
        console.log('✅ Demande ajoutée avec succès:', newDemande);
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur lors de l’ajout:', error);
        alert('Erreur lors de l’ajout de la demande');
      }
    });
  }

  updateDemande(demande: Demande): void {
    if (!this.authService.canModifierDemande(demande)) {
      alert('Vous n’avez pas les droits pour modifier cette demande');
      return;
    }

    if (!demande.id) {
      alert('ID de demande manquant');
      return;
    }

    this.savingIndicator.set(true);

    this.demandeService.update(demande.id, demande).subscribe({
      next: (updatedDemande) => {
        this.savingIndicator.set(false);
        this.temp.update(list => list.map(d => d.id === updatedDemande.id ? updatedDemande : d));
        this.applyFilters();
        this.closeDemandeModal();
        console.log('✅ Demande modifiée avec succès:', updatedDemande);
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur lors de la modification:', error);
        alert('Erreur lors de la modification de la demande');
      }
    });
  }
}