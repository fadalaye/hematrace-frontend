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
import { ProduitSanguin } from '../../../../interfaces/produit-sanguin.interface';
import { ProduitSanguinService } from '../../../../services/produit-sanguin.service';
import { HttpClient } from '@angular/common/http';
import { ReportExportService, ReportFilterItem, ReportStatItem } from '../../../../services/report-export.service';

@Component({
  selector: 'app-rapport-produits',
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
  templateUrl: './rapport-produits.component.html',
  styleUrl: './rapport-produits.component.scss'
})
export class RapportProduitsComponent implements OnInit, AfterViewInit {
  private readonly produitService = inject(ProduitSanguinService);
  private readonly reportExportService = inject(ReportExportService);
  private readonly http = inject(HttpClient);

  displayedColumns: string[] = [
    'codeProduit',
    'typeProduit',
    'groupeComplet',
    'volumeMl',
    'datePrelevement',
    'datePeremption',
    'etat'
  ];

  dataSource = new MatTableDataSource<ProduitSanguin>([]);
  produits: ProduitSanguin[] = [];
  loading = false;
  logoBase64: string | null = null;

  dateDebut = '';
  dateFin = '';
  typeProduit = 'TOUS';
  groupeSanguin = 'TOUS';
  etat = 'TOUS';
  recherche = '';

  totalProduits = 0;
  produitsDisponibles = 0;
  produitsDelivres = 0;
  produitsPerimes = 0;

