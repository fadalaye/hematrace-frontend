import { Component, OnInit, ViewChild, AfterViewInit, TemplateRef, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TracabiliteService, TraceElement, SearchFilters, TraceStatistics } from '../../../services/tracabilite.service';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CommonModule } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-tracabilite',
  templateUrl: './tracabilite.component.html',
  styleUrls: ['./tracabilite.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatDialogModule
  ]
})
export class TracabiliteComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  searchForm: FormGroup;
  searchResults = new MatTableDataSource<TraceElement>([]);
  displayedColumns: string[] = ['type', 'reference', 'description', 'date', 'status', 'user', 'actions'];
  
  isLoading = false;
  totalResults = 0;
  statistics: TraceStatistics | null = null;
  today = new Date();
  
  entityTypes = [
    { value: '', label: 'Tous' },
    { value: 'produit', label: 'Produits Sanguins' },
    { value: 'demande', label: 'Demandes' },
    { value: 'delivrance', label: 'Délivrances' },
    { value: 'transfusion', label: 'Transfusions' },
    { value: 'incident', label: 'Incidents' },
    { value: 'surveillance', label: 'Surveillances' },
    { value: 'log', label: 'Logs de traçabilité' }
  ];
  
  statuses = [
    { value: '', label: 'Tous' },
    { value: 'DISPONIBLE', label: 'Disponible' },
    { value: 'EN_ATTENTE', label: 'En attente' },
    { value: 'VALIDE', label: 'Validé' },
    { value: 'NON_VALIDE', label: 'Non validé' },
    { value: 'COMPLETE', label: 'Complété' },
    { value: 'EN_COURS', label: 'En cours' },
    { value: 'ANNULE', label: 'Annulé' },
    { value: 'LOGUE', label: 'Logué' }
  ];

  constructor(
    private fb: FormBuilder,
    private tracabiliteService: TracabiliteService,
    private router: Router,
    private dialog: MatDialog
  ) {
    this.searchForm = this.fb.group({
      query: [''],
      type: [''],
      dateDebut: [''],
      dateFin: [''],
      reference: [''],
      utilisateur: [''],
      statut: ['']
    });
  }

  ngOnInit() {
    this.rechercherRecents();
    this.chargerStatistiques();
  }

  ngAfterViewInit() {
    this.searchResults.paginator = this.paginator;
    this.searchResults.sort = this.sort;
  }

  rechercherRecents() {
    this.isLoading = true;
    this.tracabiliteService.getRecentActivity(20).subscribe({
      next: (results) => {
        this.searchResults.data = results;
        this.totalResults = results.length;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors de la recherche récente:', error);
        this.isLoading = false;
      }
    });
  }

  onSearch() {
    if (this.searchForm.invalid) return;
    
    this.isLoading = true;
    const filters: SearchFilters = this.prepareFilters();
    
    this.tracabiliteService.rechercherGlobalement(filters).subscribe({
      next: (results) => {
        this.searchResults.data = results;
        this.totalResults = results.length;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Erreur lors de la recherche:', error);
        this.isLoading = false;
      }
    });
  }

  private prepareFilters(): SearchFilters {
    const formValue = this.searchForm.value;
    const filters: SearchFilters = {};
    
    if (formValue.query) filters.query = formValue.query;
    if (formValue.type) filters.type = formValue.type;
    if (formValue.reference) filters.reference = formValue.reference;
    if (formValue.utilisateur) filters.utilisateur = formValue.utilisateur;
    if (formValue.statut) filters.statut = formValue.statut;
    if (formValue.dateDebut) filters.dateDebut = new Date(formValue.dateDebut);
    if (formValue.dateFin) filters.dateFin = new Date(formValue.dateFin);
    
    return filters;
  }

  onReset() {
    this.searchForm.reset();
    this.rechercherRecents();
  }

  exporter(format: 'csv' | 'excel') {
    const filters = this.prepareFilters();
    
    this.tracabiliteService.exporterResultats(filters, format).subscribe({
      next: () => {
        console.log('Export réussi');
      },
      error: (error) => {
        console.error('Erreur lors de l\'export:', error);
        alert('Erreur lors de l\'export des données');
      }
    });
  }

  voirDetails(element: TraceElement) {
    if (element.lien) {
      // Utiliser le Router pour la navigation interne
      if (element.lien.startsWith('/')) {
        this.router.navigateByUrl(element.lien);
      } else {
        // Pour les liens externes, utiliser window.open
        window.open(element.lien, '_blank');
      }
    } else if (element.type && element.id) {
      // Navigation générique basée sur le type
      this.router.navigate(['/main-app', element.type + 's', element.id]);
    }
  }

  voirHistorique(element: TraceElement) {
    this.isLoading = true;
    this.tracabiliteService.getHistoriqueEntite(element.type, element.id).subscribe({
      next: (historique) => {
        this.isLoading = false;
        this.ouvrirHistoriqueModal(historique, element);
      },
      error: (error) => {
        console.error('Erreur lors de la récupération de l\'historique:', error);
        this.isLoading = false;
      }
    });
  }

  voirChaine(element: TraceElement) {
    this.isLoading = true;
    this.tracabiliteService.getEntityChain(element.type, element.id).subscribe({
      next: (chaine) => {
        this.isLoading = false;
        this.ouvrirChaineModal(chaine, element);
      },
      error: (error) => {
        console.error('Erreur lors de la récupération de la chaîne:', error);
        this.isLoading = false;
      }
    });
  }

  private ouvrirHistoriqueModal(historique: TraceElement[], element: TraceElement) {
    this.dialog.open(HistoriqueModalComponent, {
      width: '800px',
      maxHeight: '80vh',
      data: {
        historique: historique,
        element: element,
        getTypeDisplayName: this.getTypeDisplayName.bind(this)
      }
    });
  }

  private ouvrirChaineModal(chaine: TraceElement[], element: TraceElement) {
    this.dialog.open(ChaineModalComponent, {
      width: '900px',
      maxHeight: '80vh',
      data: {
        chaine: chaine,
        element: element,
        getTypeDisplayName: this.getTypeDisplayName.bind(this)
      }
    });
  }

  getTypeDisplayName(type: string): string {
    return this.tracabiliteService.getTypeDisplayName(type);
  }

  getStatusDisplayName(status: string): string {
    return this.tracabiliteService.getStatusDisplayName(status);
  }

  private chargerStatistiques() {
    this.tracabiliteService.getStatistiques().subscribe({
      next: (stats) => {
        this.statistics = stats;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des statistiques:', error);
        this.statistics = null;
      }
    });
  }
}

