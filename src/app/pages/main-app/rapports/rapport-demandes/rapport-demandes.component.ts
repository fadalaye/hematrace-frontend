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
import { Demande } from '../../../../interfaces/demande.interface';
import { DemandeService } from '../../../../services/demande.service';
import { ReportExportService, ReportFilterItem, ReportStatItem } from '../../../../services/report-export.service';
import { HttpClient } from '@angular/common/http';
@Component({
  selector: 'app-rapport-demandes',
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
  templateUrl: './rapport-demandes.component.html',
  styleUrl: './rapport-demandes.component.scss'
})
export class RapportDemandesComponent implements OnInit, AfterViewInit {
  private readonly demandeService = inject(DemandeService);
  private readonly reportExportService = inject(ReportExportService);
  private readonly http = inject(HttpClient);

  displayedColumns: string[] = [
    'dateHeureDemande',
    'patient',
    'serviceDemandeur',
    'typeProduitDemande',
    'groupeSanguinPatient',
    'quantiteDemande',
    'statut'
  ];

  dataSource = new MatTableDataSource<Demande>([]);
  demandes: Demande[] = [];
  loading = false;
  logoBase64: string | null = null;

  dateDebut = '';
  dateFin = '';
  statut = 'TOUS';
  service = '';
  medecin = '';
  groupeSanguin = '';
  recherche = '';

  totalDemandes = 0;
  demandesEnAttente = 0;
  demandesSatisfaites = 0;
  demandesRejetees = 0;

