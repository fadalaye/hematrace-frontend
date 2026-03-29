import { Component, inject, input, signal, TemplateRef, ViewChild, AfterViewInit, OnInit } from '@angular/core';
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
  MatSelectModule 
} from '@angular/material/select';
import { ModalModule, BsModalService, BsModalRef } from 'ngx-bootstrap/modal';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Interfaces et services
import { ProduitSanguin } from '../../../interfaces/produit-sanguin.interface';
import { EditProduitSanguinComponent } from "./components/edit-produit-sanguin/edit-produit-sanguin.component";
import { ProduitSanguinService } from '../../../services/produit-sanguin.service';
import { AuthService } from '../../../services/auth.service'; // IMPORTANT
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { AlertModule } from 'ngx-bootstrap/alert';

@Component({
  selector: 'app-produits-sanguins',
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
    MatSelectModule,
    ModalModule,
    EditProduitSanguinComponent,
    MatProgressSpinnerModule,
    AlertModule
  ],
  templateUrl: './produits-sanguins.component.html',
  styleUrl: './produits-sanguins.component.scss'
})
export class ProduitsSanguinsComponent implements OnInit, AfterViewInit {
  // Services
  private modalService = inject(BsModalService);
  private produitSanguinService = inject(ProduitSanguinService);
  public authService = inject(AuthService); // IMPORTANT: public pour le template

  // États
  temp = signal<ProduitSanguin[]>([]);
  produits = signal<ProduitSanguin[]>([]);
  produitsFiltres = signal<ProduitSanguin[]>([]);
  loadingIndicator = signal<boolean>(false);
  savingIndicator = signal<boolean>(false);
  modalRef = signal<BsModalRef | null>(null);
  selectedProduit = signal<ProduitSanguin | null>(null);
  
  // Messages d'alerte
  alertMessage = signal<string>('');
  alertType = signal<'success' | 'danger' | 'info' | 'warning'>('info');
  showAlert = signal<boolean>(false);

  // Filtres
  selectedType = signal<string>('TOUS');
  selectedGroupe = signal<string>('TOUS');
  searchTerm = signal<string>('');

  // Table Material
  displayedColumns: string[] = [
    'codeProduit',
    'typeProduit',
    'groupeSanguin',
    'rhesus',
    'volumeMl',
    'datePrelevement',
    'datePeremption',
    'etat',
    'actions'
  ];
  dataSource = new MatTableDataSource<ProduitSanguin>([]);
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  // Reusability
  isCard = input<boolean>(false);

  ngOnInit() {
    this.getProduits();
    this.initializeUserPermissions();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    
    // Configurer le filtrage personnalisé
    this.dataSource.filterPredicate = this.createFilterPredicate();
  }

  /**
   * Initialise les permissions utilisateur
   */
  private initializeUserPermissions(): void {
    console.log('👤 Permissions utilisateur:', {
      estPersonnel: this.authService.isPersonnel(),
      estMedecin: this.authService.isMedecin(),
      estSuperUser: this.authService.isSuperUser(),
      peutAjouterProduit: this.authService.showCreateProductButton(),
      peutModifierProduit: this.authService.canUpdateProduct(),
      peutSupprimerProduit: this.authService.canDeleteProduct()
    });
  }

  /**
   * Affiche une alerte
   */
  private showAlertMessage(message: string, type: 'success' | 'danger' | 'info' | 'warning' = 'info') {
    this.alertMessage.set(message);
    this.alertType.set(type);
    this.showAlert.set(true);
    
    // Auto-hide après 5 secondes
    setTimeout(() => {
      this.showAlert.set(false);
    }, 5000);
  }

  /**
   * Charge la liste des produits sanguins
   */
  getProduits() {
    this.loadingIndicator.set(true);
    
    this.produitSanguinService.getAll().subscribe({
      next: (produits) => {
        this.produits.set(produits ?? []);
        this.temp.set(produits ?? []);
        this.applyFilters();
        this.loadingIndicator.set(false);
        this.showAlertMessage(`${produits?.length} produits chargés avec succès`, 'success');
      },
      error: (error) => {
        console.error('❌ Erreur chargement produits:', error);
        this.loadingIndicator.set(false);
        this.showAlertMessage('Erreur lors du chargement des produits', 'danger');
      }
    });
  }

