import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Demande } from '../interfaces/demande.interface';

@Injectable({
    providedIn: 'root'
})
export class DemandeService {
    private apiUrl = '${environment.apiUrl}/demandes';

    private httpOptions = {
        headers: new HttpHeaders({
            'Content-Type': 'application/json'
        })
    };

    constructor(private http: HttpClient) {}

    getAll(): Observable<Demande[]> {
        return this.http.get<Demande[]>(this.apiUrl);
    }

    getById(id: number): Observable<Demande> {
        return this.http.get<Demande>(`${this.apiUrl}/${id}`);
    }

    create(demande: Demande): Observable<Demande> {
        const demandeToSend = { ...demande };
        delete demandeToSend.id;
        
        console.log('Envoi création demande:', demandeToSend);
        return this.http.post<Demande>(this.apiUrl, demandeToSend, this.httpOptions);
    }

    update(id: number, demande: Demande): Observable<Demande> {
        console.log('Envoi modification demande ID:', id, demande);
        return this.http.put<Demande>(`${this.apiUrl}/${id}`, demande, this.httpOptions);
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    updateStatut(id: number, statut: string): Observable<void> {
        return this.http.patch<void>(`${this.apiUrl}/${id}/statut?statut=${statut}`, {}, this.httpOptions);
    }

/*     validerDemande(id: number, personnelId: number): Observable<Demande> {
        return this.http.patch<Demande>(`${this.apiUrl}/${id}/valider?personnelId=${personnelId}`, {}, this.httpOptions);
    } */

    validerDemande(demandeId: number, personnelId: number): Observable<Demande> {
    return this.http.put<Demande>(
        `${this.apiUrl}/${demandeId}/valider/${personnelId}`,  // Notez le changement
        {}, 
        this.httpOptions
    )
}

    annulerDemande(id: number): Observable<void> {
        return this.http.patch<void>(`${this.apiUrl}/${id}/annuler`, {}, this.httpOptions);
    }

    getStatistiques(): Observable<any> {
        return this.http.get<any>(`${this.apiUrl}/statistiques`);
    }

    getDemandesUrgentes(): Observable<Demande[]> {
        return this.http.get<Demande[]>(`${this.apiUrl}/urgentes`);
    }

    getDemandesByStatut(statut: string): Observable<Demande[]> {
        return this.http.get<Demande[]>(`${this.apiUrl}/statut/${statut}`);
    }
}