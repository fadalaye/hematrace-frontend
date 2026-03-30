// src/app/services/dashboard.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface GroupeSanguin {
  groupe: string;
  count: number;
  couleur: string;
}

export interface TypeProduit {
  type: string;
  count: number;
  icon: string;
  couleur: string;
}

export interface ProduitStats {
  total: number;
  disponibles: number;
  groupes: GroupeSanguin[];
  types: TypeProduit[];
}

export interface DemandeStats {
  total: number;
  enAttente: number;
  validees: number;
  urgentes: number;
}

export interface DelivranceStats {
  total: number;
  aujourdhui: number;
  ceMois: number;
}

export interface ToleranceStats {
  EXCELLENTE: number;
  BONNE: number;
  MOYENNE: number;
  MAUVAISE: number;
}

export interface TransfusionStats {
  total: number;
  avecEffets: number;
  sansEffets: number;
  tolerance: ToleranceStats;
}

export interface IncidentStats {
  total: number;
  valides: number;
  nonValides: number;
  parType: { [key: string]: number };
}

export interface AlerteStats {
  produitsPerimes: number;
  demandesUrgentes: number;
  produitsCritiques: number;
}

export interface DashboardStats {
  produits: ProduitStats;
  demandes: DemandeStats;
  delivrances: DelivranceStats;
  transfusions: TransfusionStats;
  incidents: IncidentStats;
  alertes: AlerteStats;
}

export interface RecentActivities {
  dernieresDemandes: any[];
  dernieresDelivrances: any[];
  dernieresTransfusions: any[];
}

// Interface pour les produits sanguins du backend
interface ProduitSanguin {
  id?: number;
  codeProduit?: string;
  typeProduit?: string; // "CGR", "PLS", "PFC", "CP", etc.
  groupeSanguin?: string; // "A+", "B-", etc.
  rhesus?: string;
  volumeMl?: number;
  datePrelevement?: string;
  datePeremption?: string;
  etat?: string; // "DISPONIBLE", "PÉRIMÉ", "UTILISÉ", "DÉLIVRÉ"
  delivrance?: any;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  
  //private apiUrl = 'http://localhost:8080/api';
  private apiUrl = `${environment.apiUrl}`;
  
  private defaultProduitStats: ProduitStats = {
    total: 0,
    disponibles: 0,
    groupes: [
      { groupe: 'A+', count: 0, couleur: '#dc3545' },
      { groupe: 'B+', count: 0, couleur: '#0d6efd' },
      { groupe: 'AB+', count: 0, couleur: '#198754' },
      { groupe: 'O+', count: 0, couleur: '#ffc107' },
      { groupe: 'A-', count: 0, couleur: '#6610f2' },
      { groupe: 'B-', count: 0, couleur: '#20c997' },
      { groupe: 'AB-', count: 0, couleur: '#fd7e14' },
      { groupe: 'O-', count: 0, couleur: '#6f42c1' }
    ],
    types: [
      { type: 'Sang total', count: 0, icon: 'bloodtype', couleur: '#dc3545' },
      { type: 'Plasma', count: 0, icon: 'water_drop', couleur: '#0d6efd' },
      { type: 'Plaquettes', count: 0, icon: 'pie_chart', couleur: '#198754' },
      { type: 'Globules rouges', count: 0, icon: 'circle', couleur: '#ffc107' }
    ]
  };
  
  private defaultDemandeStats: DemandeStats = {
    total: 0,
    enAttente: 0,
    validees: 0,
    urgentes: 0
  };
  
  private defaultDelivranceStats: DelivranceStats = {
    total: 0,
    aujourdhui: 0,
    ceMois: 0
  };
  
  private defaultTransfusionStats: TransfusionStats = {
    total: 0,
    avecEffets: 0,
    sansEffets: 0,
    tolerance: {
      EXCELLENTE: 0,
      BONNE: 0,
      MOYENNE: 0,
      MAUVAISE: 0
    }
  };
  
  private defaultIncidentStats: IncidentStats = {
    total: 0,
    valides: 0,
    nonValides: 0,
    parType: {}
  };
  
  private defaultAlerteStats: AlerteStats = {
    produitsPerimes: 0,
    demandesUrgentes: 0,
    produitsCritiques: 0
  };
  
  constructor(private http: HttpClient) { }
  
