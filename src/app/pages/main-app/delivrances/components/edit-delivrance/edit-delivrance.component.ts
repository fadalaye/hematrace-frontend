import { Component, inject, input, OnInit, output, signal, computed, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Interfaces
import { Delivrance } from '../../../../../interfaces/delivrance.interface';
import { Demande } from '../../../../../interfaces/demande.interface';
import { ProduitSanguin } from '../../../../../interfaces/produit-sanguin.interface';
import { AnyUtilisateur } from '../../../../../interfaces/any-utilisateur.interface';

// Services
import { AuthService } from '../../../../../services/auth.service';
import { DemandeService } from '../../../../../services/demande.service';
import { ProduitSanguinService } from '../../../../../services/produit-sanguin.service';

@Component({
  selector: 'app-edit-delivrance',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule, 
    MatButtonModule, 
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule
  ],
  templateUrl: './edit-delivrance.component.html',
  styleUrls: ['./edit-delivrance.component.scss']
})
export class EditDelivranceComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  
  updateItem = input<Delivrance | null>();
  addedData = output<Delivrance>();
  saved = output<Delivrance>();
  cancelled = output<void>();

  // Données disponibles
  demandesValidees = signal<Demande[]>([]);
  produitsDisponibles = signal<ProduitSanguin[]>([]);
  
  // Recherche et filtrage
  searchTerm = signal<string>('');
  
  // Produits compatibles pour la demande sélectionnée
  produitsCompatibles = signal<ProduitSanguin[]>([]);

  // Produits sélectionnés
  selectedProduitIds = signal<number[]>([]);

  // Ajout de la propriété today
  today = new Date();

  // Gestion des souscriptions
  private destroy$ = new Subject<void>();

  private formBuilder = inject(FormBuilder);
  private authService = inject(AuthService);
  private demandeService = inject(DemandeService);
  private produitSanguinService = inject(ProduitSanguinService);

  // Utilisateur connecté
  currentUser = this.authService.getCurrentUser();

  ngOnInit() {
    this.initForm();
    this.loadDonnees();
    this.setupFormListeners();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Méthode pour sélectionner une demande
  selectDemande(demande: Demande) {
    if (!demande || !demande.id) {
      return;
    }

    // Ne pas permettre la sélection si aucun produit compatible
    const produitsCompatibles = this.getProduitsCompatibles(demande);
    if (produitsCompatibles.length === 0) {
      alert('Cette demande ne dispose d\'aucun produit compatible disponible');
      return;
    }
    
    this.form.patchValue({
      demandeId: demande.id
    });
    
    // Déclencher manuellement le changement
    this.onDemandeChange(demande.id);
  }

  initForm() {
    const item = this.updateItem();
    
    this.form = this.formBuilder.group({
      demandeId: [item?.demande?.id ?? null, Validators.required],
      destination: [item?.destination ?? '', Validators.required],
      modeTransport: [item?.modeTransport ?? '', Validators.required],
      observations: [item?.observations ?? ''],
      personnelId: [this.getPersonnelId(), Validators.required]
    });

    // Pré-remplir les produits si modification
    if (item?.produitsSanguins) {
      const produitIds = item.produitsSanguins
        .filter(p => p.id !== undefined)
        .map(p => p.id!);
      this.selectedProduitIds.set(produitIds);
    }
  }

  setupFormListeners() {
    // Écouter les changements de demande pour filtrer les produits compatibles
    this.form.get('demandeId')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(demandeId => {
        this.onDemandeChange(demandeId);
      });
  }

  loadDonnees() {
    this.loadDemandesValidees();
    this.loadProduitsDisponibles();
  }

  loadDemandesValidees() {
    // Utiliser le service réel
    this.demandeService.getDemandesByStatut('VALIDÉE')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          let demandesData: Demande[] = [];
          
          if (res && res.success !== undefined) {
            demandesData = res.data || [];
          } else if (Array.isArray(res)) {
            demandesData = res;
          }
          
          this.demandesValidees.set(demandesData);
        },
        error: (error) => {
          console.error('Erreur chargement demandes:', error);
          this.demandesValidees.set([]);
        }
      });
  }

  loadProduitsDisponibles() {
    // Utiliser le service réel
    this.produitSanguinService.getByEtat('DISPONIBLE')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res: any) => {
          let produitsData: ProduitSanguin[] = [];
          
          if (res && res.success !== undefined) {
            produitsData = res.data || [];
          } else if (Array.isArray(res)) {
            produitsData = res;
          }
          
          this.produitsDisponibles.set(produitsData);
        },
        error: (error) => {
          console.error('Erreur chargement produits:', error);
          this.produitsDisponibles.set([]);
        }
      });
  }

  // Filtrage des demandes
  getDemandesFiltrees(): Demande[] {
    const term = this.searchTerm().toLowerCase();
    const demandes = this.demandesValidees();
    
    if (!term.trim()) {
      return demandes;
    }
    
    return demandes.filter(demande => {
      return (
        (demande.patientNom?.toLowerCase() || '').includes(term) ||
        (demande.patientPrenom?.toLowerCase() || '').includes(term) ||
        (demande.serviceDemandeur?.toLowerCase() || '').includes(term) ||
        (demande.groupeSanguinPatient?.toLowerCase() || '').includes(term) ||
        (demande.typeProduitDemande?.toLowerCase() || '').includes(term)
      );
    });
  }

  onSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value || '');
  }

  onDemandeChange(demandeId: number | null) {
    if (!demandeId) {
      this.produitsCompatibles.set([]);
      this.selectedProduitIds.set([]);
      return;
    }

    const demande = this.demandesValidees().find(d => d.id === demandeId);
    if (demande) {
      const produitsCompatibles = this.getProduitsCompatibles(demande);
      this.produitsCompatibles.set(produitsCompatibles);
      
      // Réinitialiser la sélection des produits
      this.selectedProduitIds.set([]);
    } else {
      this.produitsCompatibles.set([]);
      this.selectedProduitIds.set([]);
    }
  }

  getProduitsCompatibles(demande: Demande): ProduitSanguin[] {
    if (!demande || !demande.groupeSanguinPatient) {
      return [];
    }
    
    return this.produitsDisponibles().filter(produit => {
      // Vérifier que le produit est disponible
      if (produit.etat?.toUpperCase() !== 'DISPONIBLE') {
        return false;
      }
      
      // Vérifier la compatibilité
      return this.estProduitCompatible(produit, demande);
    });
  }

  estProduitCompatible(produit: ProduitSanguin, demande: Demande): boolean {
    if (!demande.groupeSanguinPatient || !produit.groupeSanguin) {
      return false;
    }

    // Tableau de compatibilité sanguine
    const compatibilite: { [key: string]: string[] } = {
      'A+': ['A+', 'A-', 'O+', 'O-'],
      'A-': ['A-', 'O-'],
      'B+': ['B+', 'B-', 'O+', 'O-'],
      'B-': ['B-', 'O-'],
      'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      'AB-': ['A-', 'B-', 'AB-', 'O-'],
      'O+': ['O+', 'O-'],
      'O-': ['O-']
    };

    // Normaliser les groupes
    const groupePatient = demande.groupeSanguinPatient.toUpperCase();
    const rhesusProduit = produit.rhesus || '+';
    const groupeProduit = `${produit.groupeSanguin.toUpperCase()}${rhesusProduit}`;

    const groupesCompatibles = compatibilite[groupePatient] || [];
    return groupesCompatibles.includes(groupeProduit);
  }

  // Gestion des produits sélectionnés
  onProduitSelectionChange(event: Event, produitId: number) {
    const target = event.target as HTMLInputElement;
    const isChecked = target.checked;
    
    if (isChecked) {
      this.selectedProduitIds.update(ids => [...ids, produitId]);
    } else {
      this.selectedProduitIds.update(ids => ids.filter(id => id !== produitId));
    }
  }

  isProduitSelected(produitId: number): boolean {
    return this.selectedProduitIds().includes(produitId);
  }

  // Méthodes utilitaires
  getPersonnelId(): number {
    const user = this.currentUser;
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }
    return Number(user.id);
  }

  getSelectedDemande(): Demande | undefined {
    const demandeId = this.form.get('demandeId')?.value;
    return this.demandesValidees().find(d => d.id === demandeId);
  }

  getSelectedProduits(): ProduitSanguin[] {
    const selectedIds = this.selectedProduitIds();
    return this.produitsCompatibles().filter(p => 
      p.id !== undefined && selectedIds.includes(p.id)
    );
  }

  // Statistiques
  getDemandesAvecProduitsCompatibles(): Demande[] {
    return this.demandesValidees().filter(demande => 
      this.getProduitsCompatibles(demande).length > 0
    );
  }

  getDemandesSansProduitsCompatibles(): Demande[] {
    return this.demandesValidees().filter(demande => 
      this.getProduitsCompatibles(demande).length === 0
    );
  }

  getStatutCompatibilite(demande: Demande): string {
    const nbProduits = this.getProduitsCompatibles(demande).length;
    if (nbProduits === 0) return 'aucun';
    if (nbProduits < (demande.quantiteDemande || 1)) return 'partiel';
    return 'complet';
  }

  getClasseStatutCompatibilite(demande: Demande): string {
    const statut = this.getStatutCompatibilite(demande);
    switch (statut) {
      case 'complet': return 'bg-success';
      case 'partiel': return 'bg-warning';
      case 'aucun': return 'bg-danger';
      default: return 'bg-secondary';
    }
  }

  getTexteStatutCompatibilite(demande: Demande): string {
    const statut = this.getStatutCompatibilite(demande);
    const nbProduits = this.getProduitsCompatibles(demande).length;
    
    switch (statut) {
      case 'complet': return `${nbProduits} produit(s) - Couverture complète`;
      case 'partiel': return `${nbProduits} produit(s) - Couverture partielle`;
      case 'aucun': return 'Aucun produit compatible';
      default: return 'Statut inconnu';
    }
  }

  // Validation et soumission
  onSubmit() {
    console.log('✅ onSubmit() délivrance appelé');
    
    if (this.form.invalid) {
      console.log('❌ Formulaire délivrance invalide', this.form.errors);
      this.markFormGroupTouched();
      return;
    }

    if (this.selectedProduitIds().length === 0) {
      alert('Veuillez sélectionner au moins un produit');
      return;
    }

    // Validation de compatibilité
    if (!this.validateCompatibilite()) {
      return;
    }
    
    console.log('📦 Données du formulaire délivrance:', this.form.value);
    this.saveDelivrance();
  }

  validateCompatibilite(): boolean {
    const demande = this.getSelectedDemande();
    const produits = this.getSelectedProduits();

    if (!demande || produits.length === 0) {
      return false;
    }

    // Vérifier que tous les produits sont compatibles
    const produitsIncompatibles = produits.filter(p => 
      !this.estProduitCompatible(p, demande)
    );

    if (produitsIncompatibles.length > 0) {
      const produitsNoms = produitsIncompatibles.map(p => p.codeProduit).join(', ');
      alert(`Produits incompatibles: ${produitsNoms}`);
      return false;
    }

    return true;
  }

  saveDelivrance() {
    const formValue = this.form.value;
    const selectedDemande = this.getSelectedDemande();
    const selectedProduits = this.getSelectedProduits();

    if (!selectedDemande) {
      alert('Demande non trouvée');
      return;
    }

    if (selectedProduits.length === 0) {
      alert('Aucun produit sélectionné');
      return;
    }

    // Préparer les données pour la création
    const data: Delivrance = {
      dateHeureDelivrance: this.updateItem()?.dateHeureDelivrance || new Date().toISOString(),
      destination: formValue.destination,
      modeTransport: formValue.modeTransport,
      observations: formValue.observations,
      demande: selectedDemande,
      produitsSanguins: selectedProduits,
      personnel: this.getPersonnelComplet()
    };

    const currentItem = this.updateItem();
    
    if (currentItem?.id) {
      // Mode modification
      this.saved.emit({ 
        ...data,
        id: currentItem.id 
      });
    } else {
      // Mode création
      this.addedData.emit(data);
    }
  }

  private getPersonnelComplet(): any {
    const user = this.currentUser;
    
    if (!user) {
      return {
        id: 0,
        nom: 'Inconnu',
        prenom: 'Utilisateur',
        fonction: 'Non spécifié'
      };
    }
    
    return {
      id: Number(user.id),
      matricule: user.matricule || '',
      nom: user.nom || 'Inconnu',
      prenom: user.prenom || 'Utilisateur',
      email: user.email || '',
      fonction: this.getFonctionUtilisateur()
    };
  }

  getFonctionUtilisateur(): string {
    const user = this.currentUser;
    if (!user) return 'Non spécifié';

    // Types de base TypeScript
    type UserWithFonction = AnyUtilisateur & { fonction?: string };
    
    const typedUser = user as UserWithFonction;
    return typedUser.fonction || 'Utilisateur';
  }

  private markFormGroupTouched() {
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.markAsTouched();
    });
  }

  cancel() {
    console.log('❌ Annulation délivrance');
    this.cancelled.emit();
  }

  // Méthodes d'affichage
  getDemandeDisplay(demande: Demande): string {
    return `${demande.patientPrenom} ${demande.patientNom} - ${demande.serviceDemandeur} - ${demande.groupeSanguinPatient}`;
  }

  getProduitDisplay(produit: ProduitSanguin): string {
    return `${produit.codeProduit} - ${produit.typeProduit} - ${produit.groupeSanguin}${produit.rhesus || ''}`;
  }
}