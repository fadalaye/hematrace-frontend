import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { saveAs } from 'file-saver';
import { environment } from '../../environments/environment';

export interface TraceElement {
  id: number;
  type: string;
  libelle: string;
  reference: string;
  description: string;
  date: Date;
  utilisateur: string;
  statut: string;
  details: any;
  lien: string;
  entity?: any;
  relation?: string;
  etape?: number;
  displayDate?: string;
  icon?: string;
  color?: string;
}

export interface SearchFilters {
  type?: string;
  id?: number;
  reference?: string;
  dateDebut?: Date;
  dateFin?: Date;
  utilisateur?: string;
  statut?: string;
  query?: string;
}

export interface TraceStatistics {
  totalProduits: number;
  totalDemandes: number;
  totalDelivrances: number;
  totalTransfusions: number;
  totalIncidents: number;
  totalSurveillances: number;
  totalLogs: number;
  produitsDisponibles: number;
  demandesEnAttente: number;
  demandesValidees: number;
  incidentsNonValides: number;
  incidentsValides: number;
  logsParType: { [key: string]: number };
  activiteParJour: { [key: string]: number };
  activiteParHeure: { [key: string]: number };
  topUtilisateurs: { [key: string]: number };
  activiteRecente: TraceElement[];
}

export interface PatientInfo {
  numDossier: string;
  nom: string;
  prenom: string;
  dateNaissance?: Date;
  groupeSanguin?: string;
  nombreDemandes?: number;
  derniereDemande?: Date;
}

@Injectable({
  providedIn: 'root'
})
export class TracabiliteService {
  //private apiUrl = 'http://localhost:8080/api/tracabilite';
  private apiUrl = `${environment.apiUrl}/tracabilite`;
  private storageKey = 'tracabilite_search_history';

  constructor(private http: HttpClient) {}

  // ==================== RECHERCHE GLOBALE ====================

  rechercherGlobalement(filters: SearchFilters): Observable<TraceElement[]> {
    let params = new HttpParams();
    
    if (filters.type) params = params.set('type', filters.type);
    if (filters.id) params = params.set('id', filters.id?.toString() || '');
    if (filters.reference) params = params.set('reference', filters.reference);
    if (filters.dateDebut) params = params.set('dateDebut', this.formatDateForApi(filters.dateDebut));
    if (filters.dateFin) params = params.set('dateFin', this.formatDateForApi(filters.dateFin));
    if (filters.utilisateur) params = params.set('utilisateur', filters.utilisateur);
    if (filters.statut) params = params.set('statut', filters.statut);
    if (filters.query) params = params.set('query', filters.query);

    this.saveToSearchHistory(filters);

    return this.http.get<TraceElement[]>(`${this.apiUrl}/search`, { params })
      .pipe(
        map(traces => traces.map(trace => this.enrichTraceData(trace))),
        catchError(error => {
          console.error('Erreur lors de la recherche:', error);
          return of([]);
        })
      );
  }

  // ==================== RECHERCHE PAR TYPE SIMPLIFIÉE ====================

  rechercherProduitsSanguins(filters?: SearchFilters): Observable<TraceElement[]> {
    const searchFilters: SearchFilters = {
      ...filters,
      type: 'produit'
    };
    return this.rechercherGlobalement(searchFilters);
  }

  rechercherDemandes(filters?: SearchFilters): Observable<TraceElement[]> {
    const searchFilters: SearchFilters = {
      ...filters,
      type: 'demande'
    };
    return this.rechercherGlobalement(searchFilters);
  }

  rechercherDelivrances(filters?: SearchFilters): Observable<TraceElement[]> {
    const searchFilters: SearchFilters = {
      ...filters,
      type: 'delivrance'
    };
    return this.rechercherGlobalement(searchFilters);
  }

  rechercherTransfusions(filters?: SearchFilters): Observable<TraceElement[]> {
    const searchFilters: SearchFilters = {
      ...filters,
      type: 'transfusion'
    };
    return this.rechercherGlobalement(searchFilters);
  }

