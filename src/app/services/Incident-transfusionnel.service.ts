import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { IncidentTransfusionnel } from '../interfaces/incident-transfusionnel.interface';

export interface CreerIncidentRequest {
    // CHANGEMENT : Utiliser transfusionId directement, pas d'objet transfusion
    transfusionId: number;
    
    dateIncident: string;        // "YYYY-MM-DD"
    heureIncident: string;       // "HH:mm:ss" ou "HH:mm"
    lieuIncident: string;
    patientPrenom: string;
    patientNom: string;
    patientDateNaissance: string; // "YYYY-MM-DD"
    patientNumDossier: string;
    typeProduitTransfuse: string;
    numeroLotProduit: string;
    datePeremptionProduit: string; // "YYYY-MM-DD"
    descriptionIncident?: string;
    signes?: string;
    symptomes?: string;
    actionsImmediates?: string;
    personnesInformees?: string;
    analysePreliminaire?: string;
    actionsCorrectives?: string;
    nomDeclarant: string;
    fonctionDeclarant: string;
    registreHemovigilance?: string;
    signatureDeclarant?: string;
    
    // Optionnel : garder transfusion pour compatibilité si nécessaire
    transfusion?: {
        id: number;
    };
}

    export interface StatistiquesIncident {
    total: number;
    valides: number;
    nonValides: number;
    parTypeProduit: { [key: string]: number };
    parMois: { [key: string]: number };
    }

    @Injectable({
    providedIn: 'root'
    })
    export class IncidentTransfusionnelService {
    private apiUrl = '${environment.apiUrl}/incidents-transfusionnels';

    private httpOptions = {
        headers: new HttpHeaders({
        'Content-Type': 'application/json'
        })
    };

    constructor(private http: HttpClient) {}

    // ========== CRÉATION ==========

creerIncident(request: CreerIncidentRequest): Observable<IncidentTransfusionnel> {
    console.log('🔍 Envoi création incident - Données brutes:', request);
    
    // EXTRACTION DE transfusionId
    let transfusionId: number;
    
    if (request.transfusionId) {
        // Cas 1 : transfusionId fourni directement
        transfusionId = request.transfusionId;
        console.log('✅ transfusionId trouvé directement:', transfusionId);
    } else if (request.transfusion?.id) {
        // Cas 2 : transfusion.id fourni dans l'objet transfusion
        transfusionId = request.transfusion.id;
        console.log('✅ transfusionId extrait de transfusion object:', transfusionId);
    } else {
        // Cas 3 : Aucun ID trouvé
        console.error('❌ ERREUR: Aucun transfusionId trouvé dans la requête');
        return throwError(() => new Error('transfusionId est obligatoire'));
    }
    
    // FORMATER LES DONNÉES EXACTEMENT COMME LE BACKEND LES ATTEND
    const donneesPourBackend: any = {
        // CRITIQUE : Envoyer transfusionId directement
        transfusionId: transfusionId,
        
        // Dates
        dateIncident: request.dateIncident,
        heureIncident: this.formatHeurePourBackend(request.heureIncident),
        patientDateNaissance: request.patientDateNaissance,
        datePeremptionProduit: request.datePeremptionProduit,
        
        // Champs texte obligatoires (trim)
        lieuIncident: (request.lieuIncident || '').trim(),
        patientPrenom: (request.patientPrenom || '').trim(),
        patientNom: (request.patientNom || '').trim(),
        patientNumDossier: (request.patientNumDossier || '').trim(),
        typeProduitTransfuse: (request.typeProduitTransfuse || '').trim(),
        numeroLotProduit: (request.numeroLotProduit || '').trim(),
        nomDeclarant: (request.nomDeclarant || '').trim(),
        fonctionDeclarant: (request.fonctionDeclarant || '').trim(),
        
        // Champs optionnels (null si undefined/empty)
        descriptionIncident: (request.descriptionIncident || '').trim() || null,
        signes: (request.signes || '').trim() || null,
        symptomes: (request.symptomes || '').trim() || null,
        actionsImmediates: (request.actionsImmediates || '').trim() || null,
        personnesInformees: (request.personnesInformees || '').trim() || null,
        analysePreliminaire: (request.analysePreliminaire || '').trim() || null,
        actionsCorrectives: (request.actionsCorrectives || '').trim() || null,
        registreHemovigilance: (request.registreHemovigilance || '').trim() || null,
        signatureDeclarant: (request.signatureDeclarant || '').trim() || null
    };
    
    console.log('📤 Données envoyées au backend:', JSON.stringify(donneesPourBackend, null, 2));
    console.log('📤 transfusionId envoyé:', donneesPourBackend.transfusionId);
    console.log('📤 Type de transfusionId:', typeof donneesPourBackend.transfusionId);
    
    return this.http.post<IncidentTransfusionnel>(this.apiUrl, donneesPourBackend, this.httpOptions)
        .pipe(
            tap(response => {
                console.log('✅ Incident créé avec succès:', response);
                console.log('✅ ID incident:', response.id);
                console.log('✅ Transfusion associée:', response.transfusion?.id);
            }),
            catchError(error => {
                console.error('❌ Erreur lors de la création:', error);
                
                // Log détaillé pour le débogage
                if (error.status === 400) {
                    console.error('❌ Erreur 400 - Données invalides:', error.error);
                } else if (error.status === 404) {
                    console.error('❌ Erreur 404 - Ressource non trouvée');
                } else if (error.status === 500) {
                    console.error('❌ Erreur 500 - Erreur serveur interne');
                }
                
                return throwError(() => error);
            })
        );
}

// Méthode utilitaire pour formater l'heure
private formatHeurePourBackend(heure: string): string {
    if (!heure) return '00:00:00';
    
    // Si format "HH:mm", ajouter ":00"
    if (heure.match(/^\d{1,2}:\d{2}$/)) {
        const parts = heure.split(':');
        const hours = parts[0].padStart(2, '0');
        const minutes = parts[1].padStart(2, '0');
        return `${hours}:${minutes}:00`;
    }
    
    // Si déjà format "HH:mm:ss", retourner tel quel
    return heure;
}

    // ALIAS pour compatibilité
    create(request: CreerIncidentRequest): Observable<IncidentTransfusionnel> {
        return this.creerIncident(request);
    }

    // ========== LECTURE ==========

    getAll(): Observable<IncidentTransfusionnel[]> {
        return this.http.get<IncidentTransfusionnel[]>(this.apiUrl);
    }

    getById(id: number): Observable<IncidentTransfusionnel> {
        return this.http.get<IncidentTransfusionnel>(`${this.apiUrl}/${id}`);
    }

    getByTransfusion(transfusionId: number): Observable<IncidentTransfusionnel> {
        return this.http.get<IncidentTransfusionnel>(`${this.apiUrl}/transfusion/${transfusionId}`);
    }

    // ========== RECHERCHE ET FILTRES ==========

    getByDate(date: Date): Observable<IncidentTransfusionnel[]> {
        const dateStr = date.toISOString().split('T')[0];
        return this.http.get<IncidentTransfusionnel[]>(`${this.apiUrl}/date/${dateStr}`);
    }

    getByDateRange(startDate: Date, endDate: Date): Observable<IncidentTransfusionnel[]> {
        let params = new HttpParams()
        .set('startDate', startDate.toISOString().split('T')[0])
        .set('endDate', endDate.toISOString().split('T')[0]);
        
        return this.http.get<IncidentTransfusionnel[]>(`${this.apiUrl}/date-range`, { params });
    }

    getByPatient(nom: string, prenom: string): Observable<IncidentTransfusionnel[]> {
        let params = new HttpParams()
        .set('nom', nom)
        .set('prenom', prenom);
        
        return this.http.get<IncidentTransfusionnel[]>(`${this.apiUrl}/patient`, { params });
    }

    getByNumDossier(numDossier: string): Observable<IncidentTransfusionnel[]> {
        return this.http.get<IncidentTransfusionnel[]>(`${this.apiUrl}/dossier/${numDossier}`);
    }

    getByTypeProduit(typeProduit: string): Observable<IncidentTransfusionnel[]> {
        return this.http.get<IncidentTransfusionnel[]>(`${this.apiUrl}/type-produit/${typeProduit}`);
    }

    getIncidentsNonValides(): Observable<IncidentTransfusionnel[]> {
        return this.http.get<IncidentTransfusionnel[]>(`${this.apiUrl}/non-valides`);
    }

    getIncidentsValides(): Observable<IncidentTransfusionnel[]> {
        return this.http.get<IncidentTransfusionnel[]>(`${this.apiUrl}/valides`);
    }

    // ========== RECHERCHE AVANCÉE ==========

    searchByCriteria(criteria: {
        dateIncident?: Date;
        startDate?: Date;
        endDate?: Date;
        patientNom?: string;
        patientPrenom?: string;
        patientNumDossier?: string;
        typeProduit?: string;
        valide?: boolean;
    }): Observable<IncidentTransfusionnel[]> {
        let params = new HttpParams();
        
        if (criteria.dateIncident) {
        params = params.set('dateIncident', criteria.dateIncident.toISOString().split('T')[0]);
        }
        
        if (criteria.startDate) {
        params = params.set('startDate', criteria.startDate.toISOString().split('T')[0]);
        }
        
        if (criteria.endDate) {
        params = params.set('endDate', criteria.endDate.toISOString().split('T')[0]);
        }
        
        if (criteria.patientNom) {
        params = params.set('patientNom', criteria.patientNom);
        }
        
        if (criteria.patientPrenom) {
        params = params.set('patientPrenom', criteria.patientPrenom);
        }
        
        if (criteria.patientNumDossier) {
        params = params.set('patientNumDossier', criteria.patientNumDossier);
        }
        
        if (criteria.typeProduit) {
        params = params.set('typeProduit', criteria.typeProduit);
        }
        
        if (criteria.valide !== undefined) {
        params = params.set('valide', criteria.valide.toString());
        }
        
        return this.http.get<IncidentTransfusionnel[]>(`${this.apiUrl}/search`, { params });
    }

    // ========== MISE À JOUR ==========

    update(id: number, incident: IncidentTransfusionnel): Observable<IncidentTransfusionnel> {
        console.log('Envoi modification incident ID:', id, incident);
        return this.http.put<IncidentTransfusionnel>(`${this.apiUrl}/${id}`, incident, this.httpOptions);
    }

    validerIncident(id: number, signatureResponsableQualite: string): Observable<any> {
        let params = new HttpParams()
        .set('signatureResponsableQualite', signatureResponsableQualite);
        
        return this.http.patch<any>(`${this.apiUrl}/${id}/validation`, {}, { 
        ...this.httpOptions,
        params 
        });
    }

    updateSignatureDeclarant(id: number, signatureDeclarant: string): Observable<IncidentTransfusionnel> {
        return this.http.patch<IncidentTransfusionnel>(
        `${this.apiUrl}/${id}/signature-declarant`,
        { signatureDeclarant },
        this.httpOptions
        );
    }

    ajouterAnalyse(id: number, analysePreliminaire: string): Observable<IncidentTransfusionnel> {
        return this.http.patch<IncidentTransfusionnel>(
        `${this.apiUrl}/${id}/analyse`,
        { analysePreliminaire },
        this.httpOptions
        );
    }

    ajouterActionsCorrectives(id: number, actionsCorrectives: string): Observable<IncidentTransfusionnel> {
        return this.http.patch<IncidentTransfusionnel>(
        `${this.apiUrl}/${id}/actions-correctives`,
        { actionsCorrectives },
        this.httpOptions
        );
    }

    // ========== SUPPRESSION ==========

    delete(id: number): Observable<any> {
        return this.http.delete<any>(`${this.apiUrl}/${id}`);
    }

    // ========== STATISTIQUES ==========

    getTotalIncidents(): Observable<{total: number}> {
        return this.http.get<{total: number}>(`${this.apiUrl}/statistiques/total`);
    }

    countByStatutValidation(valide: boolean): Observable<{valide: boolean, count: number}> {
        const statut = valide ? 'valides' : 'non-valides';
        return this.http.get<{valide: boolean, count: number}>(
        `${this.apiUrl}/statistiques/${statut}`
        );
    }

    getStatistiquesGlobales(): Observable<StatistiquesIncident> {
        return this.http.get<StatistiquesIncident>(`${this.apiUrl}/statistiques/global`);
    }

    getStatistiquesParMois(annee: number): Observable<{[mois: string]: number}> {
        return this.http.get<{[mois: string]: number}>(`${this.apiUrl}/statistiques/mensuelles/${annee}`);
    }

    getStatistiquesParTypeProduit(): Observable<{[typeProduit: string]: number}> {
        return this.http.get<{[typeProduit: string]: number}>(`${this.apiUrl}/statistiques/type-produit`);
    }

    // ========== RAPPORTS ==========

    genererRapportIncident(incidentId: number): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/${incidentId}/rapport`);
    }

    genererRapportMensuel(mois: number, annee: number): Observable<any> {
        let params = new HttpParams()
        .set('mois', mois.toString())
        .set('annee', annee.toString());
        
        return this.http.get<any>(`${this.apiUrl}/rapports/mensuel`, { params });
    }

    genererRapportHemovigilance(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/rapports/hemovigilance`);
    }

    // ========== VALIDATIONS ==========

    verifierDonneesObligatoires(incident: CreerIncidentRequest): { valide: boolean; erreurs: string[] } {
        const erreurs: string[] = [];

        if (!incident.transfusionId) {
        erreurs.push('Une transfusion doit être associée à l\'incident');
        }

        if (!incident.dateIncident) {
        erreurs.push('La date de l\'incident est obligatoire');
        }

        if (!incident.heureIncident) {
        erreurs.push('L\'heure de l\'incident est obligatoire');
        }

        if (!incident.lieuIncident || incident.lieuIncident.trim().length === 0) {
        erreurs.push('Le lieu de l\'incident est obligatoire');
        }

        if (!incident.patientNom || incident.patientNom.trim().length === 0) {
        erreurs.push('Le nom du patient est obligatoire');
        }

        if (!incident.patientPrenom || incident.patientPrenom.trim().length === 0) {
        erreurs.push('Le prénom du patient est obligatoire');
        }

        if (!incident.patientNumDossier || incident.patientNumDossier.trim().length === 0) {
        erreurs.push('Le numéro de dossier du patient est obligatoire');
        }

        if (!incident.typeProduitTransfuse || incident.typeProduitTransfuse.trim().length === 0) {
        erreurs.push('Le type de produit transfusé est obligatoire');
        }

        if (!incident.numeroLotProduit || incident.numeroLotProduit.trim().length === 0) {
        erreurs.push('Le numéro de lot du produit est obligatoire');
        }

        if (!incident.nomDeclarant || incident.nomDeclarant.trim().length === 0) {
        erreurs.push('Le nom du déclarant est obligatoire');
        }

        if (!incident.fonctionDeclarant || incident.fonctionDeclarant.trim().length === 0) {
        erreurs.push('La fonction du déclarant est obligatoire');
        }

        return {
        valide: erreurs.length === 0,
        erreurs: erreurs
        };
    }

    // ========== MÉTHODES UTILITAIRES ==========

    /**
     * Formate une date pour l'API
     */
    private formatDateForAPI(date: Date | string): string {
        if (date instanceof Date) {
        return date.toISOString().split('T')[0];
        }
        return date;
    }

    /**
     * Formate l'heure pour l'API
     */
    private formatTimeForAPI(time: string): string {
        // Convertir "HH:mm" en "HH:mm:ss"
        if (time && time.length === 5) {
        return time + ':00';
        }
        return time;
    }

    /**
     * Vérifie et formate les données avant envoi
     */
