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
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ModalModule, BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, finalize, catchError, of } from 'rxjs';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

import { Transfusion } from '../../../interfaces/transfusion.interface';
import { TransfusionService } from '../../../services/transfusion.service';
import { AuthService } from '../../../services/auth.service';

interface FiltreOption {
  value: string;
  label: string;
  icon: string;
}

type TransfusionViewMode = 'table' | 'cards' | 'timeline';

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
  private modalService = inject(BsModalService);
  private transfusionService = inject(TransfusionService);
  private snackBar = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  public authService = inject(AuthService);

  private allTransfusions = signal<Transfusion[]>([]);
  modalRef = signal<BsModalRef | null>(null);
  selectedTransfusion = signal<Transfusion | null>(null);

  loadingIndicator = signal<boolean>(false);
  savingIndicator = signal<boolean>(false);
  exportingIndicator = signal<boolean>(false);

  viewMode = signal<TransfusionViewMode>('table');

  searchTerm = signal<string>('');
  private searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  selectedTolerance = signal<string>('TOUTES');
  selectedEffetsIndesirables = signal<string>('TOUS');
  selectedGroupeSanguin = signal<string>('TOUS');
  selectedMedecin = signal<string>('TOUS');
  selectedEtatPatientApres = signal<string>('TOUS');
  dateDebut = signal<string>('');
  dateFin = signal<string>('');

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

  filteredTransfusions = computed(() => {
    const data = this.allTransfusions();
    const searchTerm = this.searchTerm().toLowerCase().trim();
    const selectedTolerance = this.selectedTolerance();
    const selectedEffets = this.selectedEffetsIndesirables();
    const selectedGroupe = this.selectedGroupeSanguin();
    const selectedMedecin = this.selectedMedecin();
    const selectedEtat = this.selectedEtatPatientApres();
    const dateDebut = this.dateDebut();
    const dateFin = this.dateFin();

    let filtered = [...data];

    if (searchTerm) {
      filtered = filtered.filter(item => this.searchInTransfusion(item, searchTerm));
    }

    if (selectedTolerance !== 'TOUTES') {
      filtered = filtered.filter(item => item.tolerance === selectedTolerance);
    }

    if (selectedEffets !== 'TOUS') {
      filtered = filtered.filter(item =>
        selectedEffets === 'AVEC' ? !!item.effetsIndesirables : !item.effetsIndesirables
      );
    }

    if (selectedGroupe !== 'TOUS') {
      filtered = filtered.filter(item => item.groupeSanguinPatient === selectedGroupe);
    }

    if (selectedMedecin !== 'TOUS') {
      filtered = filtered.filter(item => this.getMedecinDisplay(item) === selectedMedecin);
    }

    if (selectedEtat !== 'TOUS') {
      filtered = filtered.filter(item => (item.etatPatientApres || '') === selectedEtat);
    }

    if (dateDebut) {
      const debut = new Date(dateDebut);
      debut.setHours(0, 0, 0, 0);
      filtered = filtered.filter(item => {
        const date = this.parseDate(item.dateTransfusion);
        return !!date && date >= debut;
      });
    }

    if (dateFin) {
      const fin = new Date(dateFin);
      fin.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => {
        const date = this.parseDate(item.dateTransfusion);
        return !!date && date <= fin;
      });
    }

    return filtered;
  });

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
  @ViewChild('infoModalTemplate') infoModalTemplate?: TemplateRef<any>;

  ngOnInit() {
    this.setupSearchDebounce();
    this.getTransfusions();
    this.initializeUserPermissions();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.updateDataSource();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSubject.complete();
  }

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

  setViewMode(mode: TransfusionViewMode): void {
    this.viewMode.set(mode);
  }

  getViewMode(): TransfusionViewMode {
    return this.viewMode();
  }

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
          const filteredByPermissions = this.authService.filterTransfusionsByPermission(transfusions || []);
          this.allTransfusions.set(filteredByPermissions || []);
          this.updateDataSource();
          this.showNotification('success', `${filteredByPermissions.length} transfusion(s) chargée(s)`);
        }
      });
  }

  private parseDate(dateValue: string | undefined | null): Date | null {
    if (!dateValue) return null;
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  }

  formatDateForDisplay(dateValue: string | undefined | null): string {
    const date = this.parseDate(dateValue);
    if (!date) return dateValue || '';
    return date.toLocaleDateString('fr-FR');
  }

  formatDateTimeForDisplay(dateValue: string | undefined | null): string {
    const date = this.parseDate(dateValue);
    if (!date) return dateValue || '';
    return date.toLocaleString('fr-FR');
  }

  private searchInTransfusion(transfusion: Transfusion, searchTerm: string): boolean {
    const searchFields = [
      transfusion.patientNom,
      transfusion.patientPrenom,
      transfusion.patientNumDossier,
      transfusion.groupeSanguinPatient,
      transfusion.medecin?.nom,
      transfusion.medecin?.prenom,
      transfusion.medecin?.specialite,
      transfusion.produitSanguin?.codeProduit,
      transfusion.produitSanguin?.typeProduit,
      transfusion.tolerance,
      transfusion.etatPatientApres,
      transfusion.nomDeclarant,
      transfusion.prenomDeclarant,
      transfusion.fonctionDeclarant,
      transfusion.typeEffet,
      transfusion.graviteEffet,
      transfusion.notes
    ];

    return searchFields.some(field => (field || '').toLowerCase().includes(searchTerm));
  }

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

    setTimeout(() => {
      if (this.dataSource.paginator) {
        this.dataSource.paginator.firstPage();
      }
    });
  }

  refreshData() {
    this.getTransfusions();
  }

  onToleranceFilterChange(event: any) {
    this.selectedTolerance.set(event.value);
    this.updateDataSource();
  }

  onEffetsFilterChange(event: any) {
    this.selectedEffetsIndesirables.set(event.value);
    this.updateDataSource();
  }

  onGroupeFilterChange(event: any) {
    this.selectedGroupeSanguin.set(event.value);
    this.updateDataSource();
  }

  onMedecinFilterChange(event: any) {
    this.selectedMedecin.set(event.value);
    this.updateDataSource();
  }

  onEtatPatientFilterChange(event: any) {
    this.selectedEtatPatientApres.set(event.value);
    this.updateDataSource();
  }

  onDateDebutChange(event: any) {
    this.dateDebut.set(event?.target?.value || '');
    this.updateDataSource();
  }

  onDateFinChange(event: any) {
    this.dateFin.set(event?.target?.value || '');
    this.updateDataSource();
  }

  onFilterChange(event: any) {
    this.searchSubject.next(event.target.value || '');
  }

  resetFilters() {
    this.selectedTolerance.set('TOUTES');
    this.selectedEffetsIndesirables.set('TOUS');
    this.selectedGroupeSanguin.set('TOUS');
    this.selectedMedecin.set('TOUS');
    this.selectedEtatPatientApres.set('TOUS');
    this.dateDebut.set('');
    this.dateFin.set('');
    this.searchTerm.set('');
    this.updateDataSource();
  }

  hasActiveFilters(): boolean {
    return (
      this.selectedTolerance() !== 'TOUTES' ||
      this.selectedEffetsIndesirables() !== 'TOUS' ||
      this.selectedGroupeSanguin() !== 'TOUS' ||
      this.selectedMedecin() !== 'TOUS' ||
      this.selectedEtatPatientApres() !== 'TOUS' ||
      this.dateDebut().length > 0 ||
      this.dateFin().length > 0 ||
      this.searchTerm().length > 0
    );
  }

  getGroupesSanguinsDisponibles(): string[] {
    const groupes = this.allTransfusions()
      .map(t => t.groupeSanguinPatient)
      .filter((x): x is string => !!x && x.trim().length > 0);
    return Array.from(new Set(groupes)).sort();
  }

  getMedecinsDisponibles(): string[] {
    const medecins = this.allTransfusions()
      .map(t => this.getMedecinDisplay(t))
      .filter((x): x is string => !!x && x.trim().length > 0);
    return Array.from(new Set(medecins)).sort();
  }

  getEtatsPatientDisponibles(): string[] {
    const etats = this.allTransfusions()
      .map(t => t.etatPatientApres)
      .filter((x): x is string => !!x && x.trim().length > 0);
    return Array.from(new Set(etats)).sort();
  }

  getFilteredCount(): number {
    return this.filteredTransfusions().length;
  }

  getTotalCount(): number {
    return this.allTransfusions().length;
  }

  getBonneToleranceCount(): number {
    return this.filteredTransfusions().filter(t => t.tolerance === 'Bonne').length;
  }

  getToleranceMoyenneCount(): number {
    return this.filteredTransfusions().filter(t => t.tolerance === 'Moyenne').length;
  }

  getMauvaiseToleranceCount(): number {
    return this.filteredTransfusions().filter(t => t.tolerance === 'Mauvaise').length;
  }

  getAvecEffetsCount(): number {
    return this.filteredTransfusions().filter(t => !!t.effetsIndesirables).length;
  }

  getSansEffetsCount(): number {
    return this.filteredTransfusions().filter(t => !t.effetsIndesirables).length;
  }

  getSurveillancesCount(): number {
    return this.filteredTransfusions().reduce((acc, t) => acc + (t.surveillances?.length || 0), 0);
  }

  getDernieresTransfusionsCount(): number {
    const now = new Date();
    return this.filteredTransfusions().filter(t => {
      const d = this.parseDate(t.dateTransfusion);
      if (!d) return false;
      const diff = now.getTime() - d.getTime();
      return diff <= 7 * 24 * 60 * 60 * 1000;
    }).length;
  }

  getToleranceBadgeClass(tolerance: string): string {
    if (tolerance === 'Bonne') return 'badge bg-success';
    if (tolerance === 'Moyenne') return 'badge bg-warning text-dark';
    if (tolerance === 'Mauvaise') return 'badge bg-danger';
    return 'badge bg-secondary';
  }

  getToleranceIcon(tolerance: string): string {
    if (tolerance === 'Bonne') return 'thumb_up';
    if (tolerance === 'Moyenne') return 'thumbs_up_down';
    if (tolerance === 'Mauvaise') return 'thumb_down';
    return 'help';
  }

  getEffetsBadgeClass(effetsIndesirables: boolean): string {
    return effetsIndesirables ? 'badge bg-warning text-dark' : 'badge bg-success';
  }

  getEffetsIcon(effetsIndesirables: boolean): string {
    return effetsIndesirables ? 'warning' : 'check_circle';
  }

  getEffetsText(effetsIndesirables: boolean): string {
    return effetsIndesirables ? 'OUI' : 'NON';
  }

  getCardBorderClass(transfusion: Transfusion): string {
    if (transfusion.effetsIndesirables) return 'transfusion-card-incident';

    switch (transfusion.tolerance) {
      case 'Bonne':
        return 'transfusion-card-bonne';
      case 'Moyenne':
        return 'transfusion-card-moyenne';
      case 'Mauvaise':
        return 'transfusion-card-mauvaise';
      default:
        return 'transfusion-card-default';
    }
  }

  getTimelineClass(transfusion: Transfusion): string {
    if (transfusion.effetsIndesirables) return 'timeline-marker-incident';

    switch (transfusion.tolerance) {
      case 'Bonne':
        return 'timeline-marker-bonne';
      case 'Moyenne':
        return 'timeline-marker-moyenne';
      case 'Mauvaise':
        return 'timeline-marker-mauvaise';
      default:
        return 'timeline-marker-default';
    }
  }

  getMedecinDisplay(transfusion: Transfusion): string {
    if (!transfusion.medecin) return 'N/A';
    return `Dr ${transfusion.medecin.prenom || ''} ${transfusion.medecin.nom || ''}`.trim();
  }

  getProduitDisplay(transfusion: Transfusion): string {
    if (!transfusion.produitSanguin) return 'N/A';
    return `${transfusion.produitSanguin.codeProduit} - ${transfusion.produitSanguin.typeProduit}`;
  }

  getTimelineDateLabel(transfusion: Transfusion): string {
    return this.formatDateForDisplay(transfusion.dateTransfusion);
  }

  getAveragePouls(surveillances: any[]): number {
    if (!surveillances || surveillances.length === 0) return 0;

    const validPouls = surveillances
      .map(s => s.pouls)
      .filter(pouls => pouls !== null && pouls !== undefined && !isNaN(Number(pouls)));

    if (validPouls.length === 0) return 0;

    const sum = validPouls.reduce((acc, pouls) => acc + Number(pouls), 0);
    return Math.round(sum / validPouls.length);
  }

  getAverageTemperature(surveillances: any[]): number {
    if (!surveillances || surveillances.length === 0) return 0;

    const validTemps = surveillances
      .map(s => s.temperature)
      .filter(temp => temp !== null && temp !== undefined && !isNaN(Number(temp)));

    if (validTemps.length === 0) return 0;

    const sum = validTemps.reduce((acc, temp) => acc + Number(temp), 0);
    return Math.round((sum / validTemps.length) * 10) / 10;
  }

  openInfoModal(template: TemplateRef<any>, transfusion: Transfusion) {
    this.selectedTransfusion.set(transfusion);
    this.modalRef.set(this.modalService.show(template, {
      class: 'modal-lg modal-dialog-scrollable',
      ignoreBackdropClick: true,
      keyboard: false,
      backdrop: 'static'
    }));
  }

  closeTransfusionModal() {
    this.modalRef()?.hide();
    this.modalRef.set(null);
    this.selectedTransfusion.set(null);
  }

  openCreateForm() {
    if (!this.authService.canCreateTransfusion()) {
      this.showNotification('error', '❌ Vous n\'avez pas les droits pour créer des transfusions');
      return;
    }

    this.router.navigate(['creer'], {
      relativeTo: this.route
    }).then(success => {
      if (!success) {
        this.router.navigate(['/app/transfusions/creer']);
      }
    });
  }

  openEditForm(transfusion: Transfusion) {
    if (!this.authService.canUpdateTransfusion()) {
      this.showNotification('error', '❌ Vous n\'avez pas les droits pour modifier des transfusions');
      return;
    }

    if (transfusion.id) {
      this.router.navigate(['modifier', transfusion.id], {
        relativeTo: this.route
      });
    } else {
      this.showNotification('error', 'Impossible d’éditer : ID manquant');
    }
  }

  openViewForm(transfusion: Transfusion) {
    if (transfusion.id) {
      this.openInfoModal(this.infoModalTemplate!, transfusion);
    } else {
      this.showNotification('error', 'Impossible de visualiser : ID manquant');
    }
  }

  deleteTransfusion(transfusion: Transfusion) {
    if (!this.authService.canDeleteTransfusion()) {
      this.showNotification('error', '❌ Vous n\'avez pas les droits pour supprimer des transfusions');
      return;
    }

    if (!transfusion.id) {
      this.showNotification('error', 'ID de transfusion manquant');
      return;
    }

    const confirmation = confirm(
      `Êtes-vous sûr de vouloir supprimer cette transfusion ?\n\n` +
      `Patient : ${transfusion.patientPrenom} ${transfusion.patientNom}`
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
      .subscribe(result => {
        if (result === null) return;

        this.allTransfusions.update(list => list.filter(t => t.id !== transfusion.id));
        this.updateDataSource();
        this.showNotification('success', 'Transfusion supprimée avec succès');
      });
  }

  exportToExcel() {
    const transfusions = this.filteredTransfusions();

    if (transfusions.length === 0) {
      this.showNotification('warning', 'Aucune donnée à exporter');
      return;
    }

    this.exportingIndicator.set(true);

    try {
      const excelData = transfusions.map(t => ({
        'Nom Patient': t.patientNom,
        'Prénom Patient': t.patientPrenom,
        'Dossier': t.patientNumDossier,
        'Groupe Sanguin': t.groupeSanguinPatient,
        'Produit': t.produitSanguin?.codeProduit || 'N/A',
        'Type Produit': t.produitSanguin?.typeProduit || 'N/A',
        'Médecin': this.getMedecinDisplay(t),
        'Tolérance': t.tolerance,
        'Effets Indésirables': this.getEffetsText(!!t.effetsIndesirables),
        'État Patient Après': t.etatPatientApres,
        'Déclarant': `${t.prenomDeclarant || ''} ${t.nomDeclarant || ''}`.trim(),
        'Fonction Déclarant': t.fonctionDeclarant || '',
        'Date Transfusion': this.formatDateTimeForDisplay(t.dateTransfusion),
        'Type Effet': t.typeEffet || '',
        'Gravité Effet': t.graviteEffet || '',
        'Notes': t.notes || '',
        'Nb Surveillances': t.surveillances?.length || 0
      }));

      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(excelData);

      ws['!cols'] = [
        { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
        { wch: 18 }, { wch: 24 }, { wch: 12 }, { wch: 16 }, { wch: 18 },
        { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 20 },
        { wch: 14 }
      ];

      const wb: XLSX.WorkBook = {
        Sheets: { 'Transfusions': ws },
        SheetNames: ['Transfusions']
      };

      const excelBuffer: ArrayBuffer = XLSX.write(wb, {
        bookType: 'xlsx',
        type: 'array'
      });

      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const fileName = `transfusions_${new Date().toISOString().slice(0, 10)}_${Date.now()}.xlsx`;
      saveAs(blob, fileName);

      this.showNotification('success', `Fichier exporté : ${fileName}`);
    } catch (error: any) {
      console.error('Erreur export Excel:', error);
      this.showNotification('error', 'Erreur lors de l’export Excel');
    } finally {
      this.exportingIndicator.set(false);
    }
  }

  getStatistics() {
    const data = this.filteredTransfusions();

    const stats = {
      total: data.length,
      bonneTolerance: data.filter(t => t.tolerance === 'Bonne').length,
      moyenneTolerance: data.filter(t => t.tolerance === 'Moyenne').length,
      mauvaiseTolerance: data.filter(t => t.tolerance === 'Mauvaise').length,
      avecEffets: data.filter(t => t.effetsIndesirables).length,
      sansEffets: data.filter(t => !t.effetsIndesirables).length,
      surveillances: data.reduce((acc, t) => acc + (t.surveillances?.length || 0), 0)
    };

    this.showNotification(
      'info',
      `Total: ${stats.total} | Bonne: ${stats.bonneTolerance} | Moyenne: ${stats.moyenneTolerance} | Mauvaise: ${stats.mauvaiseTolerance} | Avec effets: ${stats.avecEffets}`
    );
  }

  private showNotification(type: 'success' | 'error' | 'info' | 'warning', message: string) {
    const duration = type === 'error' ? 5000 : 3000;

    this.snackBar.open(message, 'Fermer', {
      duration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [`snackbar-${type}`]
    });
  }
}