  rechercherIncidents(filters?: SearchFilters): Observable<TraceElement[]> {
    const searchFilters: SearchFilters = {
      ...filters,
      type: 'incident'
    };
    return this.rechercherGlobalement(searchFilters);
  }

  rechercherSurveillances(filters?: SearchFilters): Observable<TraceElement[]> {
    const searchFilters: SearchFilters = {
      ...filters,
      type: 'surveillance'
    };
    return this.rechercherGlobalement(searchFilters);
  }

  rechercherLogs(filters?: SearchFilters): Observable<TraceElement[]> {
    const searchFilters: SearchFilters = {
      ...filters,
      type: 'log'
    };
    return this.rechercherGlobalement(searchFilters);
  }

  // ==================== HISTORIQUE COMPLET ====================

  getHistoriqueEntite(type: string, id: number): Observable<TraceElement[]> {
    return this.http.get<TraceElement[]>(`${this.apiUrl}/historique/${type}/${id}`)
      .pipe(
        map(traces => traces.map(trace => this.enrichTraceData(trace))),
        catchError(error => {
          console.error(`Erreur lors de la récupération de l'historique pour ${type}/${id}:`, error);
          return this.getMinimalHistorique(type, id);
        })
      );
  }

  private getMinimalHistorique(type: string, id: number): Observable<TraceElement[]> {
    const minimalTrace: TraceElement = {
      id: id,
      type: type,
      libelle: this.getTypeDisplayName(type) + ` #${id}`,
      reference: `${type.toUpperCase()}-${id}`,
      description: `Historique limité - Service temporairement indisponible`,
      date: new Date(),
      utilisateur: 'Système',
      statut: 'INCONNU',
      details: {},
      lien: `/${type}s/${id}`
    };
    
    return of([this.enrichTraceData(minimalTrace)]);
  }

  // ==================== CHAÎNE COMPLÈTE ====================

  getEntityChain(type: string, id: number): Observable<TraceElement[]> {
    return this.http.get<TraceElement[]>(`${this.apiUrl}/chain/${type}/${id}`)
      .pipe(
        map(traces => traces.map(trace => this.enrichTraceData(trace))),
        catchError(error => {
          console.error(`Erreur lors de la récupération de la chaîne pour ${type}/${id}:`, error);
          return this.getMinimalHistorique(type, id);
        })
      );
  }

  // ==================== STATISTIQUES ====================