private preparerDonneesIncident(request: CreerIncidentRequest): any {
    const donneesFormatees: any = { 
        ...request,
        // Supprimer transfusionId du niveau racine
    };
    
    // Supprimer cette ligne qui crée l'objet transfusion incorrect
    // donneesFormatees.transfusion = { id: request.transfusionId };
    
    // Formater les noms et prénoms
    donneesFormatees.patientPrenom = this.capitalizeFirstLetter(request.patientPrenom.trim());
    donneesFormatees.patientNom = request.patientNom.toUpperCase().trim();
    donneesFormatees.nomDeclarant = request.nomDeclarant.toUpperCase().trim();
    
    // Formater les champs avec capitalisation
    donneesFormatees.lieuIncident = this.capitalizeFirstLetter(request.lieuIncident.trim());
    donneesFormatees.typeProduitTransfuse = this.capitalizeFirstLetter(request.typeProduitTransfuse.trim());
    donneesFormatees.fonctionDeclarant = this.capitalizeFirstLetter(request.fonctionDeclarant.trim());
    
    // Formater les identifiants
    donneesFormatees.patientNumDossier = request.patientNumDossier.toUpperCase().trim();
    donneesFormatees.numeroLotProduit = request.numeroLotProduit.toUpperCase().trim();
    
    // Formater les dates (LocalDate)
    if (request.dateIncident) {
        donneesFormatees.dateIncident = this.formatDateForAPI(request.dateIncident);
    }
    
    if (request.patientDateNaissance) {
        donneesFormatees.patientDateNaissance = this.formatDateForAPI(request.patientDateNaissance);
    }
    
    if (request.datePeremptionProduit) {
        donneesFormatees.datePeremptionProduit = this.formatDateForAPI(request.datePeremptionProduit);
    }
    
    // Formater l'heure (LocalTime)
    if (request.heureIncident) {
        donneesFormatees.heureIncident = this.formatTimeForAPI(request.heureIncident);
    }
    
    // Ne pas inclure ces champs - seront générés côté serveur
    delete donneesFormatees.dateHeureDeclaration;
    delete donneesFormatees.dateValidation;
    delete donneesFormatees.id;
    
    // Pour la relation transfusion, nous devons l'envoyer comme une URI ou un objet lié
    // Selon Spring Data REST, nous devons utiliser un lien
    // Voir solution ci-dessous
    
    return donneesFormatees;
}

    /**
     * Capitalise la première lettre
     */
    private capitalizeFirstLetter(str: string): string {
        if (!str || str.length === 0) {
        return str;
        }
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Génère un objet rapport pour un incident
     */
    genererRapportSimple(incident: IncidentTransfusionnel): any {
        return {
        id: incident.id,
        dateIncident: incident.dateIncident,
        heureIncident: incident.heureIncident,
        lieuIncident: incident.lieuIncident,
        patient: `${incident.patientPrenom} ${incident.patientNom}`,
        dateNaissance: incident.patientDateNaissance,
        numDossier: incident.patientNumDossier,
        typeProduit: incident.typeProduitTransfuse,
        numeroLot: incident.numeroLotProduit,
        datePeremption: incident.datePeremptionProduit,
        description: incident.descriptionIncident || 'N/A',
        signes: incident.signes || 'N/A',
        symptomes: incident.symptomes || 'N/A',
        actionsImmediates: incident.actionsImmediates || 'N/A',
        personnesInformees: incident.personnesInformees || 'N/A',
        analysePreliminaire: incident.analysePreliminaire || 'N/A',
        actionsCorrectives: incident.actionsCorrectives || 'N/A',
        declarant: incident.nomDeclarant,
        fonctionDeclarant: incident.fonctionDeclarant,
        dateDeclaration: incident.dateHeureDeclaration,
        registreHemovigilance: incident.registreHemovigilance || 'N/A',
        valide: incident.dateValidation ? 'OUI' : 'NON',
        dateValidation: incident.dateValidation || 'N/A'
        };
    }

    /**
     * Télécharge un rapport PDF
     */
    telechargerRapportPDF(incidentId: number): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/${incidentId}/rapport-pdf`, {
        responseType: 'blob'
        });
    }

    /**
     * Télécharge un rapport d'hémovigilance PDF
     */
    telechargerRapportHemovigilancePDF(): Observable<Blob> {
        return this.http.get(`${this.apiUrl}/rapports/hemovigilance-pdf`, {
        responseType: 'blob'
        });
    }

    /**
     * Exporte les données en Excel
     */
    exporterExcel(criteria?: any): Observable<Blob> {
        let params = new HttpParams();
        
        if (criteria) {
        Object.keys(criteria).forEach(key => {
            if (criteria[key] !== undefined && criteria[key] !== null) {
            params = params.set(key, criteria[key].toString());
            }
        });
        }
        
        return this.http.get(`${this.apiUrl}/export/excel`, {
        params,
        responseType: 'blob'
        });
    }
    }