  // Récupère toutes les statistiques en parallèle avec gestion d'erreurs
  getDashboardStats(): Observable<DashboardStats> {
    return forkJoin({
      produits: this.getProduitsStats().pipe(
        catchError((error) => {
          console.error('Erreur lors de la récupération des statistiques produits:', error);
          return of(this.defaultProduitStats);
        })
      ),
      demandes: this.getDemandesStats().pipe(
        catchError((error) => {
          console.error('Erreur lors de la récupération des statistiques demandes:', error);
          return of(this.defaultDemandeStats);
        })
      ),
      delivrances: this.getDelivrancesStats().pipe(
        catchError((error) => {
          console.error('Erreur lors de la récupération des statistiques délivrances:', error);
          return of(this.defaultDelivranceStats);
        })
      ),
      transfusions: this.getTransfusionsStats().pipe(
        catchError((error) => {
          console.error('Erreur lors de la récupération des statistiques transfusions:', error);
          return of(this.defaultTransfusionStats);
        })
      ),
      incidents: this.getIncidentsStats().pipe(
        catchError((error) => {
          console.error('Erreur lors de la récupération des statistiques incidents:', error);
          return of(this.defaultIncidentStats);
        })
      ),
      alertes: this.getAlertes().pipe(
        catchError((error) => {
          console.error('Erreur lors de la récupération des alertes:', error);
          return of(this.defaultAlerteStats);
        })
      )
    });
  }
  
