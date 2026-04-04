import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface DashboardStats {
  totalProduits: number;
  produitsDisponibles: number;
  produitsDelivres: number;
  produitsUtilises: number;
  produitsExpires: number;
  produitsProchesPeremption: number;

  totalDemandes: number;
  demandesEnAttente: number;
  demandesValidees: number;
  demandesRejetees: number;
  demandesDelivrees: number;
  demandesUrgentes: number;

  totalDelivrances: number;
  delivrancesAujourdhui: number;
  delivrancesCeMois: number;

  totalTransfusions: number;
  transfusionsAvecEffets: number;
  transfusionsSansEffets: number;

  totalIncidents: number;
  incidentsValides: number;
  incidentsNonValides: number;
}

export interface DashboardAlert {
  niveau: 'INFO' | 'WARNING' | 'DANGER' | string;
  code: string;
  titre: string;
  message: string;
  valeur: number;
}

export interface DashboardBloodGroup {
  groupe: string;
  total: number;
  disponibles: number;
}

export interface DashboardProductType {
  type: string;
  total: number;
  disponibles: number;
}

export interface DashboardOverview {
  stats: DashboardStats;
  alertes: DashboardAlert[];
  stockParGroupe: DashboardBloodGroup[];
  stockParType: DashboardProductType[];
}

export interface DashboardRecentActivity {
  id: number;
  type: 'DEMANDE' | 'DÉLIVRANCE' | 'TRANSFUSION' | string;
  titre: string;
  description: string;
  statut: string;
  dateHeure: string;
}

export interface DashboardRecentActivities {
  dernieresDemandes: DashboardRecentActivity[];
  dernieresDelivrances: DashboardRecentActivity[];
  dernieresTransfusions: DashboardRecentActivity[];
}

export interface DashboardTrendPoint {
  label: string;
  demandes: number;
  delivrances: number;
  transfusions: number;
  incidents: number;
}

export interface DashboardTrends {
  points: DashboardTrendPoint[];
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly apiUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  getOverview(): Observable<DashboardOverview> {
    return this.http.get<DashboardOverview>(`${this.apiUrl}/overview`);
  }

  getRecentActivities(limit = 10): Observable<DashboardRecentActivities> {
    return this.http.get<DashboardRecentActivities>(`${this.apiUrl}/recent-activities?limit=${limit}`);
  }

  getTrends(days = 7): Observable<DashboardTrends> {
    return this.http.get<DashboardTrends>(`${this.apiUrl}/trends?days=${days}`);
  }
}