// ==================== COMPOSANTS MODALS INLINE ====================

// Historique Modal Component (défini dans le même fichier)
@Component({
  selector: 'app-historique-modal',
  template: `
    <h2 mat-dialog-title>
      <mat-icon>history</mat-icon>
      Historique de {{getTypeDisplayName(data.element.type)}} #{{data.element.id}}
    </h2>
    
    <mat-dialog-content>
      <div class="historique-container">
        <div *ngFor="let trace of data.historique; let i = index" class="historique-item">
          <div class="historique-header">
            <span class="historique-index">#{{i + 1}}</span>
            <mat-chip [style.background-color]="trace.color || '#e0e0e0'" class="historique-type">
              <mat-icon>{{trace.icon || 'search'}}</mat-icon>
              {{getTypeDisplayName(trace.type)}}
            </mat-chip>
            <span class="historique-date">{{trace.displayDate || (trace.date | date:'dd/MM/yyyy HH:mm')}}</span>
          </div>
          
          <div class="historique-content">
            <div class="historique-title">{{trace.libelle}}</div>
            <div class="historique-description">{{trace.description}}</div>
            
            <div *ngIf="trace.utilisateur" class="historique-user">
              <mat-icon>person</mat-icon> {{trace.utilisateur}}
            </div>
            
            <div *ngIf="trace.relation" class="historique-relation">
              <mat-icon>link</mat-icon> {{trace.relation}}
            </div>
            
            <div *ngIf="trace.entity" class="historique-details">
              <div *ngIf="trace.entity.patientNom">
                <strong>Patient:</strong> {{trace.entity.patientPrenom || ''}} {{trace.entity.patientNom}}
              </div>
              <div *ngIf="trace.entity.typeProduit">
                <strong>Produit:</strong> {{trace.entity.typeProduit}}
              </div>
              <div *ngIf="trace.entity.destination">
                <strong>Destination:</strong> {{trace.entity.destination}}
              </div>
            </div>
          </div>
        </div>
      </div>
    </mat-dialog-content>
    
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fermer</button>
      <button mat-button [mat-dialog-close]="true" color="primary" (click)="exporterHistorique()">
        <mat-icon>download</mat-icon> Exporter
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .historique-container {
      max-height: 60vh;
      overflow-y: auto;
      padding: 8px;
    }
    
    .historique-item {
      border-left: 4px solid #3f51b5;
      padding: 12px 16px;
      margin-bottom: 16px;
      background: #fafafa;
      border-radius: 4px;
    }
    
    .historique-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    
    .historique-index {
      background: #3f51b5;
      color: white;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }
    
    .historique-type {
      font-size: 12px;
    }
    
    .historique-date {
      margin-left: auto;
      font-size: 12px;
      color: #666;
    }
    
    .historique-title {
      font-weight: 500;
      margin-bottom: 4px;
      color: #333;
    }
    
    .historique-description {
      color: #666;
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .historique-user, .historique-relation {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
    
    .historique-details {
      margin-top: 8px;
      padding: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      font-size: 13px;
    }
    
    .historique-details div {
      margin-bottom: 2px;
    }
    
    mat-dialog-content {
      padding: 0 !important;
    }
  `],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule
  ]
})
export class HistoriqueModalComponent {
  constructor(
    public dialogRef: MatDialogRef<HistoriqueModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  getTypeDisplayName(type: string): string {
    return this.data.getTypeDisplayName ? this.data.getTypeDisplayName(type) : type;
  }

  exporterHistorique() {
    const csvContent = this.convertirEnCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historique_${this.data.element.type}_${this.data.element.id}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  }

  private convertirEnCSV(): string {
    const headers = ['#', 'Type', 'Libellé', 'Description', 'Date', 'Utilisateur', 'Statut'];
    const rows = this.data.historique.map((trace: TraceElement, index: number) => [
      index + 1,
      this.getTypeDisplayName(trace.type),
      trace.libelle,
      trace.description,
      trace.displayDate || (trace.date ? new Date(trace.date).toLocaleString() : ''),
      trace.utilisateur || 'Système',
      trace.statut
    ]);

    return [
      headers.join(';'),
      ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');
  }
}

// Chaine Modal Component (défini dans le même fichier)
@Component({
  selector: 'app-chaine-modal',
  template: `
    <h2 mat-dialog-title>
      <mat-icon>alt_route</mat-icon>
      Chaîne complète de {{getTypeDisplayName(data.element.type)}} #{{data.element.id}}
    </h2>
    
    <mat-dialog-content>
      <div class="chaine-container">
        <div *ngFor="let trace of data.chaine; let i = index" class="chaine-item" [style.margin-left.px]="(trace.etape || 0) * 20">
          <div class="chaine-step">
            <div class="step-indicator">
              <span class="step-number">Étape {{trace.etape || i + 1}}</span>
            </div>
            
            <div class="chaine-content">
              <div class="chaine-header">
                <mat-chip [style.background-color]="trace.color || '#e0e0e0'" class="chaine-type">
                  <mat-icon>{{trace.icon || 'search'}}</mat-icon>
                  {{getTypeDisplayName(trace.type)}}
                </mat-chip>
                <span class="chaine-date">{{trace.displayDate || (trace.date | date:'dd/MM/yyyy HH:mm')}}</span>
              </div>
              
              <div class="chaine-body">
                <div class="chaine-title">{{trace.libelle}}</div>
                <div class="chaine-description">{{trace.description}}</div>
                
                <div *ngIf="trace.utilisateur" class="chaine-user">
                  <mat-icon>person</mat-icon> {{trace.utilisateur}}
                </div>
                
                <div *ngIf="trace.entity" class="chaine-details">
                  <div *ngIf="trace.entity.patientNom">
                    <strong>Patient:</strong> {{trace.entity.patientPrenom || ''}} {{trace.entity.patientNom}}
                  </div>
                  <div *ngIf="trace.entity.typeProduit">
                    <strong>Produit:</strong> {{trace.entity.typeProduit}}
                  </div>
                  <div *ngIf="trace.entity.destination">
                    <strong>Destination:</strong> {{trace.entity.destination}}
                  </div>
                  <div *ngIf="trace.entity.codeProduit">
                    <strong>Code produit:</strong> {{trace.entity.codeProduit}}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div *ngIf="i < data.chaine.length - 1" class="chaine-connector">
            <div class="connector-line"></div>
            <mat-icon class="connector-icon">arrow_downward</mat-icon>
          </div>
        </div>
      </div>
    </mat-dialog-content>
    
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Fermer</button>
      <button mat-button [mat-dialog-close]="true" color="primary" (click)="exporterChaine()">
        <mat-icon>download</mat-icon> Exporter
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .chaine-container {
      padding: 16px;
      max-height: 60vh;
      overflow-y: auto;
    }
    
    .chaine-item {
      margin-bottom: 16px;
    }
    
    .chaine-step {
      display: flex;
      gap: 16px;
    }
    
    .step-indicator {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 100px;
    }
    
    .step-number {
      background: #3f51b5;
      color: white;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: bold;
      text-align: center;
    }
    
    .chaine-content {
      flex: 1;
      background: #f5f5f5;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }
    
    .chaine-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    
    .chaine-date {
      margin-left: auto;
      font-size: 12px;
      color: #666;
    }
    
    .chaine-body {
      margin-top: 8px;
    }
    
    .chaine-title {
      font-weight: 500;
      font-size: 15px;
      margin-bottom: 4px;
      color: #333;
    }
    
    .chaine-description {
      color: #666;
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .chaine-user {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: #666;
      margin-top: 8px;
    }
    
    .chaine-details {
      margin-top: 12px;
      padding: 12px;
      background: #e8eaf6;
      border-radius: 4px;
      font-size: 13px;
    }
    
    .chaine-details div {
      margin-bottom: 4px;
    }
    
    .chaine-connector {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-left: 48px;
      margin-top: 8px;
    }
    
    .connector-line {
      width: 2px;
      height: 20px;
      background: #3f51b5;
    }
    
    .connector-icon {
      color: #3f51b5;
      font-size: 20px;
    }
    
    mat-dialog-content {
      padding: 0 !important;
    }
  `],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule
  ]
})
export class ChaineModalComponent {
  constructor(
    public dialogRef: MatDialogRef<ChaineModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  getTypeDisplayName(type: string): string {
    return this.data.getTypeDisplayName ? this.data.getTypeDisplayName(type) : type;
  }

  exporterChaine() {
    const csvContent = this.convertirEnCSV();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `chaine_${this.data.element.type}_${this.data.element.id}_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  }

  private convertirEnCSV(): string {
    const headers = ['Étape', 'Type', 'Libellé', 'Description', 'Date', 'Utilisateur', 'Statut', 'Détails'];
    const rows = this.data.chaine.map((trace: TraceElement, index: number) => [
      trace.etape || index + 1,
      this.getTypeDisplayName(trace.type),
      trace.libelle,
      trace.description,
      trace.displayDate || (trace.date ? new Date(trace.date).toLocaleString() : ''),
      trace.utilisateur || 'Système',
      trace.statut,
      this.getDetailsText(trace.entity)
    ]);

    return [
      headers.join(';'),
      ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');
  }

  private getDetailsText(entity: any): string {
    if (!entity) return '';
    
    const details = [];
    if (entity.patientNom) details.push(`Patient: ${entity.patientPrenom || ''} ${entity.patientNom}`);
    if (entity.typeProduit) details.push(`Produit: ${entity.typeProduit}`);
    if (entity.destination) details.push(`Destination: ${entity.destination}`);
    if (entity.codeProduit) details.push(`Code: ${entity.codeProduit}`);
    
    return details.join(' | ');
  }
}