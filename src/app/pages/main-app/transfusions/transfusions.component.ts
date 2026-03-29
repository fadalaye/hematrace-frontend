import { 
  Component, 
  inject, 
  signal, 
  TemplateRef, 
  ViewChild, 
  AfterViewInit, 
  OnInit, 
  DestroyRef,
  computed,
  ChangeDetectionStrategy,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { 
  MatButtonModule 
} from '@angular/material/button';
import { 
  MatIconModule 
} from '@angular/material/icon';
import { 
  MatTooltipModule 
} from '@angular/material/tooltip';
import { 
  MatProgressSpinnerModule 
} from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ModalModule, BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, finalize, catchError, of } from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Interfaces et services
import { Transfusion } from '../../../interfaces/transfusion.interface';
import { TransfusionService } from '../../../services/transfusion.service';
import { AuthService } from '../../../services/auth.service';

interface FiltreOption {
  value: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-transfusions',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    ModalModule,
    RouterModule
  ],
  templateUrl: './transfusions.component.html',
  styleUrls: ['./transfusions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransfusionsComponent implements OnInit, AfterViewInit, OnDestroy {
  // Services
  private modalService = inject(BsModalService);
  private transfusionService = inject(TransfusionService);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public authService = inject(AuthService); // IMPORTANT: public pour le template

  // États
  private allTransfusions = signal<Transfusion[]>([]);
  
  filteredTransfusions = computed(() => {
    const data = this.allTransfusions();
    const searchTerm = this.searchTerm().toLowerCase();
    const selectedTolerance = this.selectedTolerance();
    const selectedEffets = this.selectedEffetsIndesirables();

    let filtered = data;

    // Filtre par recherche
    if (searchTerm) {
      filtered = filtered.filter(item =>
        this.searchInTransfusion(item, searchTerm)
      );
    }

    // Filtre par tolérance
    if (selectedTolerance !== 'TOUTES') {
      filtered = filtered.filter(item => item.tolerance === selectedTolerance);
    }

    // Filtre par effets indésirables
    if (selectedEffets !== 'TOUS') {
      filtered = filtered.filter(item => 
        selectedEffets === 'AVEC' ? item.effetsIndesirables : !item.effetsIndesirables
      );
    }

    return filtered;
  });

  loadingIndicator = signal<boolean>(false);
  savingIndicator = signal<boolean>(false);
  exportingIndicator = signal<boolean>(false);
  modalRef = signal<BsModalRef | null>(null);
  selectedTransfusion = signal<Transfusion | null>(null);
  searchTerm = signal<string>('');
  
  // Filtres
  selectedTolerance = signal<string>('TOUTES');
  selectedEffetsIndesirables = signal<string>('TOUS');

  // Pour la recherche avec debounce
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // Options de filtre
  toleranceOptions: FiltreOption[] = [
    { value: 'TOUTES', label: 'Toutes les tolérances', icon: 'list' },
    { value: 'Bonne', label: 'Bonne tolérance', icon: 'thumb_up' },
    { value: 'Moyenne', label: 'Tolérance moyenne', icon: 'thumbs_up_down' },
    { value: 'Mauvaise', label: 'Mauvaise tolérance', icon: 'thumb_down' }
  ];

  effetsOptions: FiltreOption[] = [
    { value: 'TOUS', label: 'Tous les effets', icon: 'list' },
    { value: 'AVEC', label: 'Avec effets indésirables', icon: 'warning' },
    { value: 'SANS', label: 'Sans effets indésirables', icon: 'check_circle' }
  ];

  // Table Material
  displayedColumns: string[] = [
    'patientNom',
    'patientPrenom',
    'groupeSanguinPatient',
    'produitSanguin',
    'medecin',
    'tolerance',
    'effetsIndesirables',
    'etatPatientApres',
    'declarant',
    'info',
    'actions'
  ];
  dataSource = new MatTableDataSource<Transfusion>([]);
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit() {
    this.setupSearchDebounce();
    this.getTransfusions();
    this.initializeUserPermissions();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Mettre à jour le dataSource quand filteredTransfusions change
    this.updateDataSource();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSubject.complete();
  }

  /* ---------- PERMISSIONS ---------- */
  private initializeUserPermissions(): void {
    console.log('👤 Permissions utilisateur pour transfusions:', {
      estPersonnel: this.authService.isPersonnel(),
      estMedecin: this.authService.isMedecin(),
      estSuperUser: this.authService.isSuperUser(),
      peutCreerTransfusion: this.authService.canCreateTransfusion(),
      peutModifierTransfusion: this.authService.canUpdateTransfusion(),
      peutSupprimerTransfusion: this.authService.canDeleteTransfusion(),
      peutVoirTransfusions: this.authService.canViewTransfusions()
    });
  }

  /**
   * Vérifie si l'utilisateur peut créer une transfusion
   */
  canCreateTransfusion(): boolean {
    return this.authService.canCreateTransfusion();
  }

  /**
   * Vérifie si l'utilisateur peut modifier cette transfusion spécifique
   */
  canModifySpecificTransfusion(transfusion: Transfusion): boolean {
    return this.authService.canUpdateTransfusion();
  }

  /**
   * Vérifie si l'utilisateur peut supprimer une transfusion
   */
  canDeleteTransfusion(): boolean {
    return this.authService.canDeleteTransfusion();
  }

  /**
   * Vérifie si l'utilisateur a des actions disponibles sur cette transfusion
   */
  showActionButtons(transfusion: Transfusion): boolean {
    return this.authService.canUpdateTransfusion() || 
           this.authService.canDeleteTransfusion();
  }

  /* ---------- UTILITAIRES ---------- */
  private setupSearchDebounce() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(term => {
      this.searchTerm.set(term);
      this.updateDataSource();
    });
  }

  private updateDataSource() {
    this.dataSource.data = this.filteredTransfusions();
    // Reset pagination
    setTimeout(() => {
      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    });
  }

  /**
   * Charge la liste des transfusions
   */