  /**
   * Applique tous les filtres
   */
  applyFilters() {
    let filtered = this.produits();

    // Filtre par type
    const selectedType = this.selectedType();
    if (selectedType !== 'TOUS') {
      filtered = filtered.filter(p => p.typeProduit === selectedType);
    }

    // Filtre par groupe
    const selectedGroupe = this.selectedGroupe();
    if (selectedGroupe !== 'TOUS') {
      filtered = filtered.filter(p => p.groupeSanguin === selectedGroupe);
    }

    // Filtre par recherche
    const searchTerm = this.searchTerm();
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        [p.codeProduit, p.typeProduit, p.groupeSanguin, p.rhesus, p.etat]
          .some(field => field?.toLowerCase().includes(term))
      );
    }

    this.produitsFiltres.set(filtered);
    this.dataSource.data = filtered;
  }

  /**
   * Filtre par type de produit
   */
  onTypeFilterChange(event: any) {
    const type = event.value;
    this.selectedType.set(type);
    this.applyFilters();
  }

  /**
   * Filtre par groupe sanguin
   */
  onGroupeFilterChange(event: any) {
    const groupe = event.value;
    this.selectedGroupe.set(groupe);
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
    this.selectedType.set('TOUS');
    this.selectedGroupe.set('TOUS');
    this.searchTerm.set('');
    this.applyFilters();
  }

  /**
   * Prédicat de filtrage personnalisé pour MatTable
   */
  private createFilterPredicate() {
    return (data: ProduitSanguin, filter: string): boolean => {
      if (!filter) return true;
      
      const searchTerms = filter.toLowerCase().split(' ');
      const searchableFields = [
        data.codeProduit, data.typeProduit, data.groupeSanguin, 
        data.rhesus, data.etat
      ].map(field => field?.toLowerCase() || '');

      return searchTerms.every(term => 
        searchableFields.some(field => field.includes(term))
      );
    };
  }

  /**
   * Vérifie si le produit est expiré
   */
  isProduitExpired(produit: ProduitSanguin): boolean {
    if (!produit.datePeremption) return false;
    const aujourdHui = new Date();
    const datePeremption = new Date(produit.datePeremption);
    return datePeremption < aujourdHui;
  }

  /**
   * Vérifie si le produit est proche de la péremption (moins de 7 jours)
   */
  isProduitProchePeremption(produit: ProduitSanguin): boolean {
    if (!produit.datePeremption) return false;
    const aujourdHui = new Date();
    const datePeremption = new Date(produit.datePeremption);
    const diffTime = datePeremption.getTime() - aujourdHui.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays > 0;
  }

  /**
   * Obtient la couleur du badge selon le type
   */
  getTypeBadgeClass(type: string): string {
    const classes: { [key: string]: string } = {
      'SANG_TOTAL': 'badge bg-danger',
      'PLASMA': 'badge bg-primary',
      'PLAQUETTES': 'badge bg-info text-dark',
      'GLOBULES_ROUGES': 'badge bg-warning text-dark',
      'SANG': 'badge bg-danger',
      'CGR': 'badge bg-warning text-dark',
      'PLS': 'badge bg-primary',
      'PFC': 'badge bg-info text-dark',
      'CP': 'badge bg-success'
    };
    return classes[type] || 'badge bg-secondary';
  }

  /**
   * Couleur du chip selon l'état
   */
  getEtatChipColor(etat: string): string {
    const etatUpper = etat?.toUpperCase();
    switch (etatUpper) {
      case 'DISPONIBLE':
        return 'primary';
      case 'DÉLIVRÉ':
        return 'accent';
      case 'UTILISÉ':
        return 'warn';
      case 'PÉRIMÉ':
        return 'warn';
      default:
        return 'basic';
    }
  }

  /**
   * Obtient l'icône selon l'état
   */
  getEtatIcon(etat: string): string {
    const etatUpper = etat?.toUpperCase();
    switch (etatUpper) {
      case 'DISPONIBLE':
        return 'check_circle';
      case 'DÉLIVRÉ':
        return 'local_shipping';
      case 'UTILISÉ':
        return 'inventory_2';
      case 'PÉRIMÉ':
        return 'warning';
      default:
        return 'help';
    }
  }

  /**
   * Obtient le tooltip selon l'état
   */
  getEtatTooltip(etat: string): string {
    const etatUpper = etat?.toUpperCase();
    switch (etatUpper) {
      case 'DISPONIBLE':
        return 'Produit disponible pour délivrance';
      case 'DÉLIVRÉ':
        return 'Produit délivré, prêt pour transfusion';
      case 'UTILISÉ':
        return 'Produit déjà transfusé';
      case 'PÉRIMÉ':
        return 'Produit périmé - Ne pas utiliser';
      default:
        return 'État inconnu';
    }
  }

  /**
   * Export Excel
   */
  exportToExcel() {
    const data = this.produitsFiltres().map(p => ({
      'Code Produit': p.codeProduit,
      'Type Produit': this.getTypeLabel(p.typeProduit),
      'Groupe Sanguin': p.groupeSanguin,
      'Rhesus': p.rhesus || '-',
      'Volume (ml)': p.volumeMl,
      'Date Prélèvement': this.formatDateForDisplay(p.datePrelevement),
      'Date Péremption': this.formatDateForDisplay(p.datePeremption),
      'État': p.etat,
      'Jours Restants': this.calculateDaysRemaining(p.datePeremption)
    }));

    if (data.length === 0) {
      this.showAlertMessage('Aucune donnée à exporter', 'warning');
      return;
    }

    try {
      const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
      const wb: XLSX.WorkBook = { 
        Sheets: { 'Produits Sanguins': ws }, 
        SheetNames: ['Produits Sanguins'] 
      };
      
      // Ajuster la largeur des colonnes
      const colWidths = [
        { wch: 15 }, // Code Produit
        { wch: 15 }, // Type Produit
        { wch: 12 }, // Groupe Sanguin
        { wch: 10 }, // Rhesus
        { wch: 12 }, // Volume
        { wch: 15 }, // Date Prélèvement
        { wch: 15 }, // Date Péremption
        { wch: 12 }, // État
        { wch: 12 }  // Jours Restants
      ];
      ws['!cols'] = colWidths;

      const excelBuffer: any = XLSX.write(wb, { 
        bookType: 'xlsx', 
        type: 'array'
      });
      
      const file = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      const fileName = `produits_sanguins_${new Date().toISOString().split('T')[0]}.xlsx`;
      saveAs(file, fileName);
      
      this.showAlertMessage(`Fichier exporté: ${fileName}`, 'success');
    } catch (error) {
      console.error('❌ Erreur export Excel:', error);
      this.showAlertMessage('Erreur lors de l\'export Excel', 'danger');
    }
  }

  /**
   * Calcule les jours restants avant péremption
   */
  private calculateDaysRemaining(datePeremption: string): number {
    if (!datePeremption) return 0;
    
    const aujourdHui = new Date();
    const peremption = new Date(datePeremption);
    
    // Si déjà périmé
    if (peremption < aujourdHui) return 0;
    
    const diffTime = peremption.getTime() - aujourdHui.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * Formate une date pour l'affichage
   */
  private formatDateForDisplay(dateString: string): string {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR');
    } catch {
      return dateString;
    }
  }

  /**
   * Obtient le libellé du type
   */
  private getTypeLabel(type: string): string {
    const types: { [key: string]: string } = {
      'SANG_TOTAL': 'Sang Total',
      'PLASMA': 'Plasma',
      'PLAQUETTES': 'Plaquettes',
      'GLOBULES_ROUGES': 'Globules Rouges',
      'CGR': 'Concentré de Globules Rouges',
      'PLS': 'Plasma',
      'PFC': 'Plasma Frais Congelé',
      'CP': 'Concentré Plaquettaire'
    };
    return types[type] || type;
  }

  /**
   * Supprime un produit (seulement pour Super Users)
   */
  deleteProduit(id: number) {
    if (!id) {
      this.showAlertMessage('Impossible de supprimer: ID manquant', 'danger');
      return;
    }

    // Vérification supplémentaire des permissions
    if (!this.authService.canDeleteProduct()) {
      this.showAlertMessage('Vous n\'avez pas les droits pour supprimer des produits', 'warning');
      return;
    }

    const confirmation = confirm(
      `Êtes-vous sûr de vouloir supprimer ce produit sanguin ?\n\n` +
      `Cette action est irréversible.`
    );

    if (confirmation) {
      this.produitSanguinService.delete(id).subscribe({
        next: () => {
          this.produits.update(list => list.filter(p => p.id !== id));
          this.temp.update(list => list.filter(p => p.id !== id));
          this.applyFilters();
          this.showAlertMessage('Produit supprimé avec succès', 'success');
        },
        error: (error) => {
          console.error('❌ Erreur lors de la suppression:', error);
          const message = error.error?.message || 'Erreur lors de la suppression du produit';
          this.showAlertMessage(message, 'danger');
        }
      });
    }
  }

  /**
   * Ouvre la modale d'édition/création avec vérification des droits
   */
  openProduitFormModal(template: TemplateRef<any>, produit?: ProduitSanguin) {
    // Vérifier les droits avant d'ouvrir la modal
    if (produit && !this.authService.canUpdateProduct()) {
      this.showAlertMessage('Vous n\'avez pas les droits pour modifier des produits', 'warning');
      return;
    }
    
    if (!produit && !this.authService.showCreateProductButton()) {
      this.showAlertMessage('Vous n\'avez pas les droits pour ajouter des produits', 'warning');
      return;
    }

    this.selectedProduit.set(produit || null);
    this.modalRef.set(this.modalService.show(template, { 
      class: 'modal-lg',
      ignoreBackdropClick: true,
      keyboard: false
    }));
  }

  /**
   * Ferme la modale
   */
  closeProduitModal() {
    this.modalRef()?.hide();
    this.selectedProduit.set(null);
  }

  /**
   * Ajoute un nouveau produit avec vérification des droits
   */
  addProduit(produit: ProduitSanguin) {
    if (!this.authService.showCreateProductButton()) {
      this.showAlertMessage('Vous n\'avez pas les droits pour ajouter des produits', 'warning');
      return;
    }

    this.savingIndicator.set(true);
    
    const produitToAdd = { ...produit };
    delete produitToAdd.id;

    this.produitSanguinService.create(produitToAdd).subscribe({
      next: (newProduit) => {
        this.savingIndicator.set(false);
        this.produits.update(list => [newProduit, ...list]);
        this.temp.update(list => [newProduit, ...list]);
        this.applyFilters();
        this.closeProduitModal();
        this.showAlertMessage('Produit ajouté avec succès', 'success');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur lors de l\'ajout:', error);
        const message = error.error?.message || 'Erreur lors de l\'ajout du produit';
        this.showAlertMessage(message, 'danger');
      }
    });
  }

  /**
   * Met à jour un produit existant avec vérification des droits
   */
  updateProduit(produit: ProduitSanguin) {
    if (!this.authService.canUpdateProduct()) {
      this.showAlertMessage('Vous n\'avez pas les droits pour modifier des produits', 'warning');
      return;
    }

    this.savingIndicator.set(true);
    
    if (!produit.id) {
      console.error('❌ Impossible de modifier: ID manquant');
      this.savingIndicator.set(false);
      this.showAlertMessage('Impossible de modifier: ID manquant', 'danger');
      return;
    }

    this.produitSanguinService.update(produit.id, produit).subscribe({
      next: (updatedProduit) => {
        this.savingIndicator.set(false);
        this.produits.update(list => list.map(p => p.id === updatedProduit.id ? updatedProduit : p));
        this.temp.update(list => list.map(p => p.id === updatedProduit.id ? updatedProduit : p));
        this.applyFilters();
        this.closeProduitModal();
        this.showAlertMessage('Produit modifié avec succès', 'success');
      },
      error: (error) => {
        this.savingIndicator.set(false);
        console.error('❌ Erreur lors de la modification:', error);
        const message = error.error?.message || 'Erreur lors de la modification du produit';
        this.showAlertMessage(message, 'danger');
      }
    });
  }

  /**
   * Obtient le nombre total de produits filtrés
   */
  getFilteredCount(): number {
    return this.produitsFiltres().length;
  }

  /**
   * Obtient le nombre total de produits
   */
  getTotalCount(): number {
    return this.produits().length;
  }

  /**
   * Obtient le libellé du type sélectionné
   */
  getSelectedTypeLabel(): string {
    const types: { [key: string]: string } = {
      'TOUS': 'Tous les types',
      'SANG_TOTAL': 'Sang total',
      'PLASMA': 'Plasma',
      'PLAQUETTES': 'Plaquettes',
      'GLOBULES_ROUGES': 'Globules rouges',
      'SANG': 'Sang total',
      'CGR': 'Globules rouges',
      'PLS': 'Plasma',
      'PFC': 'Plasma frais congelé',
      'CP': 'Plaquettes'
    };
    return types[this.selectedType()] || 'Tous les types';
  }
}