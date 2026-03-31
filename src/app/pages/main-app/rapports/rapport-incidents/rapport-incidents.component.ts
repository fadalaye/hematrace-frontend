import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { IncidentTransfusionnel } from '../../../../interfaces/incident-transfusionnel.interface';
import { IncidentTransfusionnelService } from '../../../../services/Incident-transfusionnel.service';
import { HttpClient } from '@angular/common/http';
import { ReportExportService, ReportFilterItem, ReportStatItem } from '../../../../services/report-export.service';

@Component({
  selector: 'app-rapport-incidents',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    NgxChartsModule
  ],
  templateUrl: './rapport-incidents.component.html',
  styleUrl: './rapport-incidents.component.scss'
})
export class RapportIncidentsComponent implements OnInit, AfterViewInit {
  private readonly incidentService = inject(IncidentTransfusionnelService);
  private readonly reportExportService = inject(ReportExportService);
  private readonly http = inject(HttpClient);

  displayedColumns: string[] = [
    'dateIncident',
    'patient',
    'typeProduitTransfuse',
    'numeroLotProduit',
    'lieuIncident',
    'nomDeclarant'
  ];

  dataSource = new MatTableDataSource<IncidentTransfusionnel>([]);
  incidents: IncidentTransfusionnel[] = [];
  loading = false;
  logoBase64: string | null = null;

  dateDebut = '';
  dateFin = '';
  patient = '';
  produitConcerne = '';
  declarant = '';
  recherche = '';

  totalIncidents = 0;
  incidentsAvecActions = 0;
  incidentsAvecAnalyse = 0;
  incidentsSansDescription = 0;

  incidentsParProduit: { name: string; value: number }[] = [];
  incidentsParLieu: { name: string; value: number }[] = [];
  incidentsParMois: { name: string; value: number }[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.chargerLogo();
    this.chargerIncidents();
  }

  

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  chargerIncidents(): void {
    this.loading = true;
    this.incidentService.getAll().subscribe({
      next: (data) => {
        this.incidents = data ?? [];
        this.appliquerFiltres();
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des incidents', error);
        this.loading = false;
      }
    });
  }

