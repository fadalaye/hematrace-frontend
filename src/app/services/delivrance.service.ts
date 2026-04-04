import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Delivrance } from '../interfaces/delivrance.interface';
import { environment } from '../../environments/environment';

// Interfaces pour les réponses API
export interface ApiResponse<T> {
  success: boolean;
  count?: number;
  data: T;
  message?: string;
  code?: string;
}

export interface ApiErrorResponse {
  success: boolean;
  error: string;
  code: string;
}

export interface ModifierDelivranceData {
  produitIds: number[];
  destination: string;
  modeTransport: string;
  observations?: string;
}

export interface VerificationResponse {
  success?: boolean;
  peutDelivrer: boolean;
  message: string;
  code?: string;
}

export interface ProduitsDisponiblesResponse {
  success?: boolean;
  produitsDisponibles: boolean;
  message: string;
  produitsIndisponibles?: number[];
}

export interface StatistiquesDelivrance {
  total: number;
  [key: string]: number;
}

export interface CreerDelivranceData {
  demandeId: number;
  produitIds: number[];
  personnelId: number;
  destination: string;
  modeTransport: string;
  observations?: string;
}

// Interface pour la structure de réponse de /details
interface DelivranceDetailsWrapper {
  produitsDisponiblesCount: number;
  delivrance: Delivrance;
  produitsTransfusesCount: number;
  aProduitsDisponibles: boolean;
}

interface DelivranceDetailsApiResponse {
  success: boolean;
  count: number;
  data: DelivranceDetailsWrapper[];
}

@Injectable({
  providedIn: 'root'
})
export class DelivranceService {
  private apiUrl = `${environment.apiUrl}/delivrances`;

  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  constructor(private http: HttpClient) {}

  // ========== UTILITAIRES ==========

  private handleResponse<T>(response: ApiResponse<T>): T {
    if (!response) {
      throw new Error('Réponse API vide');
    }
    
    if (!response.success) {
      throw new Error(response.message || 'Erreur API');
    }
    
    if (response.data === undefined) {
      throw new Error('Données manquantes dans la réponse');
    }
    
    return response.data;
  }

  private formatDelivranceDate(delivrance: any): Delivrance {
    // Vérifier que delivrance existe
    if (!delivrance) {
      console.error('❌ Donnée délivrance invalide:', delivrance);
      throw new Error('Donnée délivrance invalide');
    }
    
    // Cloner l'objet pour éviter les modifications mutables
    const formattedDelivrance = { ...delivrance };
    
    // Formater la date si elle existe
    if (formattedDelivrance.dateHeureDelivrance) {
      try {
        formattedDelivrance.dateHeureDelivrance = new Date(formattedDelivrance.dateHeureDelivrance);
      } catch (error) {
        console.warn('⚠️ Erreur formatage date, garde valeur originale:', error);
        // Garder la valeur originale
      }
    }
    
    // Formater également les dates des produits si nécessaire
    if (formattedDelivrance.produitsSanguins && Array.isArray(formattedDelivrance.produitsSanguins)) {
      formattedDelivrance.produitsSanguins = formattedDelivrance.produitsSanguins.map((produit: any) => {
        if (produit.datePeremption) {
          try {
            return { ...produit, datePeremption: new Date(produit.datePeremption) };
          } catch {
            return produit;
          }
        }
        return produit;
      });
    }
    
    return formattedDelivrance;
  }

