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
import { ModalModule, BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Interfaces et services
import { Demande, StatutDemande } from '../../../interfaces/demande.interface';
import { Personnel } from '../../../interfaces/personnel.interface';
import { EditDemandeComponent } from "./components/edit-demande/edit-demande.component";
import { DemandeService } from '../../../services/demande.service';
import { AuthService } from '../../../services/auth.service';
import { isPersonnel, getUserType } from '../../../interfaces/any-utilisateur.interface';

interface StatutOption {
  value: string;
  label: string;
  icon: string;
}

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
  // Services
  private modalService = inject(BsModalService);
  private demandeService = inject(DemandeService);
  public authService = inject(AuthService); // IMPORTANT: public pour le template

  // États
  temp = signal<Demande[]>([]);
  demandes = signal<Demande[]>([]);
  loadingIndicator = signal<boolean>(false);
  savingIndicator = signal<boolean>(false);
  modalRef = signal<BsModalRef | null>(null);
  selectedDemande = signal<Demande | null>(null);
  searchTerm = signal<string>('');
  selectedStatut = signal<string>('TOUS');

  // Options de filtre
  statutOptions: StatutOption[] = [
    { value: 'TOUS', label: 'Tous les statuts', icon: 'list' },
    { value: 'EN ATTENTE', label: 'En attente', icon: 'schedule' },
    { value: 'VALIDÉE', label: 'Validées', icon: 'check_circle' },
    { value: 'REJETÉE', label: 'Rejetées', icon: 'cancel' }
  ];

  // Table Material
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

  ngOnInit() {
    this.getDemandes();
    this.initializeUserPermissions();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  /**
   * Initialise les permissions utilisateur
   */
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

  /**
   * Charge la liste des demandes
   */
  laye(){
    this.authService.fada();
  }
getDemandes() {
  this.loadingIndicator.set(true);
  
  this.demandeService.getAll().subscribe({
    next: (demandes) => {
      console.log('📦 Nombre de demandes brutes:', demandes?.length);
      
      // Afficher quelques demandes pour déboguer
      if (demandes && demandes.length > 0) {
        console.log('📋 Exemples de demandes brutes:');
        demandes.slice(0, 3).forEach((d, i) => {
          console.log(`  ${i+1}. ID: ${d.id}, Patient: ${d.patientPrenom} ${d.patientNom}, MédecinId: ${d.medecinId}`);
        });
      }
      
      // Filtrer selon les permissions
      const demandesFiltrees = this.authService.filterDemandesByPermission(demandes ?? []);
      console.log('🔐 Demandes après filtrage:', demandesFiltrees.length);
      
      // Afficher les demandes filtrées
      if (demandesFiltrees.length > 0) {
        console.log('✅ Demandes visibles:');
        demandesFiltrees.forEach((d, i) => {
          console.log(`  ${i+1}. ${d.patientPrenom} ${d.patientNom} (${d.statut})`);
        });
      } else {
        console.log('⚠️ Aucune demande visible après filtrage');
        
        // Log l'utilisateur actuel pour déboguer
        const user = this.authService.getCurrentUser();
        console.log('👤 Utilisateur actuel:', {
          id: user?.id,
          nom: user?.nom,
          prenom: user?.prenom,
          isMedecin: this.authService.isMedecin()
          
        });
      }
      
      this.demandes.set(demandesFiltrees);
      this.temp.set(demandesFiltrees);
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

  /**
   * Applique tous les filtres
   */
  applyFilters() {
    const searchTerm = this.searchTerm();
    const selectedStatut = this.selectedStatut();

    let filteredData = this.temp();

    // Filtre par recherche
    if (searchTerm) {
      filteredData = filteredData.filter((item) =>
        item.patientNom?.toLowerCase().includes(searchTerm) ||
        item.patientPrenom?.toLowerCase().includes(searchTerm) ||
        item.serviceDemandeur?.toLowerCase().includes(searchTerm) ||
        item.typeProduitDemande?.toLowerCase().includes(searchTerm) ||
        item.statut?.toLowerCase().includes(searchTerm)
      );
    }

    // Filtre par statut
    if (selectedStatut !== 'TOUS') {
      filteredData = filteredData.filter((item) => 
        item.statut === selectedStatut
      );
    }

    this.demandes.set(filteredData);
    this.dataSource.data = filteredData;
  }

  /**
   * Filtre par statut
   */
  onStatutFilterChange(event: any) {
    const statut = event.value;
    this.selectedStatut.set(statut);
    this.applyFilters();
  }

  /**
   * Filtre par recherche texte
   */
  onFilterChange(event: any) {
    const term = event.target.value.toLowerCase();
    this.searchTerm.set(term);
    this.applyFilters();
  }

  /**
   * Réinitialise tous les filtres
   */
  resetFilters() {
    this.selectedStatut.set('TOUS');
    this.searchTerm.set('');
    this.applyFilters();
  }

  /**
   * Change le statut d'une demande avec vérification des permissions
   */
  changerStatutDemande(demande: Demande, nouveauStatut: StatutDemande) {
    // Vérification des permissions
    if (!this.authService.canValidateDemande()) {
      alert('❌ Vous n\'avez pas les droits pour valider/rejeter des demandes');
      return;
    }

    if (!demande.id) {
      console.error('❌ ID de demande manquant');
      return;
    }

    const action = nouveauStatut === 'VALIDÉE' ? 'valider' : 'rejeter';
    const confirmation = confirm(
      `Êtes-vous sûr de vouloir ${action} cette demande ?\n\n` +
      `Patient: ${demande.patientPrenom} ${demande.patientNom}\n` +
      `Produit: ${demande.typeProduitDemande}`
    );

    if (!confirmation) return;

    this.savingIndicator.set(true);

    if (nouveauStatut === 'VALIDÉE') {
      // Pour la validation, utilisez la méthode qui accepte l'ID du personnel
      const utilisateurConnecte = this.authService.getCurrentUser();
      
      if (!utilisateurConnecte?.id) {
        alert('❌ Impossible de valider : utilisateur non connecté');
        this.savingIndicator.set(false);
        return;
      }

      console.log('👤 Utilisateur connecté pour validation:', {
        id: utilisateurConnecte.id,
        nom: utilisateurConnecte.nom,
        prenom: utilisateurConnecte.prenom,
        type: getUserType(utilisateurConnecte),
        estPersonnel: isPersonnel(utilisateurConnecte)
      });

      // Vérifiez que l'utilisateur est bien un Personnel
      if (!isPersonnel(utilisateurConnecte)) {
        const userType = getUserType(utilisateurConnecte);
        alert(`❌ Seul le personnel médical peut valider les demandes\n\nType d'utilisateur: ${userType}`);
        this.savingIndicator.set(false);
        return;
      }

      // Utilisez la méthode validerDemande avec l'ID du personnel
      this.demandeService.validerDemande(demande.id, utilisateurConnecte.id).subscribe({
        next: (demandeMiseAJour: Demande) => {
          console.log('✅ Demande validée avec succès:', {
            id: demandeMiseAJour.id,
            statut: demandeMiseAJour.statut,
            personnel: demandeMiseAJour.personnel
          });
          
          // Affichez les détails du personnel dans la console pour déboguer
          if (demandeMiseAJour.personnel && isPersonnel(demandeMiseAJour.personnel)) {
            console.log('👤 Personnel associé:', {
              id: demandeMiseAJour.personnel.id,
              nom: demandeMiseAJour.personnel.nom,
              prenom: demandeMiseAJour.personnel.prenom,
              fonction: demandeMiseAJour.personnel.fonction,
              matricule: demandeMiseAJour.personnel.matricule
            });
          }
          
          this.mettreAJourListeDemandes(demandeMiseAJour);
          this.savingIndicator.set(false);
          alert('Demande validée avec succès !');
        },
        error: (error) => {
          this.gestionErreurValidation(error);
        }
      });
    } else if (nouveauStatut === 'REJETÉE') {
      // Pour le rejet, utilisez updateStatut (pas besoin d'ID personnel)
      this.demandeService.updateStatut(demande.id, nouveauStatut).subscribe({
        next: () => {
          // Créez une copie mise à jour localement pour le rejet
          const demandeRejetee: Demande = {
            ...demande,
            statut: nouveauStatut,
            personnel: undefined // Enlève le personnel pour une demande rejetée
          };
          
          this.mettreAJourListeDemandes(demandeRejetee);
          this.savingIndicator.set(false);
          alert('Demande rejetée avec succès !');
        },
        error: (error) => {
          this.gestionErreurValidation(error);
        }
      });
    }
  }

  /**
   * Mettre à jour la liste des demandes
   */
  private mettreAJourListeDemandes(demandeMiseAJour: Demande) {
    this.demandes.update(list => 
      list.map(d => d.id === demandeMiseAJour.id ? demandeMiseAJour : d)
    );
    this.temp.update(list => 
      list.map(d => d.id === demandeMiseAJour.id ? demandeMiseAJour : d)
    );
    this.dataSource.data = this.demandes();
    
    // Mettre à jour également la demande sélectionnée si c'est elle
    if (this.selectedDemande()?.id === demandeMiseAJour.id) {
      this.selectedDemande.set(demandeMiseAJour);
    }
  }

  /**
   * Gestion des erreurs de validation
   */
  private gestionErreurValidation(error: any) {
    this.savingIndicator.set(false);
    console.error('❌ Erreur lors du changement de statut:', error);
    
    let errorMessage = 'Erreur lors du changement de statut';
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
   * Vérifie si une demande peut être modifiée (statut)
   */
  canEditDemande(demande: Demande): boolean {
    return demande.statut === 'EN ATTENTE';
  }

  /**
   * Obtient la couleur du badge selon le statut
   */
  getStatutBadgeClass(statut: string): string {
    const classes: { [key: string]: string } = {
      'EN ATTENTE': 'badge bg-warning text-dark',
      'VALIDÉE': 'badge bg-success',
      'REJETÉE': 'badge bg-danger'
    };
    return classes[statut] || 'badge bg-secondary';
  }

  /**
   * Obtient l'icône selon le statut
   */
  getStatutIcon(statut: string): string {
    switch (statut) {
      case 'EN ATTENTE':
        return 'schedule';
      case 'VALIDÉE':
        return 'check_circle';
      case 'REJETÉE':
        return 'cancel';
      default:
        return 'help';
    }
  }

  /**
   * Supprime une demande avec vérification des permissions
   */
  deleteDemande(demande: Demande) {
    // Vérification des permissions
    if (!this.authService.canDeleteDemande()) {
      alert('❌ Vous n\'avez pas les droits pour supprimer des demandes');
      return;
    }

    if (!demande.id) return;

    const confirmation = confirm(
      `Êtes-vous sûr de vouloir supprimer cette demande ?\n\n` +
      `Patient: ${demande.patientPrenom} ${demande.patientNom}\n` +
      `Cette action est irréversible.`
    );

    if (confirmation) {
      this.savingIndicator.set(true);
      
      this.demandeService.delete(demande.id).subscribe({
        next: () => {
          this.savingIndicator.set(false);
          this.demandes.update(list => list.filter(d => d.id !== demande.id));
          this.temp.update(list => list.filter(d => d.id !== demande.id));
          this.dataSource.data = this.demandes();
          console.log('✅ Demande supprimée avec succès');
        },
        error: (error) => {
          this.savingIndicator.set(false);
          console.error('❌ Erreur suppression demande:', error);
          alert('Erreur lors de la suppression de la demande');
        }
      });
    }
  }

  /**
   * Export Excel
   */
  exportToExcel() {
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
      
      const excelBuffer: any = XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array'
      });
      
      const file = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const fileName = `demandes_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(file, fileName);
      
      console.log('✅ Fichier exporté:', fileName);
    } catch (error) {
      console.error('❌ Erreur export Excel:', error);
      alert('Erreur lors de l\'export Excel');
    }
  }

  /**
   * Formate une date pour l'affichage
   */
  private formatDateForDisplay(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR');
    } catch {
      return dateString;
    }
  }

  /**
   * Ouvre la modale d'édition/création avec vérification des permissions
   */
  openDemandeFormModal(template: TemplateRef<any>, demande?: Demande) {
    // Vérifier les droits avant d'ouvrir la modal
    if (demande) {
      if (!this.authService.canModifierDemande(demande)) {
        alert('Vous n\'avez pas les droits pour modifier cette demande');
        return;
      }
    } else {
      if (!this.authService.showCreateDemandeButton()) {
        alert('Vous n\'avez pas les droits pour créer des demandes');
        return;
      }
    }

    this.selectedDemande.set(demande || null);
    this.modalRef.set(this.modalService.show(template, { 
      class: 'modal-lg',
      ignoreBackdropClick: true,
      keyboard: false
    }));
  }

  /**
   * Ouvre la modale d'information
   */
  openInfoModal(template: TemplateRef<any>, demande: Demande) {
    this.selectedDemande.set(demande);
    this.modalRef.set(this.modalService.show(template, { 
      class: 'modal-lg',
      ignoreBackdropClick: true,
      keyboard: false
    }));
  }

  /**
   * Ferme la modale
   */
  closeDemandeModal() {
    this.modalRef()?.hide();
    this.selectedDemande.set(null);
  }

  /**
   * Ajoute une nouvelle demande avec vérification des permissions
   */
  addDemande(demande: Demande) {
    if (!this.authService.showCreateDemandeButton()) {
      alert('Vous n\'avez pas les droits pour créer des demandes');
      return;
    }

    this.savingIndicator.set(true);
    
    const demandeToAdd = { ...demande };
    delete demandeToAdd.id;

    this.demandeService.create(demandeToAdd).subscribe({
      next: (newDemande) => {
        this.savingIndicator.set(false);
        this.demandes.update(list => [newDemande, ...list]);
        this.temp.update(list => [newDemande, ...list]);
        this.dataSource.data = this.demandes();
        this.closeDemandeModal();
        console.log('✅ Demande ajoutée avec succès:', newDemande);
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur lors de l\'ajout:', error);
        alert('Erreur lors de l\'ajout de la demande: ' + error.message);
      }
    });
  }

  /**
   * Met à jour une demande existante avec vérification des permissions
   */
  updateDemande(demande: Demande) {
    if (!this.authService.canModifierDemande(demande)) {
      alert('Vous n\'avez pas les droits pour modifier cette demande');
      return;
    }

    this.savingIndicator.set(true);
    
    if (!demande.id) {
      console.error('❌ Impossible de modifier: ID manquant');
      this.savingIndicator.set(false);
      return;
    }

    this.demandeService.update(demande.id, demande).subscribe({
      next: (updatedDemande) => {
        this.savingIndicator.set(false);
        this.demandes.update(list => list.map(d => d.id === updatedDemande.id ? updatedDemande : d));
        this.temp.update(list => list.map(d => d.id === updatedDemande.id ? updatedDemande : d));
        this.dataSource.data = this.demandes();
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

  /**
   * Obtient le nombre total de demandes filtrées
   */
  getFilteredCount(): number {
    return this.demandes().length;
  }

  /**
   * Obtient le nombre total de demandes
   */
  getTotalCount(): number {
    return this.temp().length;
  }

  /**
   * Type guard pour Personnel
   */
  isPersonnel(user: any): user is Personnel {
    return user && 'fonction' in user && typeof user.fonction === 'string';
  }
}