  appliquerFiltres(): void {
    let data = [...this.incidents];

    if (this.dateDebut) {
      const debut = new Date(this.dateDebut);
      data = data.filter(i => new Date(i.dateIncident) >= debut);
    }

    if (this.dateFin) {
      const fin = new Date(this.dateFin);
      fin.setHours(23, 59, 59, 999);
      data = data.filter(i => new Date(i.dateIncident) <= fin);
    }

    if (this.patient.trim()) {
      const term = this.patient.toLowerCase();
      data = data.filter(i =>
        `${i.patientPrenom} ${i.patientNom}`.toLowerCase().includes(term) ||
        (i.patientNumDossier || '').toLowerCase().includes(term)
      );
    }

    if (this.produitConcerne.trim()) {
      data = data.filter(i =>
        (i.typeProduitTransfuse || '').toLowerCase().includes(this.produitConcerne.toLowerCase()) ||
        (i.numeroLotProduit || '').toLowerCase().includes(this.produitConcerne.toLowerCase())
      );
    }

    if (this.declarant.trim()) {
      data = data.filter(i =>
        (i.nomDeclarant || '').toLowerCase().includes(this.declarant.toLowerCase())
      );
    }

    if (this.recherche.trim()) {
      const term = this.recherche.toLowerCase();
      data = data.filter(i =>
        (i.patientNom || '').toLowerCase().includes(term) ||
        (i.patientPrenom || '').toLowerCase().includes(term) ||
        (i.patientNumDossier || '').toLowerCase().includes(term) ||
        (i.typeProduitTransfuse || '').toLowerCase().includes(term) ||
        (i.numeroLotProduit || '').toLowerCase().includes(term) ||
        (i.lieuIncident || '').toLowerCase().includes(term) ||
        (i.nomDeclarant || '').toLowerCase().includes(term)
      );
    }

    this.dataSource.data = data;
    this.calculerStatistiques(data);
    this.construireGraphiques(data);

    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  calculerStatistiques(data: IncidentTransfusionnel[]): void {
    this.totalIncidents = data.length;
    this.incidentsAvecActions = data.filter(i => !!i.actionsCorrectives || !!i.actionsImmediates).length;
    this.incidentsAvecAnalyse = data.filter(i => !!i.analysePreliminaire).length;
    this.incidentsSansDescription = data.filter(i => !i.descriptionIncident).length;
  }

  construireGraphiques(data: IncidentTransfusionnel[]): void {
    const produitMap = new Map<string, number>();
    const lieuMap = new Map<string, number>();
    const moisMap = new Map<string, number>();

    data.forEach(i => {
      const produit = i.typeProduitTransfuse || 'Non renseigné';
      produitMap.set(produit, (produitMap.get(produit) || 0) + 1);

      const lieu = i.lieuIncident || 'Non renseigné';
      lieuMap.set(lieu, (lieuMap.get(lieu) || 0) + 1);

      const date = new Date(i.dateIncident);
      const mois = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      moisMap.set(mois, (moisMap.get(mois) || 0) + 1);
    });

    this.incidentsParProduit = Array.from(produitMap.entries()).map(([name, value]) => ({ name, value }));
    this.incidentsParLieu = Array.from(lieuMap.entries()).map(([name, value]) => ({ name, value }));
    this.incidentsParMois = Array.from(moisMap.entries()).map(([name, value]) => ({ name, value }));
  }

  reinitialiserFiltres(): void {
    this.dateDebut = '';
    this.dateFin = '';
    this.patient = '';
    this.produitConcerne = '';
    this.declarant = '';
    this.recherche = '';
    this.appliquerFiltres();
  }


private chargerLogo(): void {
  this.getBase64ImageFromUrl('/assets/img/hematrace-logo-copilot-1.jpg')
    .then((base64) => {
      this.logoBase64 = base64;
    })
    .catch((error) => {
      console.warn('Logo non chargé pour le PDF', error);
      this.logoBase64 = null;
    });
}

private async getBase64ImageFromUrl(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const blob = await response.blob();

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

exporterExcel(): void {
  const filters = this.buildExportFilters();
  const stats = this.buildExportStats();

  const data = this.dataSource.data.map((i) => ({
    'Date incident': this.reportExportService.formatDate(i.dateIncident),
    'Nom patient': i.patientNom || '',
    'Prénom patient': i.patientPrenom || '',
    'Numéro dossier': i.patientNumDossier || '',
    'Produit transfusé': i.typeProduitTransfuse || '',
    'Numéro lot': i.numeroLotProduit || '',
    'Lieu incident': i.lieuIncident || '',
    'Déclarant': i.nomDeclarant || '',
    'Description': i.descriptionIncident || '',
    'Analyse préliminaire': i.analysePreliminaire || '',
    'Actions immédiates': i.actionsImmediates || '',
    'Actions correctives': i.actionsCorrectives || ''
  }));

  this.reportExportService.exportToExcel({
    fileName: `rapport_incidents_${this.reportExportService.getDateForFileName()}`,
    sheetName: 'Incidents',
    data,
    filters,
    stats
  });
}

exporterPdf(): void {
  const filters = this.buildExportFilters();
  const stats = this.buildExportStats();

  this.reportExportService.exportToPdf({
    title: 'Rapport des incidents transfusionnels',
    subtitle: 'Suivi des incidents déclarés, analyses et actions associées',
    fileName: `rapport_incidents_${this.reportExportService.getDateForFileName()}`,
    filters,
    stats,
    headers: [
      'Date',
      'Nom',
      'Prénom',
      'Dossier',
      'Produit',
      'Lot',
      'Lieu',
      'Déclarant'
    ],
    rows: this.dataSource.data.map(i => [
      this.reportExportService.formatDate(i.dateIncident),
      i.patientNom || '',
      i.patientPrenom || '',
      i.patientNumDossier || '',
      i.typeProduitTransfuse || '',
      i.numeroLotProduit || '',
      i.lieuIncident || '',
      i.nomDeclarant || ''
    ]),
    orientation: 'landscape',
    logoBase64: this.logoBase64 || undefined
  });
}

private buildExportFilters(): ReportFilterItem[] {
  return [
    { label: 'Date début', value: this.dateDebut || 'Tous' },
    { label: 'Date fin', value: this.dateFin || 'Tous' },
    { label: 'Patient', value: this.patient || 'Tous' },
    { label: 'Produit concerné', value: this.produitConcerne || 'Tous' },
    { label: 'Déclarant', value: this.declarant || 'Tous' },
    { label: 'Recherche', value: this.recherche || 'Aucune' }
  ];
}

private buildExportStats(): ReportStatItem[] {
  return [
    { label: 'Total incidents', value: this.totalIncidents },
    { label: 'Incidents avec actions', value: this.incidentsAvecActions },
    { label: 'Incidents avec analyse', value: this.incidentsAvecAnalyse },
    { label: 'Incidents sans description', value: this.incidentsSansDescription }
  ];
}
}