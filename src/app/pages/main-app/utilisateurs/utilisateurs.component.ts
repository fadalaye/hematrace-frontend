// components/utilisateurs/utilisateurs.component.ts
import { Component, inject, signal, ViewChild, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ModalModule, BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Interfaces et services
import { AnyUtilisateur, getUserType, getUserTypeLabel, isMedecin, isPersonnel, isChefService, isAdmin } from '../../../interfaces/any-utilisateur.interface';
import { UtilisateurService } from '../../../services/utilisateur.service';

// Composants d'édition
import { EditMedecinComponent } from './components/edit-medecin/edit-medecin.component';
import { EditPersonnelComponent } from './components/edit-personnel/edit-personnel.component';
import { EditChefServiceComponent } from './components/edit-chef-service/edit-chef-service.component';
import { EditAdminComponent } from './components/edit-admin/edit-admin.component';
import { UserTypeSelectorComponent } from './components/user-type-selector/user-type-selector.component';

interface UserWithMetadata {
  id?: number;
  matricule: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  sexe: 'M' | 'F';
  dateNaissance: string;
  adresse?: string;
  dateEmbauche?: string;
  motDePasse?: string;
  photoProfil?: string;
  statut: string;
  fonction?: string;
  specialite?: string;
  serviceDirige?: string;
  departement?: string;
  role?: string;
  droitsAccess?: string;
  typeLabel: string;
  badgeClass: string;
  specificInfo: string;
  age?: number;
}

@Component({
  selector: 'app-utilisateurs',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
    ModalModule,
    // Composants d'édition
    EditMedecinComponent,
    EditPersonnelComponent,
    EditChefServiceComponent,
    EditAdminComponent
  ],
  templateUrl: './utilisateurs.component.html',
  styleUrls: ['./utilisateurs.component.scss']
})
export class UtilisateursComponent implements OnInit, AfterViewInit, OnDestroy {
  private utilisateurService = inject(UtilisateurService);
  private modalService = inject(BsModalService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Signaux pour la gestion d'état
  utilisateurs = signal<UserWithMetadata[]>([]);
  utilisateursFiltres = signal<UserWithMetadata[]>([]);
  loadingIndicator = signal(false);
  savingIndicator = signal(false);
  modalRef = signal<BsModalRef | null>(null);
  selectedUser = signal<AnyUtilisateur | null>(null);
  selectedType = signal<string>('TOUS');
  currentModalType = signal<string>('');
  searchTerm = signal<string>('');

  // Configuration de la table
  displayedColumns: string[] = [
    'matricule',
    'prenom', 
    'nom',
    'email',
    'type',
    'specificInfo',
    'statut',
    'actions'
  ];

  dataSource = new MatTableDataSource<UserWithMetadata>([]);

  // Types d'utilisateurs disponibles
  userTypes = [
    { value: 'TOUS', label: '👥 Tous les utilisateurs', icon: 'groups' },
    { value: 'MEDECIN', label: '👨‍⚕️ Médecins', icon: 'local_hospital' },
    { value: 'PERSONNEL', label: '👨‍💼 Personnel', icon: 'badge' },
    { value: 'CHEF_SERVICE', label: '👔 Chefs de Service', icon: 'supervisor_account' },
    { value: 'ADMIN', label: '🔧 Administrateurs', icon: 'admin_panel_settings' }
  ];

  ngOnInit() {
    this.loadUtilisateurs();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Configurer le filtrage personnalisé
    this.dataSource.filterPredicate = this.createFilterPredicate();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.closeModal();
  }

  /**
   * Charge la liste des utilisateurs
   */
  loadUtilisateurs() {
    this.loadingIndicator.set(true);
    
    this.utilisateurService.getAllUtilisateurs()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (utilisateurs) => {
          const usersWithMetadata = utilisateurs.map(u => this.enrichUserWithMetadata(u));
          this.utilisateurs.set(usersWithMetadata);
          this.applyFilters();
          this.loadingIndicator.set(false);
          
          this.showSuccess(`${usersWithMetadata.length} utilisateur(s) chargé(s)`);
        },
        error: (err) => {
          this.loadingIndicator.set(false);
          this.showError('Erreur lors du chargement des utilisateurs');
          console.error('❌ Erreur chargement utilisateurs:', err);
        }
      });
  }

  /**
   * Ouvre la modale de sélection du type d'utilisateur
   */
  openAddUserModal() {
    const dialogRef = this.dialog.open(UserTypeSelectorComponent, {
      width: '600px',
      maxWidth: '95vw',
      panelClass: 'user-type-dialog'
    });

    dialogRef.afterClosed().subscribe((selectedType: string) => {
      if (selectedType) {
        console.log(`🎯 Type sélectionné: ${selectedType}`);
        this.openUserFormModal(undefined, selectedType);
      } else {
        console.log('❌ Sélection annulée');
      }
    });
  }

  /**
   * Ouvre la modale d'édition/création d'utilisateur
   */
  openUserFormModal(user?: AnyUtilisateur, type?: string) {
    this.selectedUser.set(user || null);
    
    // Déterminer le type de modale
    let modalType: string;
    if (user) {
      modalType = getUserType(user);
    } else if (type) {
      modalType = type;
    } else {
      console.warn('⚠️ Type non spécifié pour la création');
      return;
    }
    
    this.currentModalType.set(modalType);

    // Configuration de la modale
    const modalConfig = {
      class: 'modal-lg',
      ignoreBackdropClick: true,
      keyboard: false,
      initialState: {
        utilisateur: user ? this.convertToSpecificType(user, modalType) : null
      }
    };

    // Ouvrir la modale appropriée
    let modalComponent: any;
    switch (modalType) {
      case 'MEDECIN':
        modalComponent = EditMedecinComponent;
        break;
      case 'PERSONNEL':
        modalComponent = EditPersonnelComponent;
        break;
      case 'CHEF_SERVICE':
        modalComponent = EditChefServiceComponent;
        break;
      case 'ADMIN':
        modalComponent = EditAdminComponent;
        break;
      default:
        this.showError('Type d\'utilisateur non supporté');
        return;
    }

    this.modalRef.set(this.modalService.show(modalComponent, modalConfig));

    // Gérer les événements de la modale
    if (this.modalRef()) {
      this.modalRef()!.content!.save
        .pipe(takeUntil(this.destroy$))
        .subscribe((data: any) => {
          this.onUserSaved(data);
        });
      
      this.modalRef()!.content!.cancel
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.closeModal();
        });
    }
  }

  /**
   * Ferme la modale active
   */
  closeModal() {
    if (this.modalRef()) {
      this.modalRef()?.hide();
    }
    this.selectedUser.set(null);
    this.currentModalType.set('');
  }

  /**
   * Gère la sauvegarde d'un utilisateur
   */
  onUserSaved(utilisateur: AnyUtilisateur) {
    this.savingIndicator.set(true);
    
    const existingUser = this.selectedUser();
    const isEdit = !!existingUser;
    
    console.log(`💾 ${isEdit ? 'Mise à jour' : 'Création'} utilisateur:`, utilisateur);

    const request$ = isEdit
      ? this.utilisateurService.updateUtilisateur(existingUser.id!, utilisateur)
      : this.utilisateurService.createUtilisateur(utilisateur);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (savedUser) => {
          this.savingIndicator.set(false);
          this.showSuccess(`Utilisateur ${isEdit ? 'mis à jour' : 'créé'} avec succès`);
          this.loadUtilisateurs();
          this.closeModal();
        },
        error: (err) => {
          this.savingIndicator.set(false);
          
          // Gérer l'erreur dans la modale active
          const modalRef = this.modalRef();
          if (modalRef && modalRef.content) {
            if (modalRef.content.setBackendError) {
              modalRef.content.setBackendError(err.message);
            }
            if (modalRef.content.stopLoading) {
              modalRef.content.stopLoading();
            }
          } else {
            this.showError(`Erreur lors de la ${isEdit ? 'mise à jour' : 'création'}: ${err.message}`);
          }
          
          console.error(`❌ Erreur ${isEdit ? 'mise à jour' : 'création'} utilisateur:`, err);
        }
      });
  }

  /**
   * Supprime un utilisateur
   */
  deleteUser(user: UserWithMetadata) {
    if (!user.id) {
      this.showError('Impossible de supprimer: ID manquant');
      return;
    }

    const confirmation = confirm(
      `Êtes-vous sûr de vouloir supprimer l'utilisateur ?\n\n` +
      `👤 ${user.prenom} ${user.nom}\n` +
      `📧 ${user.email}\n` +
      `🎯 ${user.typeLabel}\n\n` +
      `Cette action est irréversible.`
    );

    if (confirmation) {
      this.utilisateurService.deleteUtilisateur(user.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.showSuccess('Utilisateur supprimé avec succès');
            
            // Mettre à jour les données localement
            this.utilisateurs.update(list => list.filter(u => u.id !== user.id));
            this.applyFilters();
          },
          error: (err) => {
            this.showError('Erreur lors de la suppression');
            console.error('❌ Erreur suppression utilisateur:', err);
          }
        });
    }
  }

  /**
   * Filtre par type d'utilisateur
   */
  onTypeFilterChange(event: any) {
    const type = event.value;
    this.selectedType.set(type);
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
   * Applique tous les filtres
   */
  public applyFilters() {
    let filtered = this.utilisateurs();

    // Filtre par type
    const selectedType = this.selectedType();
    if (selectedType !== 'TOUS') {
      filtered = filtered.filter(u => getUserType(u as AnyUtilisateur) === selectedType);
    }

    // Filtre par recherche
    const searchTerm = this.searchTerm();
    if (searchTerm) {
      filtered = filtered.filter(u =>
        [u.nom, u.prenom, u.email, u.matricule, u.specificInfo, u.telephone]
          .some(field => field?.toLowerCase().includes(searchTerm))
      );
    }

    this.utilisateursFiltres.set(filtered);
    this.dataSource.data = filtered;
    
    // Appliquer le filtre à la datasource pour la pagination
    this.dataSource.filter = searchTerm;

    console.log(`🔍 Filtres appliqués: ${filtered.length} résultat(s)`);
  }

  /**
   * Prédicat de filtrage personnalisé pour MatTable
   */
  private createFilterPredicate() {
    return (data: UserWithMetadata, filter: string): boolean => {
      if (!filter) return true;
      
      const searchTerms = filter.toLowerCase().split(' ');
      const searchableFields = [
        data.nom, data.prenom, data.email, data.matricule, 
        data.specificInfo, data.telephone, data.typeLabel
      ].map(field => field?.toLowerCase() || '');

      return searchTerms.every(term => 
        searchableFields.some(field => field.includes(term))
      );
    };
  }

  /**
   * Exporte les données en Excel
   */
  exportToExcel() {
    const data = this.utilisateursFiltres().map(u => ({
      'Matricule': u.matricule,
      'Nom': u.nom,
      'Prénom': u.prenom,
      'Email': u.email,
      'Téléphone': u.telephone || 'Non renseigné',
      'Sexe': u.sexe === 'M' ? 'Masculin' : 'Féminin',
      'Âge': u.age || 'N/A',
      'Date Naissance': this.formatDateForDisplay(u.dateNaissance),
      'Date Embauche': u.dateEmbauche ? this.formatDateForDisplay(u.dateEmbauche) : 'N/A',
      'Statut': u.statut,
      'Type': u.typeLabel,
      'Spécialité/Fonction': u.specificInfo || 'N/A',
      'Adresse': u.adresse || 'Non renseignée'
    }));

    if (data.length === 0) {
      this.showWarning('Aucune donnée à exporter');
      return;
    }

    try {
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = { 
        Sheets: { 'Utilisateurs': ws }, 
        SheetNames: ['Utilisateurs'] 
      };
      
      // Ajuster la largeur des colonnes
      const colWidths = [
        { wch: 12 }, // Matricule
        { wch: 15 }, // Nom
        { wch: 15 }, // Prénom
        { wch: 25 }, // Email
        { wch: 15 }, // Téléphone
        { wch: 10 }, // Sexe
        { wch: 8 },  // Âge
        { wch: 12 }, // Date Naissance
        { wch: 12 }, // Date Embauche
        { wch: 10 }, // Statut
        { wch: 15 }, // Type
        { wch: 20 }, // Spécialité/Fonction
        { wch: 30 }  // Adresse
      ];
      ws['!cols'] = colWidths;

      const excelBuffer: any = XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array',
        cellStyles: true
      });
      
      const file = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const fileName = `utilisateurs_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(file, fileName);
      
      this.showSuccess(`Fichier exporté: ${fileName}`);
    } catch (error) {
      this.showError('Erreur lors de l\'export Excel');
      console.error('❌ Erreur export Excel:', error);
    }
  }

  /**
   * Enrichit un utilisateur avec des métadonnées pour l'affichage
   */
  private enrichUserWithMetadata(user: AnyUtilisateur): UserWithMetadata {
    const type = getUserType(user);
    const age = this.calculateAge(user.dateNaissance);
    
    return {
      ...user,
      typeLabel: getUserTypeLabel(user),
      badgeClass: this.getTypeBadgeClass(type),
      specificInfo: this.getSpecificInfo(user),
      age: age
    } as UserWithMetadata;
  }

  /**
   * Calcule l'âge à partir de la date de naissance
   */
  private calculateAge(dateNaissance: string): number {
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

  /**
   * Convertit un utilisateur générique en type spécifique
   */
  private convertToSpecificType(user: AnyUtilisateur, targetType: string): any {
    const baseData = {
      id: user.id,
      matricule: user.matricule,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      telephone: user.telephone,
      sexe: user.sexe,
      dateNaissance: user.dateNaissance,
      adresse: user.adresse,
      dateEmbauche: user.dateEmbauche,
      statut: user.statut,
      photoProfil: user.photoProfil
    };

    switch (targetType) {
      case 'MEDECIN':
        return isMedecin(user) ? user : { ...baseData, specialite: '' };
      case 'PERSONNEL':
        return isPersonnel(user) ? user : { ...baseData, fonction: '' };
      case 'CHEF_SERVICE':
        return isChefService(user) ? user : { ...baseData, serviceDirige: '', departement: '' };
      case 'ADMIN':
        return isAdmin(user) ? user : { ...baseData, role: '', droitsAccess: '' };
      default:
        return user;
    }
  }

  /**
   * Obtient les informations spécifiques selon le type d'utilisateur
   */
  getSpecificInfo(user: AnyUtilisateur): string {
    switch (getUserType(user)) {
      case 'MEDECIN': 
        return (user as any).specialite || 'Non spécifiée';
      case 'PERSONNEL': 
        return (user as any).fonction || 'Non spécifiée';
      case 'CHEF_SERVICE': 
        const chef = user as any;
        return `${chef.serviceDirige || 'Service non défini'}${chef.departement ? ` - ${chef.departement}` : ''}`;
      case 'ADMIN': 
        return (user as any).role || 'Rôle non défini';
      default: 
        return 'Information non disponible';
    }
  }

  /**
   * Obtient la classe CSS pour le badge de type
   */
  getTypeBadgeClass(type: string): string {
    const classes: { [key: string]: string } = {
      MEDECIN: 'badge bg-primary',
      PERSONNEL: 'badge bg-info text-dark',
      CHEF_SERVICE: 'badge bg-warning text-dark',
      ADMIN: 'badge bg-danger',
      UTILISATEUR: 'badge bg-secondary'
    };
    return classes[type] || 'badge bg-secondary';
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
   * Affiche un message de succès
   */
  private showSuccess(message: string) {
    this.snackBar.open(`✅ ${message}`, 'Fermer', {
      duration: 5000,
      panelClass: ['snackbar-success']
    });
  }

  /**
   * Affiche un message d'erreur
   */
  private showError(message: string) {
    this.snackBar.open(`❌ ${message}`, 'Fermer', {
      duration: 7000,
      panelClass: ['snackbar-error']
    });
  }

  /**
   * Affiche un message d'avertissement
   */
  private showWarning(message: string) {
    this.snackBar.open(`⚠️ ${message}`, 'Fermer', {
      duration: 5000,
      panelClass: ['snackbar-warning']
    });
  }

  /**
   * Rafraîchit la liste des utilisateurs
   */
  refreshList() {
    this.loadUtilisateurs();
  }

  /**
   * Obtient le libellé du type sélectionné
   */
  getSelectedTypeLabel(): string {
    const selected = this.userTypes.find(t => t.value === this.selectedType());
    return selected?.label || 'Tous les utilisateurs';
  }

  /**
   * Obtient le nombre total d'utilisateurs filtrés
   */
  getFilteredCount(): number {
    return this.utilisateursFiltres().length;
  }

  /**
   * Obtient le nombre total d'utilisateurs
   */
  getTotalCount(): number {
    return this.utilisateurs().length;
  }
}