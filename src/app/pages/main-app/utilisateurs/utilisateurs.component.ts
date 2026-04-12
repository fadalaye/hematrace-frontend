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
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

import {
  AnyUtilisateur,
  getUserType,
  getUserTypeLabel,
  isMedecin,
  isPersonnel,
  isChefService,
  isAdmin
} from '../../../interfaces/any-utilisateur.interface';
import { UtilisateurService } from '../../../services/utilisateur.service';

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

  utilisateurs = signal<UserWithMetadata[]>([]);
  utilisateursFiltres = signal<UserWithMetadata[]>([]);
  loadingIndicator = signal(false);
  savingIndicator = signal(false);
  modalRef = signal<BsModalRef | null>(null);
  selectedUser = signal<AnyUtilisateur | null>(null);
  selectedType = signal<string>('TOUS');
  selectedStatut = signal<string>('TOUS');
  currentModalType = signal<string>('');
  searchTerm = signal<string>('');

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

  userTypes = [
    { value: 'TOUS', label: 'Tous les utilisateurs', icon: 'groups' },
    { value: 'MEDECIN', label: 'Médecins', icon: 'local_hospital' },
    { value: 'PERSONNEL', label: 'Personnel', icon: 'badge' },
    { value: 'CHEF_SERVICE', label: 'Chefs de Service', icon: 'supervisor_account' },
    { value: 'ADMIN', label: 'Administrateurs', icon: 'admin_panel_settings' }
  ];

  statutsFiltres = [
    { value: 'TOUS', label: 'Tous les statuts' },
    { value: 'ACTIF', label: 'ACTIF' },
    { value: 'INACTIF', label: 'INACTIF' },
    { value: 'CONGÉ', label: 'CONGÉ' },
    { value: 'EN_ATTENTE_ACTIVATION', label: 'EN_ATTENTE_ACTIVATION' }
  ];

  ngOnInit(): void {
    this.loadUtilisateurs();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.dataSource.filterPredicate = this.createFilterPredicate();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.closeModal();
  }

  loadUtilisateurs(): void {
    this.loadingIndicator.set(true);

    this.utilisateurService.getAllUtilisateurs()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (utilisateurs) => {
          const usersWithMetadata = utilisateurs.map(u => this.enrichUserWithMetadata(u));
          this.utilisateurs.set(usersWithMetadata);
          this.applyFilters();
          this.loadingIndicator.set(false);
        },
        error: (err) => {
          this.loadingIndicator.set(false);
          this.showError('Erreur lors du chargement des utilisateurs');
          console.error('❌ Erreur chargement utilisateurs:', err);
        }
      });
  }

  openAddUserModal(): void {
    const dialogRef = this.dialog.open(UserTypeSelectorComponent, {
      width: '600px',
      maxWidth: '95vw',
      panelClass: 'user-type-dialog'
    });

    dialogRef.afterClosed().subscribe((selectedType: string) => {
      if (selectedType) {
        this.openUserFormModal(undefined, selectedType);
      }
    });
  }

  openUserFormModal(user?: AnyUtilisateur, type?: string): void {
    this.selectedUser.set(user || null);

    let modalType: string;
    if (user) {
      modalType = getUserType(user);
    } else if (type) {
      modalType = type;
    } else {
      this.showWarning('Type d’utilisateur non spécifié');
      return;
    }

    this.currentModalType.set(modalType);

    const modalConfig = {
      class: 'modal-lg',
      ignoreBackdropClick: true,
      keyboard: false,
      initialState: {
        utilisateur: user ? this.convertToSpecificType(user, modalType) : null
      }
    };

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
        this.showError('Type d’utilisateur non supporté');
        return;
    }

    this.modalRef.set(this.modalService.show(modalComponent, modalConfig));

    if (this.modalRef()) {
      const modalContent = this.modalRef()!.content as {
        save: Observable<AnyUtilisateur>;
        cancel: Observable<void>;
      };

      modalContent.save
        .pipe(takeUntil(this.destroy$))
        .subscribe((data: AnyUtilisateur) => {
          this.onUserSaved(data);
        });

      modalContent.cancel
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          this.closeModal();
        });
    }
  }

  closeModal(): void {
    if (this.modalRef()) {
      this.modalRef()?.hide();
    }
    this.selectedUser.set(null);
    this.currentModalType.set('');
  }

  onUserSaved(utilisateur: AnyUtilisateur): void {
    this.savingIndicator.set(true);

    const existingUser = this.selectedUser();
    const isEdit = !!existingUser;

    const request$: Observable<any> = isEdit
      ? this.utilisateurService.updateUtilisateur(existingUser.id!, utilisateur)
      : this.utilisateurService.createUtilisateur(utilisateur);

    request$
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: any) => {
          this.savingIndicator.set(false);

          const successMessage = isEdit
            ? 'Utilisateur mis à jour avec succès'
            : (response?.message || 'Compte créé avec succès. Email d’activation envoyé.');

          this.showSuccess(successMessage);
          this.loadUtilisateurs();
          this.closeModal();
        },
        error: (err) => {
          this.savingIndicator.set(false);

          const modalRef = this.modalRef();
          if (modalRef && modalRef.content) {
            if (modalRef.content.setBackendError) {
              modalRef.content.setBackendError(err.message);
            }
            if (modalRef.content.stopLoading) {
              modalRef.content.stopLoading();
            }
          } else {
            this.showError(`Erreur lors de la ${isEdit ? 'mise à jour' : 'création'} : ${err.message}`);
          }

          console.error(`❌ Erreur ${isEdit ? 'mise à jour' : 'création'} utilisateur:`, err);
        }
      });
  }

  deleteUser(user: UserWithMetadata): void {
    if (!user.id) {
      this.showError('Impossible de supprimer : ID manquant');
      return;
    }

    const confirmation = confirm(
      `Êtes-vous sûr de vouloir supprimer l'utilisateur ?\n\n` +
      `👤 ${user.prenom} ${user.nom}\n` +
      `📧 ${user.email}\n` +
      `🎯 ${user.typeLabel}\n\n` +
      `Cette action est irréversible.`
    );

    if (!confirmation) return;

    this.utilisateurService.deleteUtilisateur(user.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showSuccess('Utilisateur supprimé avec succès');
          this.utilisateurs.update(list => list.filter(u => u.id !== user.id));
          this.applyFilters();
        },
        error: (err) => {
          this.showError('Erreur lors de la suppression');
          console.error('❌ Erreur suppression utilisateur:', err);
        }
      });
  }

  onTypeFilterChange(event: any): void {
    this.selectedType.set(event.value);
    this.applyFilters();
  }

  onStatutFilterChange(event: any): void {
    this.selectedStatut.set(event.value);
    this.applyFilters();
  }

  onFilterChange(event: any): void {
    this.searchTerm.set((event.target.value || '').toLowerCase().trim());
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchTerm.set('');
    this.applyFilters();
  }

  applyQuickStatutFilter(statut: string): void {
    this.selectedStatut.set(statut);
    this.applyFilters();
  }

  resetFilters(): void {
    this.selectedType.set('TOUS');
    this.selectedStatut.set('TOUS');
    this.searchTerm.set('');
    this.applyFilters();
  }

  applyFilters(): void {
    let filtered = this.utilisateurs();

    const selectedType = this.selectedType();
    if (selectedType !== 'TOUS') {
      filtered = filtered.filter(u => getUserType(u as AnyUtilisateur) === selectedType);
    }

    const selectedStatut = this.selectedStatut();
    if (selectedStatut !== 'TOUS') {
      filtered = filtered.filter(u => (u.statut || '').toUpperCase() === selectedStatut.toUpperCase());
    }

    const searchTerm = this.searchTerm();
    if (searchTerm) {
      filtered = filtered.filter(u =>
        [
          u.nom,
          u.prenom,
          u.email,
          u.matricule,
          u.specificInfo,
          u.telephone,
          u.typeLabel,
          u.role,
          u.fonction,
          u.specialite,
          u.serviceDirige,
          u.departement,
          u.statut
        ].some(field => field?.toLowerCase().includes(searchTerm))
      );
    }

    this.utilisateursFiltres.set(filtered);
    this.dataSource.data = filtered;

    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  private createFilterPredicate() {
    return (data: UserWithMetadata, filter: string): boolean => {
      if (!filter) return true;

      const searchTerms = filter.toLowerCase().split(' ');
      const searchableFields = [
        data.nom,
        data.prenom,
        data.email,
        data.matricule,
        data.specificInfo,
        data.telephone,
        data.typeLabel,
        data.role,
        data.fonction,
        data.specialite,
        data.serviceDirige,
        data.departement,
        data.statut
      ].map(field => field?.toLowerCase() || '');

      return searchTerms.every(term =>
        searchableFields.some(field => field.includes(term))
      );
    };
  }

  exportToExcel(): void {
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
      'Spécialité / Fonction': u.specificInfo || 'N/A',
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

      ws['!cols'] = [
        { wch: 12 },
        { wch: 15 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 10 },
        { wch: 8 },
        { wch: 14 },
        { wch: 14 },
        { wch: 24 },
        { wch: 18 },
        { wch: 24 },
        { wch: 30 }
      ];

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

      this.showSuccess(`Fichier exporté : ${fileName}`);
    } catch (error) {
      this.showError('Erreur lors de l’export Excel');
      console.error('❌ Erreur export Excel:', error);
    }
  }

  private enrichUserWithMetadata(user: AnyUtilisateur): UserWithMetadata {
    const type = getUserType(user);
    const age = this.calculateAge(user.dateNaissance);

    return {
      ...user,
      typeLabel: getUserTypeLabel(user),
      badgeClass: this.getTypeBadgeClass(type),
      specificInfo: this.getSpecificInfo(user),
      age
    } as UserWithMetadata;
  }

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

  getSpecificInfo(user: AnyUtilisateur): string {
    switch (getUserType(user)) {
      case 'MEDECIN':
        return (user as any).specialite || 'Spécialité non spécifiée';
      case 'PERSONNEL':
        return (user as any).fonction || 'Fonction non spécifiée';
      case 'CHEF_SERVICE': {
        const chef = user as any;
        return `${chef.serviceDirige || 'Service non défini'}${chef.departement ? ` - ${chef.departement}` : ''}`;
      }
      case 'ADMIN':
        return (user as any).role || 'Rôle non défini';
      default:
        return 'Information non disponible';
    }
  }

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

  getStatutChipColor(statut: string): 'primary' | 'accent' | 'warn' {
    switch ((statut || '').toUpperCase()) {
      case 'ACTIF':
        return 'primary';
      case 'EN_ATTENTE_ACTIVATION':
        return 'accent';
      case 'INACTIF':
      case 'CONGÉ':
        return 'warn';
      default:
        return 'warn';
    }
  }

  getStatutIcon(statut: string): string {
    switch ((statut || '').toUpperCase()) {
      case 'ACTIF':
        return 'check_circle';
      case 'EN_ATTENTE_ACTIVATION':
        return 'hourglass_top';
      case 'INACTIF':
        return 'pause_circle';
      case 'CONGÉ':
        return 'beach_access';
      default:
        return 'help';
    }
  }

  getStatutTooltip(statut: string): string {
    switch ((statut || '').toUpperCase()) {
      case 'ACTIF':
        return 'Compte actif';
      case 'EN_ATTENTE_ACTIVATION':
        return 'Compte créé, en attente d’activation par email';
      case 'INACTIF':
        return 'Compte inactif';
      case 'CONGÉ':
        return 'Utilisateur temporairement indisponible';
      default:
        return 'Statut inconnu';
    }
  }

  formatStatutLabel(statut: string): string {
    switch ((statut || '').toUpperCase()) {
      case 'EN_ATTENTE_ACTIVATION':
        return 'En attente';
      case 'CONGÉ':
        return 'Congé';
      case 'ACTIF':
        return 'Actif';
      case 'INACTIF':
        return 'Inactif';
      default:
        return statut || 'Inconnu';
    }
  }

  getStatutCount(statut: string): number {
    return this.utilisateurs().filter(u => (u.statut || '').toUpperCase() === statut.toUpperCase()).length;
  }

  getInactiveLikeCount(): number {
    return this.utilisateurs().filter(u =>
      ['INACTIF', 'CONGÉ'].includes((u.statut || '').toUpperCase())
    ).length;
  }

  showUserSummary(user: UserWithMetadata): void {
    const summary =
      `👤 ${user.prenom} ${user.nom}\n` +
      `📌 Type : ${user.typeLabel}\n` +
      `📧 Email : ${user.email}\n` +
      `📞 Téléphone : ${user.telephone || 'Non renseigné'}\n` +
      `🩺 Spécificité : ${user.specificInfo || 'Non renseignée'}\n` +
      `📍 Statut : ${this.formatStatutLabel(user.statut)}`;

    this.showSuccess(summary);
  }

  resendActivationEmail(user: UserWithMetadata): void {
    this.showWarning(
      `Prévoir un endpoint backend pour renvoyer l’email d’activation à ${user.email}.`
    );
  }

  toggleUserStatus(user: UserWithMetadata): void {
    const targetStatus = user.statut === 'ACTIF' ? 'INACTIF' : 'ACTIF';

    this.showWarning(
      `Prévoir un endpoint backend pour changer le statut de ${user.prenom} ${user.nom} vers ${targetStatus}.`
    );
  }

  private formatDateForDisplay(dateString: string): string {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR');
    } catch {
      return dateString;
    }
  }

  private showSuccess(message: string): void {
    this.snackBar.open(`✅ ${message}`, 'Fermer', {
      duration: 5000,
      panelClass: ['snackbar-success']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(`❌ ${message}`, 'Fermer', {
      duration: 7000,
      panelClass: ['snackbar-error']
    });
  }

  private showWarning(message: string): void {
    this.snackBar.open(`⚠️ ${message}`, 'Fermer', {
      duration: 6000,
      panelClass: ['snackbar-warning']
    });
  }

  refreshList(): void {
    this.loadUtilisateurs();
  }

  getSelectedTypeLabel(): string {
    const selected = this.userTypes.find(t => t.value === this.selectedType());
    return selected?.label || 'Tous les utilisateurs';
  }

  getFilteredCount(): number {
    return this.utilisateursFiltres().length;
  }

  getTotalCount(): number {
    return this.utilisateurs().length;
  }
}