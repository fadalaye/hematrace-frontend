import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { 
    Transfusion, 
    CreerTransfusionRequest,
    TransfusionWithSurveillancesRequest,
    IncidentTransfusionnelRequest,
    SurveillanceRequest
} from '../interfaces/transfusion.interface';
import { IncidentTransfusionnel } from '../interfaces/incident-transfusionnel.interface';
import { Surveillance } from '../interfaces/surveillance.interface';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class TransfusionService {
    //private apiUrl = 'http://localhost:8080/api/transfusions';
    private apiUrl = `${environment.apiUrl}/transfusions`;

    private httpOptions = {
        headers: new HttpHeaders({
            'Content-Type': 'application/json'
        })
    };

    constructor(private http: HttpClient) {}

    // ========== FORMATAGE ==========
    
    private formatDate(date: Date | string | undefined): string | undefined {
        if (!date) return undefined;
        
        if (typeof date === 'string') {
            return date.split('T')[0] || date;
        }
        
        if (date instanceof Date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        return undefined;
    }

    private formatTime(time: string | Date | undefined): string | undefined {
        if (!time) return undefined;
        
        if (typeof time === 'string') {
            if (time.includes(':')) {
                const parts = time.split(':');
                if (parts.length === 2) return `${time}:00`;
                if (parts.length === 1) return `${time}:00:00`;
                return time;
            }
            return `${time}:00:00`;
        }
        
        if (time instanceof Date) {
            const hours = String(time.getHours()).padStart(2, '0');
            const minutes = String(time.getMinutes()).padStart(2, '0');
            const seconds = String(time.getSeconds()).padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        }
        
        return undefined;
    }

    private prepareIncidentData(incident?: IncidentTransfusionnelRequest) {
        if (!incident) return undefined;
        
        return {
            dateIncident: this.formatDate(incident.dateIncident) || '',
            heureIncident: this.formatTime(incident.heureIncident) || '',
            lieuIncident: incident.lieuIncident,
            typeProduitTransfuse: incident.typeProduitTransfuse,
            numeroLotProduit: incident.numeroLotProduit,
            datePeremptionProduit: this.formatDate(incident.datePeremptionProduit) || '',
            descriptionIncident: incident.descriptionIncident,
            signes: incident.signes,
            symptomes: incident.symptomes,
            actionsImmediates: incident.actionsImmediates,
            personnesInformees: incident.personnesInformees,
            analysePreliminaire: incident.analysePreliminaire,
            actionsCorrectives: incident.actionsCorrectives,
            nomDeclarant: incident.nomDeclarant,
            fonctionDeclarant: incident.fonctionDeclarant,
            registreHemovigilance: incident.registreHemovigilance
        };
    }

    // ========== CRUD BASIQUE ==========
    
    getAll(): Observable<Transfusion[]> {
        return this.http.get<Transfusion[]>(this.apiUrl);
    }

    getById(id: number): Observable<Transfusion> {
        return this.http.get<Transfusion>(`${this.apiUrl}/${id}`);
    }

    create(request: CreerTransfusionRequest): Observable<Transfusion> {
        const formattedRequest = {
            ...request,
            patientDateNaissance: this.formatDate(request.patientDateNaissance) || '',
            dateTransfusion: this.formatDate(request.dateTransfusion) || this.formatDate(new Date()) || '',
            heureDebut: this.formatTime(request.heureDebut) || '00:00:00',
            heureFin: request.heureFin ? this.formatTime(request.heureFin) : undefined,
            dateDeclaration: request.dateDeclaration || this.formatDate(new Date())
        };
        
        return this.http.post<Transfusion>(this.apiUrl, formattedRequest, this.httpOptions);
    }

    // ========== CRÉATION AVEC SURVEILLANCES ET INCIDENT ==========
    
    createWithSurveillances(request: TransfusionWithSurveillancesRequest): Observable<Transfusion> {
        const formattedRequest = {
            medecinId: request.medecinId,
            produitSanguinId: request.produitSanguinId,
            patientPrenom: request.patientPrenom,
            patientNom: request.patientNom,
            patientDateNaissance: this.formatDate(request.patientDateNaissance) || '',
            patientNumDossier: request.patientNumDossier,
            groupeSanguinPatient: request.groupeSanguinPatient,
            dateTransfusion: this.formatDate(request.dateTransfusion) || this.formatDate(new Date()) || '',
            heureDebut: this.formatTime(request.heureDebut) || '00:00:00',
            heureFin: request.heureFin ? this.formatTime(request.heureFin) : undefined,
            etatPatientApres: request.etatPatientApres,
            tolerance: request.tolerance,
            effetsIndesirables: request.effetsIndesirables,
            typeEffet: request.typeEffet,
            prenomDeclarant: request.prenomDeclarant,
            nomDeclarant: request.nomDeclarant,
            fonctionDeclarant: request.fonctionDeclarant,
            notes: request.notes,
            volumeMl: request.volumeMl,
            graviteEffet: request.graviteEffet,
            dateDeclaration: request.dateDeclaration || this.formatDate(new Date()),
            incident: this.prepareIncidentData(request.incident),
            surveillances: request.surveillances.map(surv => ({
                heure: this.formatTime(surv.heure) || '',
                tension: surv.tension,
                temperature: surv.temperature,
                pouls: surv.pouls,
                signesCliniques: surv.signesCliniques,
                observations: surv.observations || ''
            }))
        };
        
        return this.http.post<Transfusion>(
            `${this.apiUrl}/avec-surveillances`, 
            formattedRequest, 
            this.httpOptions
        );
    }

    // ========== MISE À JOUR ==========
    
    update(id: number, transfusion: Transfusion): Observable<Transfusion> {
        return this.http.put<Transfusion>(`${this.apiUrl}/${id}`, transfusion, this.httpOptions);
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    // ========== MÉTHODES DE RECHERCHE ==========
    
    getByMedecin(medecinId: number): Observable<Transfusion[]> {
        return this.http.get<Transfusion[]>(`${this.apiUrl}/medecin/${medecinId}`);
    }

    getByProduitSanguin(produitSanguinId: number): Observable<Transfusion[]> {
        return this.http.get<Transfusion[]>(`${this.apiUrl}/produit-sanguin/${produitSanguinId}`);
    }

    getByGroupeSanguin(groupeSanguin: string): Observable<Transfusion[]> {
        return this.http.get<Transfusion[]>(`${this.apiUrl}/groupe-sanguin/${groupeSanguin}`);
    }

    getByTolerance(tolerance: string): Observable<Transfusion[]> {
        return this.http.get<Transfusion[]>(`${this.apiUrl}/tolerance/${tolerance}`);
    }

    getAvecEffetsIndesirables(): Observable<Transfusion[]> {
        return this.http.get<Transfusion[]>(`${this.apiUrl}/effets-indesirables`);
    }

    getByPatient(nom: string, prenom: string): Observable<Transfusion[]> {
        return this.http.get<Transfusion[]>(
            `${this.apiUrl}/patient?nom=${encodeURIComponent(nom)}&prenom=${encodeURIComponent(prenom)}`
        );
    }

    getByNumDossier(numDossier: string): Observable<Transfusion[]> {
        return this.http.get<Transfusion[]>(`${this.apiUrl}/dossier/${encodeURIComponent(numDossier)}`);
    }

    getByDate(date: string): Observable<Transfusion[]> {
        return this.http.get<Transfusion[]>(`${this.apiUrl}/date?date=${date}`);
    }

    getByDateRange(startDate: string, endDate: string): Observable<Transfusion[]> {
        return this.http.get<Transfusion[]>(
            `${this.apiUrl}/date-range?startDate=${startDate}&endDate=${endDate}`
        );
    }

    // ========== MÉTHODES STATISTIQUES ==========
    
    countByTolerance(tolerance: string): Observable<number> {
        return this.http.get<number>(`${this.apiUrl}/count/tolerance/${tolerance}`);
    }

    countAvecEffetsIndesirables(): Observable<number> {
        return this.http.get<number>(`${this.apiUrl}/count/effets-indesirables`);
    }

    // ========== MÉTHODE UTILITAIRE ==========
    
    prepareFormData(formData: any): CreerTransfusionRequest {
        return {
            medecinId: formData.medecinId,
            produitSanguinId: formData.produitSanguinId,
            patientPrenom: formData.patientPrenom,
            patientNom: formData.patientNom,
            patientDateNaissance: this.formatDate(formData.patientDateNaissance) || '',
            patientNumDossier: formData.patientNumDossier,
            groupeSanguinPatient: formData.groupeSanguinPatient,
            dateTransfusion: this.formatDate(formData.dateTransfusion) || this.formatDate(new Date()) || '',
            heureDebut: this.formatTime(formData.heureDebut) || '00:00:00',
            heureFin: formData.heureFin ? this.formatTime(formData.heureFin) : undefined,
            etatPatientApres: formData.etatPatientApres,
            tolerance: formData.tolerance,
            effetsIndesirables: formData.effetsIndesirables || false,
            typeEffet: formData.typeEffet,
            prenomDeclarant: formData.prenomDeclarant,
            nomDeclarant: formData.nomDeclarant,
            fonctionDeclarant: formData.fonctionDeclarant,
            notes: formData.notes,
            volumeMl: formData.volumeMl,
            graviteEffet: formData.graviteEffet,
            dateDeclaration: formData.dateDeclaration || this.formatDate(new Date())
        };
    }

    // ========== MÉTHODE POUR PRÉPARER LES DONNÉES AVEC SURVEILLANCES ==========
    
    prepareFormDataWithSurveillances(formData: any): TransfusionWithSurveillancesRequest {
        const baseData = this.prepareFormData(formData);
        
        return {
            ...baseData,
            incident: formData.incident ? {
                dateIncident: this.formatDate(formData.incident.dateIncident) || '',
                heureIncident: this.formatTime(formData.incident.heureIncident) || '',
                lieuIncident: formData.incident.lieuIncident,
                typeProduitTransfuse: formData.incident.typeProduitTransfuse,
                numeroLotProduit: formData.incident.numeroLotProduit,
                datePeremptionProduit: this.formatDate(formData.incident.datePeremptionProduit) || '',
                descriptionIncident: formData.incident.descriptionIncident,
                signes: formData.incident.signes,
                symptomes: formData.incident.symptomes,
                actionsImmediates: formData.incident.actionsImmediates,
                personnesInformees: formData.incident.personnesInformees,
                analysePreliminaire: formData.incident.analysePreliminaire,
                actionsCorrectives: formData.incident.actionsCorrectives,
                nomDeclarant: formData.incident.nomDeclarant,
                fonctionDeclarant: formData.incident.fonctionDeclarant,
                registreHemovigilance: formData.incident.registreHemovigilance
            } : undefined,
            surveillances: formData.surveillances?.map((surv: any) => ({
                heure: this.formatTime(surv.heure) || '',
                tension: surv.tension,
                temperature: surv.temperature,
                pouls: surv.pouls,
                signesCliniques: surv.signesCliniques,
                observations: surv.observations
            })) || []
        };
    }

    /**
 * Récupère les transfusions sans incident déclaré
 */
getTransfusionsSansIncident(): Observable<Transfusion[]> {
    return this.http.get<Transfusion[]>(`${this.apiUrl}/sans-incident`);
}

/**
 * Vérifie si une transfusion a déjà un incident
 */
hasIncident(transfusionId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/${transfusionId}/has-incident`);
}

/**
 * Récupère toutes les transfusions avec filtre pour exclure celles ayant des incidents
 */
getTransfusionsCompatibles(): Observable<Transfusion[]> {
    return this.http.get<Transfusion[]>(`${this.apiUrl}/compatibles-incident`);
}
}