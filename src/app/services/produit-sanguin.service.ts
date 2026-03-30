import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ProduitSanguin } from '../interfaces/produit-sanguin.interface';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ProduitSanguinService {
    private apiUrl = `${environment.apiUrl}/produits-sanguins`;

    private httpOptions = {
        headers: new HttpHeaders({
            'Content-Type': 'application/json'
        })
    };

    constructor(private http: HttpClient) {}

    // ========== CRUD DE BASE ==========

    getAll(): Observable<ProduitSanguin[]> {
        return this.http.get<ProduitSanguin[]>(this.apiUrl);
    }

    getById(id: number): Observable<ProduitSanguin> {
        return this.http.get<ProduitSanguin>(`${this.apiUrl}/${id}`);
    }

    create(produit: ProduitSanguin): Observable<ProduitSanguin> {
        // IMPORTANT: Retirer l'id et d'autres champs auto-générés
        const produitToSend = {
            codeProduit: produit.codeProduit,
            typeProduit: produit.typeProduit,
            groupeSanguin: produit.groupeSanguin,
            rhesus: produit.rhesus,
            volumeMl: produit.volumeMl,
            datePrelevement: produit.datePrelevement,
            datePeremption: produit.datePeremption,
            etat: produit.etat || 'DISPONIBLE' // État par défaut
        };
        
        console.log('Envoi création produit:', produitToSend);
        return this.http.post<ProduitSanguin>(this.apiUrl, produitToSend, this.httpOptions);
    }

    update(id: number, produit: ProduitSanguin): Observable<ProduitSanguin> {
        // Ne pas envoyer les relations ou champs non modifiables
        const produitToSend = {
            codeProduit: produit.codeProduit,
            typeProduit: produit.typeProduit,
            groupeSanguin: produit.groupeSanguin,
            rhesus: produit.rhesus,
            volumeMl: produit.volumeMl,
            datePrelevement: produit.datePrelevement,
            datePeremption: produit.datePeremption,
            etat: produit.etat
        };
        
        console.log('Envoi modification produit ID:', id, produitToSend);
        return this.http.put<ProduitSanguin>(`${this.apiUrl}/${id}`, produitToSend, this.httpOptions);
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    // ========== VÉRIFICATION D'UNICITÉ ==========

    /**
     * Vérifie si un code produit est déjà utilisé
     * @param code Le code produit à vérifier
     * @returns Observable contenant l'objet { isUnique: boolean }
     */
    checkCodeUnique(code: string): Observable<{ isUnique: boolean }> {
        return this.http.get<{ isUnique: boolean }>(
            `${this.apiUrl}/check-code/${encodeURIComponent(code)}`
        ).pipe(
            catchError(error => {
                console.warn('Endpoint check-code non disponible, utilisation alternative', error);
                // Si l'endpoint n'existe pas, utiliser l'alternative
                return this.checkCodeUniqueAlt(code);
            })
        );
    }

    /**
     * Vérifie si un code produit est déjà utilisé (alternative)
     * @param code Le code produit à vérifier
     * @returns Observable contenant l'objet { isUnique: boolean }
     */
    checkCodeUniqueAlt(code: string): Observable<{ isUnique: boolean }> {
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}`).pipe(
            map(produits => {
                const existe = produits.some(p => 
                    p.codeProduit && p.codeProduit.toLowerCase() === code.toLowerCase()
                );
                return { isUnique: !existe };
            }),
            catchError(error => {
                console.error('Erreur vérification code:', error);
                return of({ isUnique: true }); // Par défaut, considérer comme unique en cas d'erreur
            })
        );
    }

    // ========== RECHERCHES ET FILTRES ==========

    getByEtat(etat: string): Observable<ProduitSanguin[]> {
        // S'assurer que l'état est en majuscules si nécessaire
        const etatNormalise = etat.toUpperCase();
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/etat/${etatNormalise}`);
    }

    getByTypeProduit(typeProduit: string): Observable<ProduitSanguin[]> {
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/type/${typeProduit}`);
    }

    getByGroupeSanguin(groupeSanguin: string): Observable<ProduitSanguin[]> {
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/groupe-sanguin/${groupeSanguin}`);
    }

    getByDatePeremption(date: Date): Observable<ProduitSanguin[]> {
        const dateStr = date.toISOString().split('T')[0];
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/date-peremption/${dateStr}`);
    }

    getProduitsProchesPeremption(joursRestants: number): Observable<ProduitSanguin[]> {
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/peremption/${joursRestants}`);
    }

    // ========== PRODUITS DISPONIBLES ==========

    /**
     * Récupère uniquement les produits disponibles
     */
    getProduitsDisponibles(): Observable<ProduitSanguin[]> {
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/disponibles`);
    }

    /**
     * Récupère les produits disponibles par groupe sanguin
     */
    getProduitsDisponiblesByGroupe(groupeSanguin: string): Observable<ProduitSanguin[]> {
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/disponibles/groupe/${groupeSanguin}`);
    }

    /**
     * Récupère les produits disponibles par type
     */
    getProduitsDisponiblesByType(typeProduit: string): Observable<ProduitSanguin[]> {
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/disponibles/type/${typeProduit}`);
    }

    // ========== STATISTIQUES ==========

    getStatistiques(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/statistiques`);
    }

    countByTypeProduit(typeProduit: string): Observable<number> {
        return this.http.get<number>(`${this.apiUrl}/statistiques/type/${typeProduit}`);
    }

    countByEtat(etat: string): Observable<number> {
        return this.http.get<number>(`${this.apiUrl}/statistiques/etat/${etat}`);
    }

    /**
     * Compte le nombre de produits disponibles
     */
    countProduitsDisponibles(): Observable<number> {
        return this.http.get<number>(`${this.apiUrl}/statistiques/disponibles`);
    }

    // ========== MÉTHODES UTILITAIRES ==========

    /**
     * Vérifie si un produit est disponible pour utilisation
     */
    estProduitDisponible(produitId: number): Observable<boolean> {
        return this.http.get<boolean>(`${this.apiUrl}/${produitId}/disponible`);
    }

    /**
     * Vérifie si un produit peut être délivré (est disponible et non périmé)
     */
    estProduitDelivrable(produitId: number): Observable<boolean> {
        return this.http.get<boolean>(`${this.apiUrl}/${produitId}/delivrable`);
    }

    /**
     * Vérifie si un produit peut être transfusé (est délivré et non périmé)
     */
    estProduitTransfusible(produitId: number): Observable<boolean> {
        return this.http.get<boolean>(`${this.apiUrl}/${produitId}/transfusible`);
    }

    /**
     * Met à jour l'état d'un produit
     */
    updateEtat(produitId: number, nouvelEtat: string): Observable<ProduitSanguin> {
        return this.http.patch<ProduitSanguin>(
            `${this.apiUrl}/${produitId}/etat`, 
            { etat: nouvelEtat },
            this.httpOptions
        );
    }

    /**
     * Marque un produit comme périmé
     */
    marquerCommePerime(produitId: number): Observable<ProduitSanguin> {
        return this.updateEtat(produitId, 'PÉRIMÉ');
    }

    /**
     * Marque un produit comme délivré
     */
    marquerCommeDelivre(produitId: number): Observable<ProduitSanguin> {
        return this.updateEtat(produitId, 'DÉLIVRÉ');
    }

    /**
     * Marque un produit comme utilisé
     */
    marquerCommeUtilise(produitId: number): Observable<ProduitSanguin> {
        return this.updateEtat(produitId, 'UTILISÉ');
    }

    /**
     * Recherche de produits avec plusieurs critères
     */
    searchProduits(criteres: {
        typeProduit?: string;
        groupeSanguin?: string;
        etat?: string;
        datePeremptionMin?: Date;
        datePeremptionMax?: Date;
        rhesus?: string;
        volumeMin?: number;
        volumeMax?: number;
    }): Observable<ProduitSanguin[]> {
        let params = new HttpParams();
        
        if (criteres.typeProduit) {
            params = params.set('typeProduit', criteres.typeProduit);
        }
        if (criteres.groupeSanguin) {
            params = params.set('groupeSanguin', criteres.groupeSanguin);
        }
        if (criteres.etat) {
            params = params.set('etat', criteres.etat.toUpperCase());
        }
        if (criteres.rhesus) {
            params = params.set('rhesus', criteres.rhesus);
        }
        if (criteres.datePeremptionMin) {
            params = params.set('datePeremptionMin', criteres.datePeremptionMin.toISOString().split('T')[0]);
        }
        if (criteres.datePeremptionMax) {
            params = params.set('datePeremptionMax', criteres.datePeremptionMax.toISOString().split('T')[0]);
        }
        if (criteres.volumeMin !== undefined) {
            params = params.set('volumeMin', criteres.volumeMin.toString());
        }
        if (criteres.volumeMax !== undefined) {
            params = params.set('volumeMax', criteres.volumeMax.toString());
        }

        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/search`, { params });
    }

    /**
     * Recherche avancée avec pagination
     */
    searchProduitsAvance(params: HttpParams): Observable<ProduitSanguin[]> {
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/search-avance`, { params });
    }

    /**
     * Génère un rapport d'inventaire
     */
    genererRapportInventaire(): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/rapport/inventaire`, {
            responseType: 'blob'
        });
    }

    /**
     * Exporte les produits en CSV
     */
    exporterCSV(): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/export/csv`, {
            responseType: 'blob'
        });
    }

    /**
     * Exporte les produits en Excel
     */
    exporterExcel(): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/export/excel`, {
            responseType: 'blob'
        });
    }

    /**
     * Méthode pour obtenir un produit par son code
     */
    getByCode(code: string): Observable<ProduitSanguin> {
        return this.http.get<ProduitSanguin>(`${this.apiUrl}/code/${encodeURIComponent(code)}`);
    }

    /**
     * Récupère les produits expirés
     */
    getProduitsExpires(): Observable<ProduitSanguin[]> {
        return this.http.get<ProduitSanguin[]>(`${this.apiUrl}/expires`);
    }

    /**
     * Récupère les produits délivrés
     */
    getProduitsDelivres(): Observable<ProduitSanguin[]> {
        return this.getByEtat('DÉLIVRÉ');
    }

    /**
     * Récupère les produits utilisés
     */
    getProduitsUtilises(): Observable<ProduitSanguin[]> {
        return this.getByEtat('UTILISÉ');
    }

    /**
     * Récupère les produits périmés
     */
    getProduitsPerimes(): Observable<ProduitSanguin[]> {
        return this.getByEtat('PÉRIMÉ');
    }

    /**
     * Vérifie et marque automatiquement les produits périmés
     */
    verifierProduitsPerimes(): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/verifier-peremption`, {});
    }
}