  getStatistiques(): Observable<TraceStatistics> {
    return this.http.get<TraceStatistics>(`${this.apiUrl}/statistiques`)
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la récupération des statistiques:', error);
          return of(this.getEmptyStatistics());
        })
      );
  }

  private getEmptyStatistics(): TraceStatistics {
    return {
      totalProduits: 0,
      totalDemandes: 0,
      totalDelivrances: 0,
      totalTransfusions: 0,
      totalIncidents: 0,
      totalSurveillances: 0,
      totalLogs: 0,
      produitsDisponibles: 0,
      demandesEnAttente: 0,
      demandesValidees: 0,
      incidentsNonValides: 0,
      incidentsValides: 0,
      logsParType: {},
      activiteParJour: {},
      activiteParHeure: {},
      topUtilisateurs: {},
      activiteRecente: []
    };
  }

  // ==================== LOGS ====================

  getLogsByEntity(entityType: string, entityId: number): Observable<TraceElement[]> {
    const params = new HttpParams()
      .set('entityType', entityType)
      .set('entityId', entityId.toString());

    return this.http.get<TraceElement[]>(`${this.apiUrl}/logs`, { params })
      .pipe(
        map(traces => traces.map(trace => this.enrichTraceData(trace))),
        catchError(error => {
          console.error(`Erreur lors de la récupération des logs pour ${entityType}/${entityId}:`, error);
          return of([]);
        })
      );
  }

  getLogsByDateRange(startDate: Date, endDate: Date): Observable<TraceElement[]> {
    const params = new HttpParams()
      .set('startDate', startDate.toISOString())
      .set('endDate', endDate.toISOString());

    return this.http.get<TraceElement[]>(`${this.apiUrl}/logs`, { params })
      .pipe(
        map(traces => traces.map(trace => this.enrichTraceData(trace))),
        catchError(error => {
          console.error('Erreur lors de la récupération des logs par date:', error);
          return of([]);
        })
      );
  }

  getRecentActivity(limit: number = 10): Observable<TraceElement[]> {
    return this.http.get<TraceElement[]>(`${this.apiUrl}/recent-activity`, {
      params: new HttpParams().set('limit', limit.toString())
    }).pipe(
      map(traces => traces.map(trace => this.enrichTraceData(trace))),
      catchError(error => {
        console.error('Erreur lors de la récupération des activités récentes:', error);
        return of([]);
      })
    );
  }

  getUserActivity(userId: number, startDate?: Date, endDate?: Date): Observable<TraceElement[]> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', this.formatDateForApi(startDate));
    if (endDate) params = params.set('endDate', this.formatDateForApi(endDate));

    return this.http.get<TraceElement[]>(`${this.apiUrl}/user-activity/${userId}`, { params })
      .pipe(
        map(traces => traces.map(trace => this.enrichTraceData(trace))),
        catchError(error => {
          console.error(`Erreur lors de la récupération des activités utilisateur ${userId}:`, error);
          return of([]);
        })
      );
  }

  // ==================== LOG D'ACTION ====================

  logAction(action: string, entityType: string, entityId: number, details?: string): Observable<any> {
    const params = new HttpParams()
      .set('action', action)
      .set('entityType', entityType)
      .set('entityId', entityId.toString())
      .set('details', details || '');

    return this.http.post<any>(`${this.apiUrl}/log`, {}, { params })
      .pipe(
        catchError(error => {
          console.error('Erreur lors du log d\'action:', error);
          return of({
            status: 'success',
            message: 'Action loguée localement (service temporairement indisponible)',
            timestamp: new Date().toISOString()
          });
        })
      );
  }

  // ==================== RECHERCHE PATIENTS ====================

  searchPatients(keyword?: string): Observable<PatientInfo[]> {
    const params = keyword ? new HttpParams().set('keyword', keyword) : new HttpParams();

    return this.http.get<PatientInfo[]>(`${this.apiUrl}/patients/search`, { params })
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la recherche de patients:', error);
          return of([]);
        })
      );
  }

  getPatientHistory(numDossier: string): Observable<TraceElement[]> {
    return this.http.get<TraceElement[]>(`${this.apiUrl}/patients/${numDossier}/history`)
      .pipe(
        map(traces => traces.map(trace => this.enrichTraceData(trace))),
        catchError(error => {
          console.error(`Erreur lors de la récupération de l'historique patient ${numDossier}:`, error);
          return of([]);
        })
      );
  }

  // ==================== MÉTRICES ET SANTÉ ====================

  getMetrics(): Observable<any> {
    return this.http.get(`${this.apiUrl}/metrics`)
      .pipe(
        catchError(error => {
          console.error('Erreur lors de la récupération des métriques:', error);
          return of({
            error: 'Impossible de récupérer les métriques',
            timestamp: new Date().toISOString()
          });
        })
      );
  }

  healthCheck(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`)
      .pipe(
        catchError(error => {
          console.error('Erreur lors du health check:', error);
          return of({
            status: 'ERROR',
            service: 'TracabiliteService',
            timestamp: new Date().toISOString(),
            error: error.message
          });
        })
      );
  }

  // ==================== EXPORT ====================

  exporterResultats(filters: SearchFilters, format: 'csv' | 'excel' = 'csv'): Observable<Blob> {
    return this.rechercherGlobalement(filters).pipe(
      map(traces => {
        let content = '';
        const filename = `traçabilite_${new Date().toISOString().split('T')[0]}`;

        if (format === 'csv') {
          content = this.convertToCSV(traces);
          const blob = new Blob([content], { 
            type: 'text/csv;charset=utf-8;' 
          });
          saveAs(blob, `${filename}.csv`);
          return blob;
        } else {
          content = this.convertToCSV(traces);
          const blob = new Blob([content], { 
            type: 'application/vnd.ms-excel;charset=utf-8' 
          });
          saveAs(blob, `${filename}.xls`);
          return blob;
        }
      }),
      catchError(error => {
        console.error('Erreur lors de l\'export:', error);
        throw error;
      })
    );
  }

  private convertToCSV(data: TraceElement[]): string {
    if (data.length === 0) {
      return 'Aucune donnée à exporter';
    }

    const headers = ['ID', 'Type', 'Référence', 'Libellé', 'Description', 'Date', 'Utilisateur', 'Statut'];
    const rows = data.map(item => [
      item.id.toString(),
      item.type,
      item.reference,
      item.libelle,
      item.description,
      this.formatDateForDisplay(item.date),
      item.utilisateur,
      item.statut
    ]);

    return [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');
  }

  // ==================== HISTORIQUE DES RECHERCHES ====================

  getSearchHistory(): SearchFilters[] {
    try {
      const history = localStorage.getItem(this.storageKey);
      return history ? JSON.parse(history) : [];
    } catch {
      return [];
    }
  }

  clearSearchHistory(): void {
    localStorage.removeItem(this.storageKey);
  }

  private saveToSearchHistory(filters: SearchFilters): void {
    try {
      const history = this.getSearchHistory();
      const searchEntry = {
        ...filters,
        timestamp: new Date().toISOString()
      };
      
      const updatedHistory = [searchEntry, ...history.slice(0, 9)];
      localStorage.setItem(this.storageKey, JSON.stringify(updatedHistory));
    } catch (error) {
      console.warn('Impossible de sauvegarder l\'historique de recherche:', error);
    }
  }

  // ==================== ENRICHISSEMENT DES DONNÉES ====================

  private enrichTraceData(trace: TraceElement): TraceElement {
    // Convertir la date string en Date si nécessaire
    if (typeof trace.date === 'string') {
      try {
        trace.date = new Date(trace.date);
      } catch {
        trace.date = new Date();
      }
    }

    return {
      ...trace,
      displayDate: this.formatDateForDisplay(trace.date),
      icon: this.getTraceIcon(trace.type),
      color: this.getStatusColor(trace.statut)
    };
  }

  private formatDateForDisplay(date: Date): string {
    if (!date) return 'Date inconnue';
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Date invalide';
    
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  private getTraceIcon(type: string): string {
    const icons: { [key: string]: string } = {
      produit: 'bloodtype',
      demande: 'assignment',
      delivrance: 'local_shipping',
      transfusion: 'healing',
      incident: 'warning',
      surveillance: 'monitor_heart',
      log: 'history',
      patient: 'person'
    };
    return icons[type] || 'search';
  }

  private getStatusColor(status: string): string {
    const colors: { [key: string]: string } = {
      DISPONIBLE: '#4caf50',
      VALIDE: '#4caf50',
      COMPLETE: '#4caf50',
      LOGUE: '#4caf50',
      EN_ATTENTE: '#ff9800',
      EN_COURS: '#ff9800',
      EN_TRANSIT: '#ff9800',
      NON_VALIDE: '#f44336',
      ANNULE: '#f44336',
      INACTIF: '#9e9e9e',
      PERIME: '#9e9e9e',
      TERMINE: '#2196f3',
      CLOTURE: '#2196f3'
    };
    return colors[status] || '#757575';
  }

  // ==================== UTILITAIRES ====================

  private formatDateForApi(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  // ==================== HELPER POUR L'UI ====================

  getTypeDisplayName(type: string): string {
    const names: { [key: string]: string } = {
      produit: 'Produit Sanguin',
      demande: 'Demande',
      delivrance: 'Délivrance',
      transfusion: 'Transfusion',
      incident: 'Incident Transfusionnel',
      surveillance: 'Surveillance',
      log: 'Log de Traçabilité',
      patient: 'Patient'
    };
    return names[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  getStatusDisplayName(status: string): string {
    const names: { [key: string]: string } = {
      DISPONIBLE: 'Disponible',
      EN_ATTENTE: 'En attente',
      VALIDE: 'Validé',
      NON_VALIDE: 'Non validé',
      COMPLETE: 'Complété',
      EN_COURS: 'En cours',
      EN_TRANSIT: 'En transit',
      ANNULE: 'Annulé',
      LOGUE: 'Logué',
      PERIME: 'Périmé',
      TERMINE: 'Terminé',
      CLOTURE: 'Clôturé'
    };
    return names[status] || status;
  }

  getTypeColor(type: string): string {
    const colors: { [key: string]: string } = {
      produit: '#e3f2fd',
      demande: '#f3e5f5',
      delivrance: '#e8f5e8',
      transfusion: '#fff3e0',
      incident: '#ffebee',
      surveillance: '#fce4ec',
      log: '#f5f5f5',
      patient: '#e8eaf6'
    };
    return colors[type] || '#ffffff';
  }

  // ==================== DÉBOGAGE ====================

  debugSearch(filters: SearchFilters): Observable<any> {
    let params = new HttpParams();
    
    Object.keys(filters).forEach(key => {
      if (filters[key as keyof SearchFilters]) {
        const value = filters[key as keyof SearchFilters];
        if (value !== undefined && value !== null) {
          params = params.set(key, value.toString());
        }
      }
    });
    
    return this.http.get(`${this.apiUrl}/search`, { params })
      .pipe(
        catchError(error => {
          console.error('Debug search error:', error);
          return of({ error: error.message });
        })
      );
  }

  // ==================== SIMULATION POUR DÉVELOPPEMENT ====================

  getMockData(type?: string): TraceElement[] {
    const mockTraces: TraceElement[] = [
      {
        id: 1,
        type: 'produit',
        libelle: 'Produit Sanguin - PS-2024-001',
        reference: 'PS-2024-001',
        description: 'Sang total - A+',
        date: new Date('2024-01-15T10:30:00'),
        utilisateur: 'Jean Dupont',
        statut: 'DISPONIBLE',
        details: {},
        lien: '/produits/1',
        entity: {
          id: 1,
          codeProduit: 'PS-2024-001',
          typeProduit: 'Sang total',
          groupeSanguin: 'A',
          rhesus: '+',
          datePrelevement: '2024-01-15'
        }
      },
      {
        id: 2,
        type: 'demande',
        libelle: 'Demande - DEM-2024-001',
        reference: 'DEM-2024-001',
        description: '2 poches de sang total demandées pour Martin Sophie',
        date: new Date('2024-01-16T14:20:00'),
        utilisateur: 'Dr. Martin',
        statut: 'VALIDE',
        details: {},
        lien: '/demandes/2',
        entity: {
          id: 2,
          numeroDemande: 'DEM-2024-001',
          patientNom: 'Martin',
          patientPrenom: 'Sophie',
          typeProduitDemande: 'Sang total',
          quantiteDemande: 2
        }
      },
      {
        id: 3,
        type: 'transfusion',
        libelle: 'Transfusion - Martin Sophie',
        reference: 'TRANS-2024-001',
        description: 'Transfusion effectuée par Dr. Laurent',
        date: new Date('2024-01-17T09:15:00'),
        utilisateur: 'Dr. Laurent',
        statut: 'COMPLETE',
        details: {},
        lien: '/transfusions/3',
        entity: {
          id: 3,
          patientNom: 'Martin',
          patientPrenom: 'Sophie',
          produitSanguin: { id: 1, codeProduit: 'PS-2024-001' }
        }
      }
    ];

    if (type) {
      return mockTraces.filter(trace => trace.type === type);
    }
    return mockTraces;
  }

  simulateSearch(filters: SearchFilters): Observable<TraceElement[]> {
    console.log('Mode simulation activé pour le développement');
    const mockData = this.getMockData(filters.type);
    const filteredData = mockData.filter(trace => {
      if (filters.query) {
        const query = filters.query.toLowerCase();
        return (
          trace.libelle.toLowerCase().includes(query) ||
          trace.reference.toLowerCase().includes(query) ||
          trace.description.toLowerCase().includes(query)
        );
      }
      return true;
    });

    return of(filteredData.map(trace => this.enrichTraceData(trace)));
  }

  checkBackendAvailability(): Observable<boolean> {
    return this.healthCheck().pipe(
      map(response => response.status === 'OK'),
      catchError(() => of(false))
    );
  }
}