getTransfusions() {
  this.loadingIndicator.set(true);
  
  this.transfusionService.getAll()
    .pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingIndicator.set(false)),
      catchError(error => {
        console.error('Erreur chargement transfusions:', error);
        this.showNotification('error', 'Erreur lors du chargement des transfusions');
        return of([]);
      })
    )
    .subscribe({
      next: (transfusions: Transfusion[]) => {
        console.log('🔍 Transfusions chargées (brutes):', transfusions.length);
        
        // Appliquer le filtre de permission
        const filteredTransfusions = this.authService.filterTransfusionsByPermission(transfusions);
        
        console.log('🔍 Transfusions après filtrage:', {
          totalAvant: transfusions.length,
          totalApres: filteredTransfusions.length
        });
        
        // Formater les dates pour l'affichage
        const formattedTransfusions = filteredTransfusions.map(t => this.formatTransfusionForDisplay(t));
        this.allTransfusions.set(formattedTransfusions);
        this.updateDataSource();
        this.showNotification('success', `${formattedTransfusions.length} transfusion(s) chargée(s)`);
      }
    });
}

  /**
   * Formate une transfusion pour l'affichage
   */
  private formatTransfusionForDisplay(transfusion: Transfusion): Transfusion {
    return {
      ...transfusion,
      // Formater les dates pour l'affichage
      patientDateNaissance: this.formatDateForDisplay(transfusion.patientDateNaissance),
      dateTransfusion: this.formatDateForDisplay(transfusion.dateTransfusion)
    };
  }

  /**
   * Formate une date pour l'affichage (dd/MM/yyyy)
   */
  private formatDateForDisplay(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateString;
    }
  }

  /**
   * Recherche dans une transfusion
   */
  private searchInTransfusion(transfusion: Transfusion, searchTerm: string): boolean {
    const searchFields = [
      transfusion.patientNom,
      transfusion.patientPrenom,
      transfusion.patientNumDossier,
      transfusion.groupeSanguinPatient,
      transfusion.medecin?.nom,
      transfusion.medecin?.prenom,
      transfusion.produitSanguin?.codeProduit,
      transfusion.produitSanguin?.typeProduit,
      transfusion.tolerance,
      transfusion.etatPatientApres,
      transfusion.nomDeclarant,
      transfusion.prenomDeclarant,
      transfusion.fonctionDeclarant
    ];

    return searchFields.some(field => 
      field?.toLowerCase().includes(searchTerm)
    );
  }

  /**
   * Filtre par tolérance
   */
  onToleranceFilterChange(event: any) {
    this.selectedTolerance.set(event.value);
    this.updateDataSource();
  }

  /**
   * Filtre par effets indésirables
   */
  onEffetsFilterChange(event: any) {
    this.selectedEffetsIndesirables.set(event.value);
    this.updateDataSource();
  }

  /**
   * Filtre par recherche texte avec debounce
   */
  onFilterChange(event: any) {
    this.searchSubject.next(event.target.value);
  }

  /**
   * Réinitialise tous les filtres
   */
  resetFilters() {
    this.selectedTolerance.set('TOUTES');
    this.selectedEffetsIndesirables.set('TOUS');
    this.searchTerm.set('');
    this.updateDataSource();
  }

  /* ---------- VISUEL ---------- */
  /**
   * Obtient la couleur du badge selon la tolérance
   */
  getToleranceBadgeClass(tolerance: string): string {
    if (tolerance === 'Bonne') return 'badge bg-success';
    if (tolerance === 'Moyenne') return 'badge bg-warning text-dark';
    if (tolerance === 'Mauvaise') return 'badge bg-danger';
    return 'badge bg-secondary';
  }

  /**
   * Obtient l'icône selon la tolérance
   */
  getToleranceIcon(tolerance: string): string {
    if (tolerance === 'Bonne') return 'thumb_up';
    if (tolerance === 'Moyenne') return 'thumbs_up_down';
    return 'thumb_down';
  }

  /**
   * Obtient la couleur du badge selon les effets indésirables
   */
  getEffetsBadgeClass(effetsIndesirables: boolean): string {
    return effetsIndesirables ? 'badge bg-warning text-dark' : 'badge bg-success';
  }

  /**
   * Obtient l'icône selon les effets indésirables
   */
  getEffetsIcon(effetsIndesirables: boolean): string {
    return effetsIndesirables ? 'warning' : 'check_circle';
  }

  /**
   * Obtient le texte selon les effets indésirables
   */
  getEffetsText(effetsIndesirables: boolean): string {
    return effetsIndesirables ? 'OUI' : 'NON';
  }

  /**
   * Calcule la moyenne des pouls
   */
  getAveragePouls(surveillances: any[]): number {
    if (!surveillances || surveillances.length === 0) return 0;
    
    const validPouls = surveillances
      .map(s => s.pouls)
      .filter(pouls => pouls !== null && pouls !== undefined && !isNaN(Number(pouls)));
    
    if (validPouls.length === 0) return 0;
    
    const sum = validPouls.reduce((acc, pouls) => acc + Number(pouls), 0);
    return Math.round(sum / validPouls.length);
  }

  /**
   * Calcule la moyenne des températures
   */
  getAverageTemperature(surveillances: any[]): number {
    if (!surveillances || surveillances.length === 0) return 0;
    
    const validTemps = surveillances
      .map(s => s.temperature)
      .filter(temp => temp !== null && temp !== undefined && !isNaN(Number(temp)));
    
    if (validTemps.length === 0) return 0;
    
    const sum = validTemps.reduce((acc, temp) => acc + Number(temp), 0);
    return Math.round((sum / validTemps.length) * 10) / 10;
  }

  /**
   * Formate une date simple
   */
  formatDate(dateString: string): string {
    return this.formatDateForDisplay(dateString);
  }

  /* ---------- GESTION DES TRANSFUSIONS ---------- */
  /**
   * Ouvre la modale d'information
   */
  openInfoModal(template: TemplateRef<any>, transfusion: Transfusion) {
    this.selectedTransfusion.set(this.formatTransfusionForDisplay(transfusion));
    this.modalRef.set(this.modalService.show(template, { 
      class: 'modal-lg modal-dialog-scrollable',
      ignoreBackdropClick: true,
      keyboard: false,
      backdrop: 'static'
    }));
  }

  /**
   * Ouvre le formulaire de création
   */
  openCreateForm() {
    // Vérification des permissions
    if (!this.authService.canCreateTransfusion()) {
      this.showNotification('error', '❌ Vous n\'avez pas les droits pour créer des transfusions');
      return;
    }
    
    console.log('🟢 Bouton Nouvelle Transfusion cliqué');
    
    // Navigation vers la route 'creer' qui est définie comme enfant
    this.router.navigate(['creer'], { 
      relativeTo: this.route 
    }).then(success => {
      console.log('✅ Navigation résultat:', success);
      
      if (!success) {
        // Fallback vers une navigation absolue
        console.log('🧪 Tentative navigation absolue');
        this.router.navigate(['/app/transfusions/creer']);
      }
    });
  }

  /**
   * Ouvre le formulaire d'édition
   */
  openEditForm(transfusion: Transfusion) {
    // Vérification des permissions
    if (!this.authService.canUpdateTransfusion()) {
      this.showNotification('error', '❌ Vous n\'avez pas les droits pour modifier des transfusions');
      return;
    }
    
    if (transfusion.id) {
      this.router.navigate(['editer', transfusion.id], { 
        relativeTo: this.route 
      });
    } else {
      console.error('ID de transfusion manquant pour l\'édition');
      this.showNotification('error', 'Impossible d\'éditer: ID manquant');
    }
  }

  /**
   * Ouvre le formulaire de visualisation
   */
  openViewForm(transfusion: Transfusion) {
    if (transfusion.id) {
      this.router.navigate(['visualisation', transfusion.id], { relativeTo: this.route });
    } else {
      console.error('ID de transfusion manquant pour la visualisation');
      this.showNotification('error', 'Impossible de visualiser: ID manquant');
    }
  }

  /**
   * Prépare une transfusion pour l'édition (convertit les dates au format backend)
   */
  private prepareTransfusionForEdit(transfusion: Transfusion): Transfusion {
    // Créer une copie pour éviter les mutations
    const transfusionCopy = { ...transfusion };
    
    // Convertir les dates au format backend
    if (transfusionCopy.patientDateNaissance) {
      transfusionCopy.patientDateNaissance = this.convertToBackendDateFormat(transfusionCopy.patientDateNaissance);
    }
    
    if (transfusionCopy.dateTransfusion) {
      transfusionCopy.dateTransfusion = this.convertToBackendDateFormat(transfusionCopy.dateTransfusion);
    }
    
    // S'assurer que les IDs sont définis
    if (transfusionCopy.medecin && transfusionCopy.medecin.id) {
      transfusionCopy.medecinId = transfusionCopy.medecin.id;
    }
    
    if (transfusionCopy.produitSanguin && transfusionCopy.produitSanguin.id) {
      transfusionCopy.produitSanguinId = transfusionCopy.produitSanguin.id;
    }
    
    return transfusionCopy;
  }

  /**
   * Convertit une date au format backend (YYYY-MM-DD)
   */
  private convertToBackendDateFormat(dateString: string): string {
    if (!dateString) return '';
    
    try {
      // Si c'est déjà au format YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      
      // Sinon, tenter de convertir depuis dd/MM/yyyy
      const parts = dateString.split('/');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      
      // Si c'est une date JavaScript
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch {
      // En cas d'erreur, retourner la chaîne originale
    }
    
    return dateString;
  }

  /**
   * Ferme la modale
   */
  closeTransfusionModal() {
    this.modalRef()?.hide();
    this.selectedTransfusion.set(null);
  }

  /**
   * Supprime une transfusion
   */
  deleteTransfusion(transfusion: Transfusion) {
    // Vérification des permissions
    if (!this.authService.canDeleteTransfusion()) {
      this.showNotification('error', '❌ Vous n\'avez pas les droits pour supprimer des transfusions');
      return;
    }
    
    if (!transfusion.id) {
      this.showNotification('error', 'Impossible de supprimer: ID manquant');
      return;
    }

    const confirmation = window.confirm(
      `Êtes-vous sûr de vouloir supprimer cette transfusion ?\n\n` +
      `Patient: ${transfusion.patientPrenom} ${transfusion.patientNom}\n` +
      `Groupe sanguin: ${transfusion.groupeSanguinPatient}\n\n` +
      `⚠️ Cette action est irréversible !`
    );

    if (!confirmation) return;

    this.savingIndicator.set(true);
    
    this.transfusionService.delete(transfusion.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.savingIndicator.set(false)),
        catchError(error => {
          console.error('Erreur suppression transfusion:', error);
          this.showNotification('error', 'Erreur lors de la suppression');
          return of(null);
        })
      )
      .subscribe({
        next: () => {
          this.allTransfusions.update(list => 
            list.filter(t => t.id !== transfusion.id)
          );
          this.updateDataSource();
          this.showNotification('success', 'Transfusion supprimée avec succès !');
        }
      });
  }

  /* ---------- EXPORT ---------- */
  /**
   * Export Excel
   */
  exportToExcel() {
    const data = this.filteredTransfusions();
    
    if (data.length === 0) {
      this.showNotification('warning', 'Aucune donnée à exporter');
      return;
    }

    this.exportingIndicator.set(true);

    try {
      // Préparer les données pour l'export
      const exportData = data.map(transfusion => ({
        'Nom Patient': transfusion.patientNom || '',
        'Prénom Patient': transfusion.patientPrenom || '',
        'N° Dossier': transfusion.patientNumDossier || '',
        'Date Naissance': transfusion.patientDateNaissance || '',
        'Groupe Sanguin': transfusion.groupeSanguinPatient || '',
        'Médecin': transfusion.medecin ? 
          `${transfusion.medecin.prenom} ${transfusion.medecin.nom}` : 'N/A',
        'Spécialité': transfusion.medecin?.specialite || 'N/A',
        'Produit Sanguin': transfusion.produitSanguin ? 
          `${transfusion.produitSanguin.codeProduit} (${transfusion.produitSanguin.groupeSanguin})` : 'N/A',
        'Type Produit': transfusion.produitSanguin?.typeProduit || 'N/A',
        'Tolérance': transfusion.tolerance || '',
        'Effets Indésirables': transfusion.effetsIndesirables ? 'OUI' : 'NON',
        'Type Effet': transfusion.typeEffet || '',
        'État Patient Après': transfusion.etatPatientApres || '',
        'Volume (ml)': transfusion.volumeMl || '',
        'Date Transfusion': transfusion.dateTransfusion || '',
        'Heure Début': transfusion.heureDebut || '',
        'Heure Fin': transfusion.heureFin || '',
        'Déclarant': `${transfusion.prenomDeclarant} ${transfusion.nomDeclarant}`,
        'Fonction Déclarant': transfusion.fonctionDeclarant || '',
        'Notes': transfusion.notes || ''
      }));

      // Créer le worksheet
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
      
      // Définir les largeurs de colonnes
      const wscols = [
        { wch: 20 }, { wch: 15 }, { wch: 12 },
        { wch: 15 }, { wch: 10 }, { wch: 20 },
        { wch: 15 }, { wch: 25 }, { wch: 15 },
        { wch: 12 }, { wch: 15 }, { wch: 15 },
        { wch: 15 }, { wch: 10 }, { wch: 15 },
        { wch: 10 }, { wch: 10 }, { wch: 25 },
        { wch: 15 }, { wch: 30 }
      ];
      ws['!cols'] = wscols;
      
      // Créer le workbook
      const wb: XLSX.WorkBook = { 
        Sheets: { 'Transfusions': ws }, 
        SheetNames: ['Transfusions'] 
      };
      
      // Générer le fichier Excel
      const excelBuffer: any = XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array'
      });
      
      // Créer le blob et télécharger
      const blob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const fileName = `transfusions_${new Date().toISOString().slice(0,10)}_${Date.now()}.xlsx`;
      saveAs(blob, fileName);
      
      this.showNotification('success', `Fichier exporté: ${fileName}`);
      
    } catch (error: any) {
      console.error('Erreur export Excel:', error);
      this.showNotification('error', 'Erreur lors de l\'export Excel');
    } finally {
      this.exportingIndicator.set(false);
    }
  }

  /* ---------- UTILITAIRES ---------- */
  /**
   * Affiche une notification
   */
  private showNotification(type: 'success' | 'error' | 'info' | 'warning', message: string) {
    const duration = type === 'error' ? 5000 : 3000;
    
    this.snackBar.open(message, 'Fermer', {
      duration: duration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [`snackbar-${type}`]
    });
  }

  /**
   * Obtient le nombre total de transfusions filtrées
   */
  getFilteredCount(): number {
    return this.filteredTransfusions().length;
  }

  /**
   * Obtient le nombre total de transfusions
   */
  getTotalCount(): number {
    return this.allTransfusions().length;
  }

  /**
   * Rafraîchit les données
   */
  refreshData() {
    this.getTransfusions();
  }

  /**
   * Vérifie si des filtres sont actifs
   */
  hasActiveFilters(): boolean {
    return (
      this.selectedTolerance() !== 'TOUTES' ||
      this.selectedEffetsIndesirables() !== 'TOUS' ||
      this.searchTerm().length > 0
    );
  }

  /**
   * Récupère les statistiques
   */
  getStatistics() {
    const data = this.allTransfusions();
    
    const stats = {
      total: data.length,
      bonneTolerance: data.filter(t => t.tolerance === 'Bonne').length,
      moyenneTolerance: data.filter(t => t.tolerance === 'Moyenne').length,
      mauvaiseTolerance: data.filter(t => t.tolerance === 'Mauvaise').length,
      avecEffets: data.filter(t => t.effetsIndesirables).length,
      sansEffets: data.filter(t => !t.effetsIndesirables).length
    };

    const message = 
      `Statistiques:\n` +
      `Total: ${stats.total} transfusion(s)\n` +
      `Bonne tolérance: ${stats.bonneTolerance}\n` +
      `Tolérance moyenne: ${stats.moyenneTolerance}\n` +
      `Mauvaise tolérance: ${stats.mauvaiseTolerance}\n` +
      `Avec effets indésirables: ${stats.avecEffets}\n` +
      `Sans effets indésirables: ${stats.sansEffets}`;

    this.showNotification('info', message);

    return stats;
  }

  /**
   * Formate une date avec heure (si disponible)
   */
  formatDateWithTime(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      
      // Si l'heure est 00:00, n'afficher que la date
      if (hours === '00' && minutes === '00') {
        return `${day}/${month}/${year}`;
      }
      
      return `${day}/${month}/${year} ${hours}:${minutes}`;
    } catch {
      return dateString;
    }
  }

  /**
   * Méthode pour retourner à la liste
   */
  backToList() {
    this.router.navigate(['.'], { relativeTo: this.route });
  }

  
}