  // ========== CRÉATION ==========

creerDelivrance(request: CreerDelivranceData): Observable<Delivrance> {
  console.log('🚀 Envoi création délivrance:', request);
  
  // Validation avant envoi
  if (!request.demandeId || !request.personnelId || !request.destination) {
    return throwError(() => new Error('Données de création incomplètes'));
  }
  
  if (!request.produitIds || request.produitIds.length === 0) {
    return throwError(() => new Error('Aucun produit sélectionné'));
  }
  
  return this.http.post<any>(`${this.apiUrl}/creer`, request, this.httpOptions)
    .pipe(
      map(response => {
        console.log('✅ Réponse brute création délivrance:', response);
        
        // Vérifier la structure de la réponse
        if (!response) {
          throw new Error('Réponse vide du serveur');
        }
        
        // Votre backend retourne soit 'delivrance' soit 'data'
        let delivranceData: Delivrance;
        
        if (response.delivrance) {
          // Format de votre backend : { success: true, message: "...", delivrance: {...} }
          delivranceData = response.delivrance;
        } else if (response.data) {
          // Format standard : { success: true, data: {...} }
          delivranceData = response.data;
        } else if (response.id) {
          // Format direct
          delivranceData = response;
        } else {
          console.error('❌ Structure de réponse inattendue:', response);
          throw new Error('Structure de réponse inattendue');
        }
        
        if (!delivranceData) {
          throw new Error('Données de délivrance manquantes dans la réponse');
        }
        
        console.log('📦 Délivrance extraite:', delivranceData);
        return this.formatDelivranceDate(delivranceData);
      }),
      catchError(error => {
        console.error('❌ Erreur création délivrance:', error);
        
        // Extraire le message d'erreur de différentes façons
        let errorMessage = 'Erreur lors de la création de la délivrance';
        
        if (error.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.erreur) {
            errorMessage = error.error.erreur;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          } else if (error.error.error) {
            errorMessage = error.error.error;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
}

  // ALIAS pour compatibilité
  create(request: CreerDelivranceData): Observable<Delivrance> {
    return this.creerDelivrance(request);
  }

  // ========== LECTURE ==========

  getAll(): Observable<Delivrance[]> {
    return this.http.get<ApiResponse<Delivrance[]>>(this.apiUrl)
      .pipe(
        map(response => this.handleResponse(response).map(d => this.formatDelivranceDate(d))),
        catchError(error => {
          console.error('❌ Erreur chargement délivrances:', error);
          return throwError(() => error);
        })
      );
  }

  // CORRIGÉ : getAllWithDetails() - gère la structure imbriquée de /details
  getAllWithDetails(): Observable<Delivrance[]> {
    console.log('🔍 Appel API: GET /details');
    
    return this.http.get<DelivranceDetailsApiResponse>(`${this.apiUrl}/details`).pipe(
      tap(response => {
        console.log('✅ Réponse API brute:', response);
        console.log('📊 Structure:', {
          success: response.success,
          count: response.count,
          dataLength: response.data?.length
        });
        
        if (response.data && response.data.length > 0) {
          const wrapper = response.data[0];
          console.log('📦 Premier wrapper:', {
            produitsDisponiblesCount: wrapper.produitsDisponiblesCount,
            produitsTransfusesCount: wrapper.produitsTransfusesCount,
            aProduitsDisponibles: wrapper.aProduitsDisponibles
          });
          
          const delivrance = wrapper.delivrance;
          console.log('🏥 Délivrance extraite:', {
            id: delivrance.id,
            destination: delivrance.destination,
            produits: delivrance.produitsSanguins?.length,
            patient: `${delivrance.demande?.patientPrenom} ${delivrance.demande?.patientNom}`
          });
        }
      }),
      map(response => {
        if (response.success && response.data) {
          // Extraire les délivrances du wrapper
          const delivrances = response.data.map(wrapper => {
            const delivrance = wrapper.delivrance;
            // Formater les dates
            return this.formatDelivranceDate(delivrance);
          });
          console.log('🎯 Délivrances extraites:', delivrances.length);
          return delivrances;
        }
        console.warn('⚠️ Aucune donnée dans la réponse');
        return [];
      }),
      tap(delivrances => {
        console.log('🎯 Délivrances finales pour le composant:', delivrances.length);
        if (delivrances.length > 0) {
          console.log('📋 Première délivrance:', delivrances[0]);
        }
      }),
      catchError(error => {
        console.error('❌ Erreur getAllWithDetails:', error);
        return throwError(() => error);
      })
    );
  }

  // Version alternative plus simple
  getAllWithDetailsSimple(): Observable<Delivrance[]> {
    return this.http.get<any>(`${this.apiUrl}/details`).pipe(
      map(response => {
        if (response.success && response.data) {
          return response.data.map((item: any) => this.formatDelivranceDate(item.delivrance));
        }
        return [];
      })
    );
  }

  getById(id: number): Observable<Delivrance> {
    return this.http.get<ApiResponse<Delivrance>>(`${this.apiUrl}/${id}`)
      .pipe(
        map(response => this.formatDelivranceDate(this.handleResponse(response))),
        catchError(error => {
          console.error(`❌ Erreur chargement délivrance ${id}:`, error);
          return throwError(() => error);
        })
      );
  }

  getByIdWithDetails(id: number): Observable<Delivrance> {
    return this.http.get<ApiResponse<Delivrance>>(`${this.apiUrl}/${id}/details`)
      .pipe(
        map(response => this.formatDelivranceDate(this.handleResponse(response))),
        catchError(error => {
          console.error(`❌ Erreur chargement délivrance détaillée ${id}:`, error);
          return throwError(() => error);
        })
      );
  }

  // ========== RECHERCHE ET FILTRES ==========

  getByPersonnel(personnelId: number): Observable<Delivrance[]> {
    return this.http.get<ApiResponse<Delivrance[]>>(`${this.apiUrl}/personnel/${personnelId}`)
      .pipe(
        map(response => this.handleResponse(response).map(d => this.formatDelivranceDate(d))),
        catchError(error => {
          console.error(`❌ Erreur chargement délivrances personnel ${personnelId}:`, error);
          return throwError(() => error);
        })
      );
  }

  getByDemande(demandeId: number): Observable<Delivrance> {
    return this.http.get<ApiResponse<Delivrance>>(`${this.apiUrl}/demande/${demandeId}`)
      .pipe(
        map(response => this.formatDelivranceDate(this.handleResponse(response))),
        catchError(error => {
          console.error(`❌ Erreur chargement délivrance demande ${demandeId}:`, error);
          return throwError(() => error);
        })
      );
  }

  getByDate(date: Date): Observable<Delivrance[]> {
    const dateStr = date.toISOString().split('T')[0];
    return this.http.get<ApiResponse<Delivrance[]>>(`${this.apiUrl}/date/${dateStr}`)
      .pipe(
        map(response => this.handleResponse(response).map(d => this.formatDelivranceDate(d))),
        catchError(error => {
          console.error(`❌ Erreur chargement délivrances date ${dateStr}:`, error);
          return throwError(() => error);
        })
      );
  }

  getByDateRange(startDate: Date, endDate: Date): Observable<Delivrance[]> {
    const params = new HttpParams()
      .set('start', startDate.toISOString())
      .set('end', endDate.toISOString());
    
    return this.http.get<ApiResponse<Delivrance[]>>(`${this.apiUrl}/periode`, { params })
      .pipe(
        map(response => this.handleResponse(response).map(d => this.formatDelivranceDate(d))),
        catchError(error => {
          console.error(`❌ Erreur chargement délivrances période:`, error);
          return throwError(() => error);
        })
      );
  }

  getByTypeProduit(typeProduit: string): Observable<Delivrance[]> {
    return this.http.get<ApiResponse<Delivrance[]>>(`${this.apiUrl}/type/${typeProduit}`)
      .pipe(
        map(response => this.handleResponse(response).map(d => this.formatDelivranceDate(d))),
        catchError(error => {
          console.error(`❌ Erreur chargement délivrances type ${typeProduit}:`, error);
          return throwError(() => error);
        })
      );
  }

  getByGroupeSanguin(groupeSanguin: string): Observable<Delivrance[]> {
    return this.http.get<ApiResponse<Delivrance[]>>(`${this.apiUrl}/groupe/${groupeSanguin}`)
      .pipe(
        map(response => this.handleResponse(response).map(d => this.formatDelivranceDate(d))),
        catchError(error => {
          console.error(`❌ Erreur chargement délivrances groupe ${groupeSanguin}:`, error);
          return throwError(() => error);
        })
      );
  }

  searchByDestination(destination: string): Observable<Delivrance[]> {
    return this.http.get<ApiResponse<Delivrance[]>>(`${this.apiUrl}/destination`, {
      params: new HttpParams().set('destination', destination)
    })
    .pipe(
      map(response => this.handleResponse(response).map(d => this.formatDelivranceDate(d))),
      catchError(error => {
        console.error(`❌ Erreur recherche délivrances destination ${destination}:`, error);
        return throwError(() => error);
      })
    );
  }

  getByProduitSanguin(produitId: number): Observable<Delivrance[]> {
    return this.http.get<ApiResponse<Delivrance[]>>(`${this.apiUrl}/produit/${produitId}`)
      .pipe(
        map(response => this.handleResponse(response).map(d => this.formatDelivranceDate(d))),
        catchError(error => {
          console.error(`❌ Erreur chargement délivrances produit ${produitId}:`, error);
          return throwError(() => error);
        })
      );
  }

  getProchesPeremption(joursRestants: number = 7): Observable<Delivrance[]> {
    return this.http.get<ApiResponse<Delivrance[]>>(`${this.apiUrl}/alerte/peremption/${joursRestants}`)
      .pipe(
        map(response => this.handleResponse(response).map(d => this.formatDelivranceDate(d))),
        catchError(error => {
          console.error(`❌ Erreur chargement délivrances proches péremption:`, error);
          return throwError(() => error);
        })
      );
  }

  // ========== VÉRIFICATIONS ==========

  peutDelivrerDemande(demandeId: number): Observable<VerificationResponse> {
    return this.http.get<ApiResponse<VerificationResponse>>(
      `${this.apiUrl}/verifier/demande/${demandeId}`
    ).pipe(
      map(response => this.handleResponse(response)),
      catchError(error => {
        console.error(`❌ Erreur vérification délivrance demande ${demandeId}:`, error);
        return throwError(() => error);
      })
    );
  }

  verifierProduitsDelivrables(produitIds: number[]): Observable<ProduitsDisponiblesResponse> {
    return this.http.post<ApiResponse<ProduitsDisponiblesResponse>>(
      `${this.apiUrl}/verifier/produits`,
      { produitIds }
    ).pipe(
      map(response => this.handleResponse(response)),
      catchError(error => {
        console.error('❌ Erreur vérification produits délivrables:', error);
        return throwError(() => error);
      })
    );
  }

  // Alternative avec params
  sontProduitsDisponibles(produitIds: number[]): Observable<ProduitsDisponiblesResponse> {
    let params = new HttpParams();
    produitIds.forEach(id => {
      params = params.append('produitIds', id.toString());
    });
    
    return this.http.get<ApiResponse<ProduitsDisponiblesResponse>>(
      `${this.apiUrl}/verifier/produits/disponibles`, 
      { params }
    ).pipe(
      map(response => this.handleResponse(response)),
      catchError(error => {
        console.error('❌ Erreur vérification produits disponibles:', error);
        return throwError(() => error);
      })
    );
  }

  estDemandeValidee(demandeId: number): Observable<{estValidee: boolean, message: string}> {
    return this.http.get<ApiResponse<{estValidee: boolean, message: string}>>(
      `${this.apiUrl}/verifier/demande/${demandeId}/validee`
    ).pipe(
      map(response => this.handleResponse(response)),
      catchError(error => {
        console.error(`❌ Erreur vérification demande validée ${demandeId}:`, error);
        return throwError(() => error);
      })
    );
  }

  verifierCompatibilite(demandeId: number, produitIds: number[]): Observable<{compatible: boolean, message: string}> {
    return this.http.post<ApiResponse<{compatible: boolean, message: string}>>(
      `${this.apiUrl}/verifier/compatibilite`,
      { demandeId, produitIds }
    ).pipe(
      map(response => this.handleResponse(response)),
      catchError(error => {
        console.error('❌ Erreur vérification compatibilité:', error);
        return throwError(() => error);
      })
    );
  }

  // ========== MISE À JOUR ==========

  update(id: number, delivrance: Partial<Delivrance>): Observable<Delivrance> {
    console.log('🔄 Envoi modification délivrance ID:', id, delivrance);
    
    return this.http.put<ApiResponse<Delivrance>>(`${this.apiUrl}/${id}`, delivrance, this.httpOptions)
      .pipe(
        map(response => this.formatDelivranceDate(this.handleResponse(response))),
        catchError(error => {
          console.error(`❌ Erreur modification délivrance ${id}:`, error);
          return throwError(() => error);
        })
      );
  }

  ajouterProduit(delivranceId: number, produitId: number): Observable<Delivrance> {
    console.log(`➕ Ajout produit ${produitId} à délivrance ${delivranceId}`);
    
    return this.http.patch<ApiResponse<Delivrance>>(
      `${this.apiUrl}/${delivranceId}/produits/ajouter/${produitId}`, 
      {}, 
      this.httpOptions
    ).pipe(
      map(response => this.formatDelivranceDate(this.handleResponse(response))),
      catchError(error => {
        console.error(`❌ Erreur ajout produit ${produitId} à délivrance ${delivranceId}:`, error);
        return throwError(() => error);
      })
    );
  }

  retirerProduit(delivranceId: number, produitId: number): Observable<Delivrance> {
    console.log(`➖ Retrait produit ${produitId} de délivrance ${delivranceId}`);
    
    return this.http.patch<ApiResponse<Delivrance>>(
      `${this.apiUrl}/${delivranceId}/produits/retirer/${produitId}`, 
      {}, 
      this.httpOptions
    ).pipe(
      map(response => this.formatDelivranceDate(this.handleResponse(response))),
      catchError(error => {
        console.error(`❌ Erreur retrait produit ${produitId} de délivrance ${delivranceId}:`, error);
        return throwError(() => error);
      })
    );
  }

  annulerDelivrance(id: number): Observable<Delivrance> {
    console.log(`❌ Annulation délivrance ${id}`);
    
    return this.http.patch<ApiResponse<Delivrance>>(
      `${this.apiUrl}/${id}/annuler`, 
      {}, 
      this.httpOptions
    ).pipe(
      map(response => this.formatDelivranceDate(this.handleResponse(response))),
      catchError(error => {
        console.error(`❌ Erreur annulation délivrance ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  // ========== SUPPRESSION ==========

  delete(id: number): Observable<ApiResponse<any>> {
    console.log(`🗑️ Suppression délivrance ${id}`);
    
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/${id}`)
      .pipe(
        catchError(error => {
          console.error(`❌ Erreur suppression délivrance ${id}:`, error);
          return throwError(() => error);
        })
      );
  }

  // ========== STATISTIQUES ==========

  getTotalDelivrances(): Observable<number> {
    return this.http.get<ApiResponse<number>>(`${this.apiUrl}/statistiques/total`)
      .pipe(
        map(response => this.handleResponse(response)),
        catchError(error => {
          console.error('❌ Erreur statistiques total délivrances:', error);
          return throwError(() => error);
        })
      );
  }

  countByTypeProduit(typeProduit: string): Observable<number> {
    return this.http.get<ApiResponse<number>>(`${this.apiUrl}/statistiques/type/${typeProduit}`)
      .pipe(
        map(response => this.handleResponse(response)),
        catchError(error => {
          console.error(`❌ Erreur statistiques type ${typeProduit}:`, error);
          return throwError(() => error);
        })
      );
  }

  countByPersonnel(personnelId: number): Observable<number> {
    return this.http.get<ApiResponse<number>>(`${this.apiUrl}/statistiques/personnel/${personnelId}`)
      .pipe(
        map(response => this.handleResponse(response)),
        catchError(error => {
          console.error(`❌ Erreur statistiques personnel ${personnelId}:`, error);
          return throwError(() => error);
        })
      );
  }

  getStatistiquesGlobales(): Observable<StatistiquesDelivrance> {
    return this.http.get<ApiResponse<StatistiquesDelivrance>>(`${this.apiUrl}/statistiques`)
      .pipe(
        map(response => this.handleResponse(response)),
        catchError(error => {
          console.error('❌ Erreur statistiques globales:', error);
          return throwError(() => error);
        })
      );
  }

  getStatistiquesMensuelles(annee: number): Observable<Map<string, number>> {
    return this.http.get<ApiResponse<{[mois: string]: number}>>(`${this.apiUrl}/statistiques/mois/${annee}`)
      .pipe(
        map(response => {
          const data = this.handleResponse(response);
          return new Map(Object.entries(data));
        }),
        catchError(error => {
          console.error(`❌ Erreur statistiques mensuelles année ${annee}:`, error);
          return throwError(() => error);
        })
      );
  }

  getStatistiquesParMois(annee: number): Observable<any> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/statistiques/mensuel/${annee}`)
      .pipe(
        map(response => this.handleResponse(response)),
        catchError(error => {
          console.error(`❌ Erreur statistiques par mois année ${annee}:`, error);
          return throwError(() => error);
        })
      );
  }

  // ========== MÉTHODES SPÉCIFIQUES POUR TRANSFUSION ==========

  getAllWithAvailableProducts(): Observable<Delivrance[]> {
    return this.http.get<ApiResponse<Delivrance[]>>(`${this.apiUrl}/produits-disponibles`)
      .pipe(
        map(response => this.handleResponse(response).map(d => this.formatDelivranceDate(d))),
        catchError(error => {
          console.error('❌ Erreur chargement délivrances avec produits disponibles:', error);
          // Fallback: utiliser la méthode normale et filtrer côté frontend
          return this.getAllWithDetails().pipe(
            map(delivrances => this.filtrerDelivrancesAvecProduitsDisponibles(delivrances))
          );
        })
      );
  }

  // Méthode de fallback côté frontend
  private filtrerDelivrancesAvecProduitsDisponibles(delivrances: Delivrance[]): Delivrance[] {
    console.log('🔍 Filtrage côté frontend des délivrances avec produits disponibles');
    
    return delivrances
      .map(delivrance => {
        // Pour chaque délivrance, filtrer les produits DÉLIVRÉS
        const produitsDisponibles = delivrance.produitsSanguins?.filter(
          produit => produit.etat === 'DÉLIVRÉ' || produit.etat === 'DELIVRE'
        ) || [];
        
        // Retourner une copie avec seulement les produits disponibles
        return {
          ...delivrance,
          produitsSanguins: produitsDisponibles
        };
      })
      .filter(delivrance => 
        // Garder seulement les délivrances qui ont au moins un produit disponible
        delivrance.produitsSanguins && delivrance.produitsSanguins.length > 0
      );
  }

  // ========== MÉTHODES UTILITAIRES ==========

  /**
   * Vérifie et crée une délivrance avec validation complète
   */
  async verifierEtCreerDelivrance(request: CreerDelivranceData): Promise<Delivrance> {
    try {
      console.log('🔍 Début vérification et création délivrance');
      
      // 1. Vérifier la demande
      const verificationDemande = await this.peutDelivrerDemande(request.demandeId).toPromise();
      if (!verificationDemande?.peutDelivrer) {
        throw new Error(verificationDemande?.message || 'La demande ne peut pas être délivrée');
      }
      
      // 2. Vérifier les produits
      const verificationProduits = await this.verifierProduitsDelivrables(request.produitIds).toPromise();
      if (!verificationProduits?.produitsDisponibles) {
        throw new Error(verificationProduits?.message || 'Un ou plusieurs produits ne sont pas disponibles');
      }
      
      // 3. Vérifier la compatibilité
      const verificationCompatibilite = await this.verifierCompatibilite(
        request.demandeId, 
        request.produitIds
      ).toPromise();
      
      if (!verificationCompatibilite?.compatible) {
        throw new Error(verificationCompatibilite?.message || 'Produits incompatibles avec le patient');
      }
      
      // 4. Créer la délivrance
      console.log('✅ Toutes les vérifications passées, création en cours...');
      const delivrance = await this.creerDelivrance(request).toPromise() as Delivrance;
      console.log('✅ Délivrance créée avec succès:', delivrance.id);
      
      return delivrance;
      
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification et création:', error);
      throw new Error(`Échec de création délivrance: ${error.message}`);
    }
  }

  /**
   * Formatte une date pour l'affichage
   */
  formatDateForDisplay(date: Date | string): string {
    try {
      const d = date instanceof Date ? date : new Date(date);
      return d.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return String(date);
    }
  }

  /**
   * Génère un rapport PDF de délivrance
   */
  genererRapportPDF(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/rapport`, {
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error(`❌ Erreur génération rapport PDF délivrance ${id}:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Exporte les délivrances en Excel
   */
  exporterExcel(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/excel`, {
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error('❌ Erreur export Excel délivrances:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Exporte les délivrances en CSV
   */
  exporterCSV(): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/export/csv`, {
      responseType: 'blob'
    }).pipe(
      catchError(error => {
        console.error('❌ Erreur export CSV délivrances:', error);
        return throwError(() => error);
      })
    );
  }

  updateComplete(id: number, request: ModifierDelivranceData): Observable<Delivrance> {
  console.log('🔄 Envoi modification complète délivrance ID:', id, request);

  return this.http.put<any>(`${this.apiUrl}/${id}/complete`, request, this.httpOptions)
    .pipe(
      map(response => {
        // gestion tolérante selon le format backend
        let delivranceData: Delivrance;

        if (response?.data) {
          delivranceData = response.data;
        } else if (response?.delivrance) {
          delivranceData = response.delivrance;
        } else if (response?.id) {
          delivranceData = response;
        } else {
          throw new Error('Structure de réponse inattendue lors de la modification');
        }

        return this.formatDelivranceDate(delivranceData);
      }),
      catchError(error => {
        console.error(`❌ Erreur modification complète délivrance ${id}:`, error);

        let errorMessage = 'Erreur lors de la modification de la délivrance';

        if (error.error) {
          if (typeof error.error === 'string') {
            errorMessage = error.error;
          } else if (error.error.message) {
            errorMessage = error.error.message;
          } else if (error.error.erreur) {
            errorMessage = error.error.erreur;
          } else if (error.error.error) {
            errorMessage = error.error.error;
          }
        } else if (error.message) {
          errorMessage = error.message;
        }

        return throwError(() => new Error(errorMessage));
      })
    );
}
}