  // Statistiques des produits sanguins - Version alternative plus simple
getProduitsStats(): Observable<ProduitStats> {
  return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/produits-sanguins`).pipe(
    map((produits: ProduitSanguin[]) => {
      console.log('=== DONNÉES BRUTES PRODUITS ===');
      console.log('Produits reçus:', produits);
      
      if (!Array.isArray(produits)) {
        console.warn('Produits sanguins: données invalides');
        return this.defaultProduitStats;
      }
      
      // Initialiser les compteurs
      const groupesMap: {[key: string]: number} = {};
      const typesMap: {[key: string]: {count: number, name: string, icon: string, couleur: string}} = {};
      let total = 0;
      let disponibles = 0;
      
      // Parcourir tous les produits
      produits.forEach((produit: ProduitSanguin) => {
        if (!produit || !produit.id) return;
        
        total++;
        
        // Compter par groupe sanguin (combiné)
        if (produit.groupeSanguin && produit.rhesus) {
          const groupeComplet = `${produit.groupeSanguin}${produit.rhesus}`;
          const groupeNormalise = this.normaliserGroupeSanguin(groupeComplet);
          console.log(`Groupe: ${produit.groupeSanguin}, Rhésus: ${produit.rhesus} -> Complet: ${groupeComplet} -> Normalisé: ${groupeNormalise}`);
          groupesMap[groupeNormalise] = (groupesMap[groupeNormalise] || 0) + 1;
        } else {
          console.warn(`Produit ${produit.id} n'a pas de groupe sanguin complet`, {
            groupeSanguin: produit.groupeSanguin,
            rhesus: produit.rhesus
          });
        }
        
        // Compter par type de produit
        if (produit.typeProduit) {
          const typeInfo = this.mapTypeProduit(produit.typeProduit);
          if (!typesMap[typeInfo.name]) {
            typesMap[typeInfo.name] = {
              count: 0,
              name: typeInfo.name,
              icon: typeInfo.icon,
              couleur: typeInfo.couleur
            };
          }
          typesMap[typeInfo.name].count++;
        }
        
        // Compter les produits disponibles
        const estDisponible = produit.etat === 'DISPONIBLE' || 
                             produit.etat === 'disponible' || 
                             produit.etat === 'Disponible';
        const nonDelivre = !produit.delivrance;
        const nonPerime = new Date(produit.datePeremption || '') > new Date();
        
        if (estDisponible && nonDelivre && nonPerime) {
          disponibles++;
        }
      });
      
      console.log('GroupesMap après calcul:', groupesMap);
      console.log('TypesMap après calcul:', typesMap);
      console.log(`Total: ${total}, Disponibles: ${disponibles}`);
      
      // Créer le tableau des groupes sanguins
      const groupes: GroupeSanguin[] = [
        { groupe: 'A+', count: groupesMap['A+'] || 0, couleur: '#dc3545' },
        { groupe: 'B+', count: groupesMap['B+'] || 0, couleur: '#0d6efd' },
        { groupe: 'AB+', count: groupesMap['AB+'] || 0, couleur: '#198754' },
        { groupe: 'O+', count: groupesMap['O+'] || 0, couleur: '#ffc107' },
        { groupe: 'A-', count: groupesMap['A-'] || 0, couleur: '#6610f2' },
        { groupe: 'B-', count: groupesMap['B-'] || 0, couleur: '#20c997' },
        { groupe: 'AB-', count: groupesMap['AB-'] || 0, couleur: '#fd7e14' },
        { groupe: 'O-', count: groupesMap['O-'] || 0, couleur: '#6f42c1' }
      ];
      
      // Convertir la map des types en tableau
      const types: TypeProduit[] = Object.values(typesMap).map(typeInfo => ({
        type: typeInfo.name,
        count: typeInfo.count,
        icon: typeInfo.icon,
        couleur: typeInfo.couleur
      }));
      
      // S'assurer que les types principaux sont présents
      const typesPrincipaux = [
        { name: 'Sang total', icon: 'bloodtype', couleur: '#dc3545' },
        { name: 'Plasma', icon: 'water_drop', couleur: '#0d6efd' },
        { name: 'Plaquettes', icon: 'pie_chart', couleur: '#198754' },
        { name: 'Globules rouges', icon: 'circle', couleur: '#ffc107' }
      ];
      
      typesPrincipaux.forEach(typePrincipal => {
        if (!types.find(t => t.type === typePrincipal.name)) {
          types.push({
            type: typePrincipal.name,
            count: 0,
            icon: typePrincipal.icon,
            couleur: typePrincipal.couleur
          });
        }
      });
      
      // Trier les types par count décroissant
      types.sort((a, b) => b.count - a.count);
      
      const result = {
        total,
        disponibles,
        groupes,
        types
      };
      
      console.log('Statistiques produits FINALES:', result);
      return result;
    }),
    catchError((error) => {
      console.error('Erreur lors de la récupération des produits sanguins:', error);
      return of(this.defaultProduitStats);
    })
  );
}
  
  // Statistiques des demandes
  getDemandesStats(): Observable<DemandeStats> {
    return this.http.get<any[]>(`${this.apiUrl}/demandes`).pipe(
      map((demandes: any[]) => {
        if (!Array.isArray(demandes)) {
          return this.defaultDemandeStats;
        }
        
        const total = demandes.length;
        const enAttente = demandes.filter((d: any) => {
          if (!d.statut) return false;
          const statut = d.statut.toString().toUpperCase();
          return statut.includes('EN_ATTENTE') || 
                 statut.includes('EN ATTENTE') || 
                 statut.includes('EN_ATTENTE_VALIDATION') ||
                 statut.includes('ATTENTE');
        }).length;
        
        const validees = demandes.filter((d: any) => {
          if (!d.statut) return false;
          const statut = d.statut.toString().toUpperCase();
          return statut.includes('VALIDEE') || 
                 statut.includes('VALIDÉE') || 
                 statut.includes('APPROUVEE') ||
                 statut.includes('VALIDÉ');
        }).length;
        
        const urgentes = demandes.filter((d: any) => {
          return d.urgence === true || 
                 d.urgence === 'true' ||
                 d.priorite === 'URGENT' || 
                 d.priorite === 'URGENTE' ||
                 (d.priorite && d.priorite.toString().toUpperCase().includes('URGENT'));
        }).length;
        
        return {
          total,
          enAttente,
          validees,
          urgentes
        };
      }),
      catchError((error) => {
        console.error('Erreur dans getDemandesStats:', error);
        return of(this.defaultDemandeStats);
      })
    );
  }
  
  // Statistiques des délivrances
  getDelivrancesStats(): Observable<DelivranceStats> {
    return this.http.get<any[]>(`${this.apiUrl}/delivrances`).pipe(
      map((delivrances: any[]) => {
        if (!Array.isArray(delivrances)) {
          return this.defaultDelivranceStats;
        }
        
        const total = delivrances.length;
        const aujourdhui = new Date().toISOString().split('T')[0];
        
        const delivrancesAujourdhui = delivrances.filter((d: any) => {
          if (!d.dateHeureDelivrance) return false;
          try {
            const dateStr = d.dateHeureDelivrance.toString();
            return dateStr.startsWith(aujourdhui);
          } catch {
            return false;
          }
        }).length;
        
        const maintenant = new Date();
        const moisActuel = maintenant.getMonth();
        const anneeActuelle = maintenant.getFullYear();
        
        const delivrancesCeMois = delivrances.filter((d: any) => {
          if (!d.dateHeureDelivrance) return false;
          try {
            const dateDelivrance = new Date(d.dateHeureDelivrance);
            return dateDelivrance.getMonth() === moisActuel && 
                   dateDelivrance.getFullYear() === anneeActuelle;
          } catch {
            return false;
          }
        }).length;
        
        return {
          total,
          aujourdhui: delivrancesAujourdhui,
          ceMois: delivrancesCeMois
        };
      }),
      catchError((error) => {
        console.error('Erreur dans getDelivrancesStats:', error);
        return of(this.defaultDelivranceStats);
      })
    );
  }
  
  // Statistiques des transfusions
  getTransfusionsStats(): Observable<TransfusionStats> {
    return this.http.get<any[]>(`${this.apiUrl}/transfusions`).pipe(
      map((transfusions: any[]) => {
        if (!Array.isArray(transfusions)) {
          return this.defaultTransfusionStats;
        }
        
        const total = transfusions.length;
        
        // Compter les transfusions avec effets indésirables
        const avecEffets = transfusions.filter((t: any) => {
          if (!t.effetsIndesirables) return false;
          const effets = t.effetsIndesirables.toString().toLowerCase().trim();
          return effets && 
                 effets.length > 0 &&
                 !['non', 'aucun', 'none', 'pas d\'effets', 'sans effets', 'nil', 'null', 'undefined', ''].includes(effets);
        }).length;
        
        const sansEffets = total - avecEffets;
        
        // Calculer les statistiques de tolérance
        const tolerance = {
          EXCELLENTE: transfusions.filter((t: any) => {
            if (!t.tolerance) return false;
            return t.tolerance.toString().toUpperCase().includes('EXCELLENT');
          }).length,
          BONNE: transfusions.filter((t: any) => {
            if (!t.tolerance) return false;
            return t.tolerance.toString().toUpperCase().includes('BON');
          }).length,
          MOYENNE: transfusions.filter((t: any) => {
            if (!t.tolerance) return false;
            return t.tolerance.toString().toUpperCase().includes('MOYEN');
          }).length,
          MAUVAISE: transfusions.filter((t: any) => {
            if (!t.tolerance) return false;
            return t.tolerance.toString().toUpperCase().includes('MAUVAIS');
          }).length
        };
        
        return {
          total,
          avecEffets,
          sansEffets,
          tolerance
        };
      }),
      catchError((error) => {
        console.error('Erreur dans getTransfusionsStats:', error);
        return of(this.defaultTransfusionStats);
      })
    );
  }
  
  // Statistiques des incidents
  getIncidentsStats(): Observable<IncidentStats> {
    return this.http.get<any[]>(`${this.apiUrl}/incidents-transfusionnels`).pipe(
      map((incidents: any[]) => {
        if (!Array.isArray(incidents)) {
          return this.defaultIncidentStats;
        }
        
        const total = incidents.length;
        
        // Compter les incidents validés
        const valides = incidents.filter((i: any) => {
          return i.dateValidation !== null && 
                 i.dateValidation !== undefined && 
                 i.dateValidation !== '' ||
                 i.valide === true ||
                 i.statut === 'VALIDÉ' ||
                 i.statut === 'VALIDEE' ||
                 i.statut === 'APPROUVÉ';
        }).length;
        
        const nonValides = total - valides;
        
        // Statistiques par type de produit
        const parType: { [key: string]: number } = {};
        incidents.forEach((incident: any) => {
          const type = incident.typeProduitTransfuse;
          if (type) {
            const typeKey = type.toString().toUpperCase();
            // Normaliser le type
            const typeNormalise = this.normaliserTypeProduit(typeKey);
            parType[typeNormalise] = (parType[typeNormalise] || 0) + 1;
          }
        });
        
        return {
          total,
          valides,
          nonValides,
          parType
        };
      }),
      catchError((error) => {
        console.error('Erreur dans getIncidentsStats:', error);
        return of(this.defaultIncidentStats);
      })
    );
  }
  
  // Alertes urgentes
  getAlertes(): Observable<AlerteStats> {
    return forkJoin({
      produitsPerimes: this.http.get<ProduitSanguin[]>(`${this.apiUrl}/produits-sanguins/expires`).pipe(
        map((produits: ProduitSanguin[]) => {
          if (!Array.isArray(produits)) return 0;
          // Compter uniquement les produits avec état "PÉRIMÉ"
          return produits.filter(p => p.etat === 'PÉRIMÉ').length;
        }),
        catchError(() => of(0))
      ),
      demandesUrgentes: this.http.get<any[]>(`${this.apiUrl}/demandes?urgence=true`).pipe(
        map((demandes: any[]) => {
          if (!Array.isArray(demandes)) return 0;
          return demandes.length;
        }),
        catchError(() => of(0))
      ),
      produitsCritiques: this.http.get<ProduitSanguin[]>(`${this.apiUrl}/produits-sanguins/peremption/3`).pipe(
        map((produits: ProduitSanguin[]) => {
          if (!Array.isArray(produits)) return 0;
          // Filtrer uniquement les produits disponibles
          return produits.filter(p => 
            p.etat === 'DISPONIBLE' && 
            !p.delivrance &&
            // Vérifier si la date de péremption est dans 3 jours ou moins
            this.isProchePeremption(p.datePeremption, 3)
          ).length;
        }),
        catchError(() => of(0))
      )
    }).pipe(
      map((result: any) => ({
        produitsPerimes: result.produitsPerimes,
        demandesUrgentes: result.demandesUrgentes,
        produitsCritiques: result.produitsCritiques
      })),
      catchError((error) => {
        console.error('Erreur dans getAlertes:', error);
        return of(this.defaultAlerteStats);
      })
    );
  }
  
  // Dernières activités
  getRecentActivities(): Observable<RecentActivities> {
    return forkJoin({
      dernieresDemandes: this.http.get<any[]>(`${this.apiUrl}/demandes?_sort=dateHeureDemande&_order=desc&_limit=10`).pipe(
        map((demandes: any[]) => {
          if (!Array.isArray(demandes)) return [];
          // Trier par date décroissante
          return demandes
            .sort((a, b) => {
              const dateA = new Date(a.dateHeureDemande || 0).getTime();
              const dateB = new Date(b.dateHeureDemande || 0).getTime();
              return dateB - dateA;
            })
            .slice(0, 10);
        }),
        catchError(() => of([]))
      ),
      dernieresDelivrances: this.http.get<any[]>(`${this.apiUrl}/delivrances?_sort=dateHeureDelivrance&_order=desc&_limit=10`).pipe(
        map((delivrances: any[]) => {
          if (!Array.isArray(delivrances)) return [];
          // Trier par date décroissante
          return delivrances
            .sort((a, b) => {
              const dateA = new Date(a.dateHeureDelivrance || 0).getTime();
              const dateB = new Date(b.dateHeureDelivrance || 0).getTime();
              return dateB - dateA;
            })
            .slice(0, 10);
        }),
        catchError(() => of([]))
      ),
      dernieresTransfusions: this.http.get<any[]>(`${this.apiUrl}/transfusions?_sort=dateTransfusion&_order=desc&_limit=10`).pipe(
        map((transfusions: any[]) => {
          if (!Array.isArray(transfusions)) return [];
          // Trier par date décroissante
          return transfusions
            .sort((a, b) => {
              const dateA = new Date(a.dateTransfusion || 0).getTime();
              const dateB = new Date(b.dateTransfusion || 0).getTime();
              return dateB - dateA;
            })
            .slice(0, 10);
        }),
        catchError(() => of([]))
      )
    }).pipe(
      map((result: any) => ({
        dernieresDemandes: result.dernieresDemandes || [],
        dernieresDelivrances: result.dernieresDelivrances || [],
        dernieresTransfusions: result.dernieresTransfusions || []
      })),
      catchError((error) => {
        console.error('Erreur dans getRecentActivities:', error);
        return of({
          dernieresDemandes: [],
          dernieresDelivrances: [],
          dernieresTransfusions: []
        });
      })
    );
  }
  
  // ============================================
  // MÉTHODES UTILITAIRES PRIVÉES
  // ============================================
  
  private normaliserGroupeSanguin(groupe: string): string {
    if (!groupe) return 'INCONNU';
    
    const groupeUpper = groupe.toUpperCase().trim();
    
    // Normaliser les variantes
    if (groupeUpper.includes('A+') || groupeUpper === 'A_POSITIF') return 'A+';
    if (groupeUpper.includes('A-') || groupeUpper === 'A_NEGATIF') return 'A-';
    if (groupeUpper.includes('B+') || groupeUpper === 'B_POSITIF') return 'B+';
    if (groupeUpper.includes('B-') || groupeUpper === 'B_NEGATIF') return 'B-';
    if (groupeUpper.includes('AB+') || groupeUpper === 'AB_POSITIF') return 'AB+';
    if (groupeUpper.includes('AB-') || groupeUpper === 'AB_NEGATIF') return 'AB-';
    if (groupeUpper.includes('O+') || groupeUpper === 'O_POSITIF') return 'O+';
    if (groupeUpper.includes('O-') || groupeUpper === 'O_NEGATIF') return 'O-';
    
    return groupeUpper;
  }
  
  private mapTypeProduit(typeBackend: string): {name: string, icon: string, couleur: string} {
    if (!typeBackend) {
      return { name: 'Autre', icon: 'help', couleur: '#6c757d' };
    }
    
    const typeUpper = typeBackend.toUpperCase().trim();
    
    // Mapping des types backend vers frontend
    const mappings: {[key: string]: {name: string, icon: string, couleur: string}} = {
      'CGR': { name: 'Globules rouges', icon: 'bloodtype', couleur: '#dc3545' },
      'GLOBULES_ROUGES': { name: 'Globules rouges', icon: 'bloodtype', couleur: '#dc3545' },
      'SANG_TOTAL': { name: 'Sang total', icon: 'bloodtype', couleur: '#dc3545' },
      'SANG': { name: 'Sang total', icon: 'bloodtype', couleur: '#dc3545' },
      'PLS': { name: 'Plasma', icon: 'water_drop', couleur: '#0d6efd' },
      'PFC': { name: 'Plasma', icon: 'water_drop', couleur: '#0d6efd' },
      'PLASMA': { name: 'Plasma', icon: 'water_drop', couleur: '#0d6efd' },
      'CP': { name: 'Plaquettes', icon: 'pie_chart', couleur: '#198754' },
      'PLAQUETTES': { name: 'Plaquettes', icon: 'pie_chart', couleur: '#198754' },
      'CONCENTRE_PLAQUETTAIRE': { name: 'Plaquettes', icon: 'pie_chart', couleur: '#198754' }
    };
    
    // Chercher une correspondance exacte d'abord
    if (mappings[typeUpper]) {
      return mappings[typeUpper];
    }
    
    // Chercher une correspondance partielle
    for (const [key, value] of Object.entries(mappings)) {
      if (typeUpper.includes(key) || key.includes(typeUpper)) {
        return value;
      }
    }
    
    // Par défaut
    if (typeUpper.includes('SANG')) return { name: 'Sang total', icon: 'bloodtype', couleur: '#dc3545' };
    if (typeUpper.includes('PLASMA')) return { name: 'Plasma', icon: 'water_drop', couleur: '#0d6efd' };
    if (typeUpper.includes('PLAQUETTE')) return { name: 'Plaquettes', icon: 'pie_chart', couleur: '#198754' };
    if (typeUpper.includes('GLOBULE')) return { name: 'Globules rouges', icon: 'circle', couleur: '#ffc107' };
    
    return { name: typeBackend, icon: 'help', couleur: '#6c757d' };
  }
  
  private normaliserTypeProduit(type: string): string {
    if (!type) return 'INCONNU';
    
    const typeUpper = type.toUpperCase().trim();
    
    if (typeUpper.includes('CGR') || typeUpper.includes('GLOBULES_ROUGES') || typeUpper.includes('SANG_TOTAL')) {
      return 'SANG_TOTAL';
    }
    if (typeUpper.includes('PLS') || typeUpper.includes('PFC') || typeUpper.includes('PLASMA')) {
      return 'PLASMA';
    }
    if (typeUpper.includes('CP') || typeUpper.includes('PLAQUETTES')) {
      return 'PLAQUETTES';
    }
    
    return typeUpper;
  }
  
  private isProchePeremption(datePeremption: string | undefined, joursRestants: number): boolean {
    if (!datePeremption) return false;
    
    try {
      const datePeremptionObj = new Date(datePeremption);
      const aujourdhui = new Date();
      
      // Calculer la différence en jours
      const diffTime = datePeremptionObj.getTime() - aujourdhui.getTime();
      const diffJours = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffJours >= 0 && diffJours <= joursRestants;
    } catch {
      return false;
    }
  }
}