  demandesParStatut: { name: string; value: number }[] = [];
  demandesParService: { name: string; value: number }[] = [];
  demandesParMois: { name: string; value: number }[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
 
      this.chargerLogo();
      this.chargerDemandes();
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

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  chargerDemandes(): void {
    this.loading = true;
    this.demandeService.getAll().subscribe({
      next: (data) => {
        this.demandes = data ?? [];
        this.appliquerFiltres();
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des demandes', error);
        this.loading = false;
      }
    });
  }

  appliquerFiltres(): void {
    let data = [...this.demandes];

    if (this.dateDebut) {
      const debut = new Date(this.dateDebut);
      data = data.filter(d => new Date(d.dateHeureDemande) >= debut);
    }

    if (this.dateFin) {
      const fin = new Date(this.dateFin);
      fin.setHours(23, 59, 59, 999);
      data = data.filter(d => new Date(d.dateHeureDemande) <= fin);
    }

    if (this.statut !== 'TOUS') {
      data = data.filter(d => d.statut === this.statut);
    }

    if (this.service.trim()) {
      data = data.filter(d =>
        (d.serviceDemandeur || '').toLowerCase().includes(this.service.toLowerCase())
      );
    }

    if (this.medecin.trim()) {
      data = data.filter(d => {
        const nomComplet = `${d.medecin?.prenom ?? ''} ${d.medecin?.nom ?? ''}`.toLowerCase();
        return nomComplet.includes(this.medecin.toLowerCase());
      });
    }

    if (this.groupeSanguin.trim()) {
      data = data.filter(d =>
        (d.groupeSanguinPatient || '').toLowerCase().includes(this.groupeSanguin.toLowerCase())
      );
    }

    if (this.recherche.trim()) {
      const term = this.recherche.toLowerCase();
      data = data.filter(d =>
        (d.patientNom || '').toLowerCase().includes(term) ||
        (d.patientPrenom || '').toLowerCase().includes(term) ||
        (d.serviceDemandeur || '').toLowerCase().includes(term) ||
        (d.typeProduitDemande || '').toLowerCase().includes(term) ||
        (d.patientNumDossier || '').toLowerCase().includes(term)
      );
    }

    this.dataSource.data = data;
    this.calculerStatistiques(data);
    this.construireGraphiques(data);

    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  calculerStatistiques(data: Demande[]): void {
    this.totalDemandes = data.length;
    this.demandesEnAttente = data.filter(d => d.statut === 'EN ATTENTE').length;
    this.demandesSatisfaites = data.filter(d => d.statut === 'VALIDÉE').length;
    this.demandesRejetees = data.filter(d => d.statut === 'REJETÉE').length;
  }

  construireGraphiques(data: Demande[]): void {
    const statuts = ['EN ATTENTE', 'VALIDÉE', 'REJETÉE'];

    this.demandesParStatut = statuts.map(statut => ({
      name: statut,
      value: data.filter(d => d.statut === statut).length
    }));

    const serviceMap = new Map<string, number>();
    const moisMap = new Map<string, number>();

    data.forEach(d => {
      const service = d.serviceDemandeur || 'Non renseigné';
      serviceMap.set(service, (serviceMap.get(service) || 0) + 1);

      const date = new Date(d.dateHeureDemande);
      const mois = `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
      moisMap.set(mois, (moisMap.get(mois) || 0) + 1);
    });

    this.demandesParService = Array.from(serviceMap.entries()).map(([name, value]) => ({ name, value }));
    this.demandesParMois = Array.from(moisMap.entries()).map(([name, value]) => ({ name, value }));
  }

  reinitialiserFiltres(): void {
    this.dateDebut = '';
    this.dateFin = '';
    this.statut = 'TOUS';
    this.service = '';
    this.medecin = '';
    this.groupeSanguin = '';
    this.recherche = '';
    this.appliquerFiltres();
  }

exporterExcel(): void {
  const filters = this.buildExportFilters();
  const stats = this.buildExportStats();

  const data = this.dataSource.data.map((d) => ({
    'Date demande': this.reportExportService.formatDateTime(d.dateHeureDemande),
    'Nom patient': d.patientNom || '',
    'Prénom patient': d.patientPrenom || '',
    'Numéro dossier': d.patientNumDossier || '',
    'Service demandeur': d.serviceDemandeur || '',
    'Médecin': `${d.medecin?.prenom ?? ''} ${d.medecin?.nom ?? ''}`.trim(),
    'Type produit': d.typeProduitDemande || '',
    'Groupe sanguin': d.groupeSanguinPatient || '',
    'Quantité demandée': d.quantiteDemande ?? '',
    'Statut': d.statut || ''
  }));

  this.reportExportService.exportToExcel({
    fileName: `rapport_demandes_${this.reportExportService.getDateForFileName()}`,
    sheetName: 'Demandes',
    data,
    filters,
    stats
  });
}

exporterPdf(): void {
  const filters = this.buildExportFilters();
  const stats = this.buildExportStats();

  this.reportExportService.exportToPdf({
    title: 'Rapport des demandes',
    subtitle: 'Analyse des demandes par période, statut, service et médecin',
    fileName: `rapport_demandes_${this.reportExportService.getDateForFileName()}`,
    filters,
    stats,
    headers: [
      'Date',
      'Nom',
      'Prénom',
      'Dossier',
      'Service',
      'Médecin',
      'Produit',
      'Groupe',
      'Qté',
      'Statut'
    ],
    rows: this.dataSource.data.map(d => [
      this.reportExportService.formatDateTime(d.dateHeureDemande),
      d.patientNom || '',
      d.patientPrenom || '',
      d.patientNumDossier || '',
      d.serviceDemandeur || '',
      `${d.medecin?.prenom ?? ''} ${d.medecin?.nom ?? ''}`.trim(),
      d.typeProduitDemande || '',
      d.groupeSanguinPatient || '',
      d.quantiteDemande ?? '',
      d.statut || ''
    ]),
    orientation: 'landscape',
    logoBase64: this.logoBase64 || undefined
  });
}

private buildExportFilters(): ReportFilterItem[] {
  return [
    { label: 'Date début', value: this.dateDebut || 'Tous' },
    { label: 'Date fin', value: this.dateFin || 'Tous' },
    { label: 'Statut', value: this.statut || 'Tous' },
    { label: 'Service', value: this.service || 'Tous' },
    { label: 'Médecin', value: this.medecin || 'Tous' },
    { label: 'Groupe sanguin', value: this.groupeSanguin || 'Tous' },
    { label: 'Recherche', value: this.recherche || 'Aucune' }
  ];
}

private buildExportStats(): ReportStatItem[] {
  return [
    { label: 'Nombre total de demandes', value: this.totalDemandes },
    { label: 'Demandes en attente', value: this.demandesEnAttente },
    { label: 'Demandes satisfaites', value: this.demandesSatisfaites },
    { label: 'Demandes rejetées', value: this.demandesRejetees }
  ];
}


}