  produitsParEtat: { name: string; value: number }[] = [];
  produitsParType: { name: string; value: number }[] = [];
  produitsParGroupe: { name: string; value: number }[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  ngOnInit(): void {
    this.chargerLogo();
    this.chargerProduits();
  }

  

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  chargerProduits(): void {
    this.loading = true;
    this.produitService.getAll().subscribe({
      next: (data) => {
        this.produits = data ?? [];
        this.appliquerFiltres();
        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur lors du chargement des produits', error);
        this.loading = false;
      }
    });
  }

  appliquerFiltres(): void {
    let data = [...this.produits];

    if (this.dateDebut) {
      const debut = new Date(this.dateDebut);
      data = data.filter(p => new Date(p.datePrelevement) >= debut);
    }

    if (this.dateFin) {
      const fin = new Date(this.dateFin);
      fin.setHours(23, 59, 59, 999);
      data = data.filter(p => new Date(p.datePrelevement) <= fin);
    }

    if (this.typeProduit !== 'TOUS') {
      data = data.filter(p => p.typeProduit === this.typeProduit);
    }

    if (this.groupeSanguin !== 'TOUS') {
      data = data.filter(p => p.groupeSanguin === this.groupeSanguin);
    }

    if (this.etat !== 'TOUS') {
      data = data.filter(p => (p.etat || '').toUpperCase() === this.etat);
    }

    if (this.recherche.trim()) {
      const term = this.recherche.toLowerCase();
      data = data.filter(p =>
        (p.codeProduit || '').toLowerCase().includes(term) ||
        (p.typeProduit || '').toLowerCase().includes(term) ||
        (p.groupeSanguin || '').toLowerCase().includes(term) ||
        (p.rhesus || '').toLowerCase().includes(term) ||
        (p.etat || '').toLowerCase().includes(term)
      );
    }

    this.dataSource.data = data;
    this.calculerStatistiques(data);
    this.construireGraphiques(data);

    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  calculerStatistiques(data: ProduitSanguin[]): void {
    this.totalProduits = data.length;
    this.produitsDisponibles = data.filter(p => (p.etat || '').toUpperCase() === 'DISPONIBLE').length;
    this.produitsDelivres = data.filter(p => (p.etat || '').toUpperCase() === 'DELIVRE').length;
    this.produitsPerimes = data.filter(p => this.estPerime(p)).length;
  }

  construireGraphiques(data: ProduitSanguin[]): void {
    const etatMap = new Map<string, number>();
    const typeMap = new Map<string, number>();
    const groupeMap = new Map<string, number>();

    data.forEach(p => {
      const etat = p.etat || 'Non renseigné';
      etatMap.set(etat, (etatMap.get(etat) || 0) + 1);

      const type = p.typeProduit || 'Non renseigné';
      typeMap.set(type, (typeMap.get(type) || 0) + 1);

      const groupe = `${p.groupeSanguin}${p.rhesus ?? ''}` || 'Non renseigné';
      groupeMap.set(groupe, (groupeMap.get(groupe) || 0) + 1);
    });

    this.produitsParEtat = Array.from(etatMap.entries()).map(([name, value]) => ({ name, value }));
    this.produitsParType = Array.from(typeMap.entries()).map(([name, value]) => ({ name, value }));
    this.produitsParGroupe = Array.from(groupeMap.entries()).map(([name, value]) => ({ name, value }));
  }

  estPerime(produit: ProduitSanguin): boolean {
    if (!produit.datePeremption) {
      return false;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const datePeremption = new Date(produit.datePeremption);
    datePeremption.setHours(0, 0, 0, 0);

    return datePeremption < today;
  }

  reinitialiserFiltres(): void {
    this.dateDebut = '';
    this.dateFin = '';
    this.typeProduit = 'TOUS';
    this.groupeSanguin = 'TOUS';
    this.etat = 'TOUS';
    this.recherche = '';
    this.appliquerFiltres();
  }

  getTypesProduits(): string[] {
    return [...new Set(this.produits.map(p => p.typeProduit).filter(Boolean))];
  }

  getGroupesSanguins(): string[] {
    return [...new Set(this.produits.map(p => p.groupeSanguin).filter(Boolean))];
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

  const data = this.dataSource.data.map((p) => ({
    'Code produit': p.codeProduit || '',
    'Type produit': p.typeProduit || '',
    'Groupe sanguin': p.groupeSanguin || '',
    'Rhésus': p.rhesus || '',
    'Volume (ml)': p.volumeMl ?? '',
    'Date prélèvement': this.reportExportService.formatDate(p.datePrelevement),
    'Date péremption': this.reportExportService.formatDate(p.datePeremption),
    'État': p.etat || '',
    'Périmé': this.estPerime(p) ? 'Oui' : 'Non'
  }));

  this.reportExportService.exportToExcel({
    fileName: `rapport_produits_${this.reportExportService.getDateForFileName()}`,
    sheetName: 'Produits',
    data,
    filters,
    stats
  });
}

exporterPdf(): void {
  const filters = this.buildExportFilters();
  const stats = this.buildExportStats();

  this.reportExportService.exportToPdf({
    title: 'Rapport des produits sanguins',
    subtitle: 'Analyse des produits par type, groupe sanguin, état et péremption',
    fileName: `rapport_produits_${this.reportExportService.getDateForFileName()}`,
    filters,
    stats,
    headers: [
      'Code',
      'Type',
      'Groupe',
      'Rhésus',
      'Volume',
      'Prélevé le',
      'Péremption',
      'État',
      'Périmé'
    ],
    rows: this.dataSource.data.map(p => [
      p.codeProduit || '',
      p.typeProduit || '',
      p.groupeSanguin || '',
      p.rhesus || '',
      p.volumeMl ?? '',
      this.reportExportService.formatDate(p.datePrelevement),
      this.reportExportService.formatDate(p.datePeremption),
      p.etat || '',
      this.estPerime(p) ? 'Oui' : 'Non'
    ]),
    orientation: 'landscape',
    logoBase64: this.logoBase64 || undefined
  });
}

private buildExportFilters(): ReportFilterItem[] {
  return [
    { label: 'Date début', value: this.dateDebut || 'Tous' },
    { label: 'Date fin', value: this.dateFin || 'Tous' },
    { label: 'Type produit', value: this.typeProduit || 'Tous' },
    { label: 'Groupe sanguin', value: this.groupeSanguin || 'Tous' },
    { label: 'État', value: this.etat || 'Tous' },
    { label: 'Recherche', value: this.recherche || 'Aucune' }
  ];
}

private buildExportStats(): ReportStatItem[] {
  return [
    { label: 'Total produits', value: this.totalProduits },
    { label: 'Produits disponibles', value: this.produitsDisponibles },
    { label: 'Produits délivrés', value: this.produitsDelivres },
    { label: 'Produits périmés', value: this.produitsPerimes }
  ];
}



}