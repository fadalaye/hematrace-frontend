import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AnyUtilisateur, getUserType } from '../interfaces/any-utilisateur.interface';
import { Demande } from '../interfaces/demande.interface';
import { Delivrance } from '../interfaces/delivrance.interface';
import { Transfusion } from '../interfaces/transfusion.interface';
import { IncidentTransfusionnel } from '../interfaces/incident-transfusionnel.interface';
import { environment } from '../../environments/environment';

export interface LoginCredentials {
  identifiant: string;
  motDePasse: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: AnyUtilisateur;
  permissions?: string[];
  errorType?: 'IDENTIFIANT' | 'MOT_DE_PASSE' | 'OTHER';
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  //private apiUrl = 'http://localhost:8080/api/auth';
  private apiUrl = '${environment.apiUrl}/auth';
  
  private httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  private currentUserSubject = new BehaviorSubject<AnyUtilisateur | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();
  
  isAuthenticated = signal<boolean>(false);
  userPermissions = signal<string[]>([]);
  isLoading = signal<boolean>(true);

  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'current_user';
  private readonly PERMISSIONS_KEY = 'user_permissions';

  constructor() {
    this.checkExistingAuth();
  }

  // ==================== AUTHENTIFICATION ====================

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials, this.httpOptions)
      .pipe(
        tap(response => {
          if (response && response.success && response.token && response.user) {
            this.setAuthData(response.token, response.user, response.permissions || []);
          }
        }),
        catchError(this.handleAuthError)
      );
  }

  refreshToken(): Observable<{ success: boolean; token?: string; message?: string }> {
    const token = this.getToken();
    if (!token) {
      return throwError(() => ({ success: false, message: 'Aucun token disponible' }));
    }
    
    return this.http.post<{ success: boolean; token?: string; message?: string }>(
      `${this.apiUrl}/refresh`, { token }, this.httpOptions
    ).pipe(catchError(this.handleRefreshError));
  }

  logout(): void {
    this.clearAuthData();
    this.router.navigate(['/login']);
  }

  // ==================== VÉRIFICATIONS GÉNÉRALES ====================

  isLoggedIn(): boolean {
    const token = this.getToken();
    return token ? this.isTokenValid(token) && this.isAuthenticated() : false;
  }

  isSuperUser(): boolean {
    return this.hasAnyRole(['ADMIN', 'CHEF_SERVICE']);
  }

  // ==================== VÉRIFICATIONS PAR RÔLE ====================

  isPersonnel(): boolean {
    return this.hasRole('PERSONNEL');
  }

  isMedecin(): boolean {
    return this.hasRole('MEDECIN');
  }

  isChefService(): boolean {
    return this.hasRole('CHEF_SERVICE');
  }

  isAdmin(): boolean {
    return this.hasRole('ADMIN');
  }

  // ==================== VÉRIFICATIONS PAR MODULE ====================

  // PRODUITS SANGUINS
  canManageProducts(): boolean {
    return this.hasAnyPermission(['BLOOD_PRODUCT_MANAGEMENT', 'STOCK_MANAGEMENT']) ||
           this.isSuperUser() ||
           this.isPersonnel();
  }

  canViewProducts(): boolean {
    return this.hasAnyPermission(['BLOOD_PRODUCT_VIEW', 'BLOOD_PRODUCT_MANAGEMENT']) ||
           this.hasAnyRole(['PERSONNEL', 'MEDECIN', 'CHEF_SERVICE', 'ADMIN']);
  }

  canCreateProduct(): boolean {
    return this.hasPermission('BLOOD_PRODUCT_CREATE') || this.isSuperUser() || this.isPersonnel();
  }

  canUpdateProduct(): boolean {
    return this.hasPermission('BLOOD_PRODUCT_UPDATE') || this.isSuperUser() || this.isPersonnel();
  }

  canDeleteProduct(): boolean {
    return this.hasPermission('BLOOD_PRODUCT_DELETE') || this.isSuperUser();
  }

  // DEMANDES
  canCreateDemande(): boolean {
    return this.hasPermission('DEMANDE_CREATE') || this.isSuperUser() || this.isMedecin();
  }

  canValidateDemande(): boolean {
    return this.hasPermission('DEMANDE_VALIDATE') || this.isSuperUser() || this.isPersonnel();
  }

  canViewDemandes(): boolean {
    return this.hasAnyPermission(['DEMANDE_VIEW', 'DEMANDE_MANAGEMENT']) ||
           this.hasAnyRole(['PERSONNEL', 'MEDECIN', 'CHEF_SERVICE', 'ADMIN']);
  }

  canUpdateDemande(): boolean {
    return this.hasPermission('DEMANDE_UPDATE') || this.isSuperUser() || this.isMedecin();
  }

/*   canDeleteDemande(): boolean {
    return this.hasPermission('DEMANDE_DELETE') || this.isSuperUser();
  } */

  // DÉLIVRANCES


  // TRANSFUSIONS
  canCreateTransfusion(): boolean {
    return this.hasPermission('TRANSFUSION_CREATE') || this.isSuperUser() || this.isMedecin();
  }

  canViewTransfusions(): boolean {
    return this.hasAnyPermission(['TRANSFUSION_VIEW', 'TRANSFUSION_MANAGEMENT']) ||
           this.hasAnyRole(['PERSONNEL', 'MEDECIN', 'CHEF_SERVICE', 'ADMIN']);
  }

  canUpdateTransfusion(): boolean {
    return this.hasPermission('TRANSFUSION_UPDATE') || this.isSuperUser() || this.isMedecin();
  }

  canDeleteTransfusion(): boolean {
    return this.hasPermission('TRANSFUSION_DELETE') || this.isSuperUser() || this.isMedecin();
  }

  // TRAÇABILITÉ
  canManageTraceability(): boolean {
    return this.hasAnyPermission(['TRACABILITY_CREATE', 'TRACABILITY_UPDATE']) ||
           this.isSuperUser() || this.isPersonnel();
  }

  canViewTraceability(): boolean {
    return this.hasPermission('TRACABILITY_VIEW') ||
           this.hasAnyRole(['PERSONNEL', 'MEDECIN', 'CHEF_SERVICE', 'ADMIN']);
  }

  // INCIDENTS
  canCreateIncident(): boolean {
    return this.hasPermission('INCIDENT_CREATE') || this.isSuperUser() || this.isMedecin();
  }

  canViewIncidents(): boolean {
    return this.hasAnyPermission(['INCIDENT_VIEW', 'INCIDENT_MANAGEMENT']) ||
           this.hasAnyRole(['PERSONNEL', 'MEDECIN', 'CHEF_SERVICE', 'ADMIN']);
  }

  canUpdateIncident(): boolean {
    return this.hasPermission('INCIDENT_UPDATE') || this.isSuperUser() || this.isMedecin();
  }
  
    canValidateIncident(): boolean {
     return this.isPersonnel() || this.isSuperUser();
  }

  canDeleteIncident(): boolean {
    return this.hasPermission('INCIDENT_DELETE') || this.isSuperUser() || this.isMedecin();
  }

  // UTILISATEURS
  canManageUsers(): boolean {
    return this.hasPermission('USER_MANAGEMENT') || this.isSuperUser();
  }

  canViewUsers(): boolean {
    return this.hasPermission('USER_MANAGEMENT') || this.isSuperUser();
  }

  // ==================== MÉTHODES DE BASE ====================

  hasPermission(permission: string): boolean {
    return this.userPermissions().includes(permission) || this.isSuperUser();
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user ? getUserType(user) === role : false;
  }

  hasAnyPermission(permissions: string[]): boolean {
    return permissions.some(permission => this.hasPermission(permission));
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.some(role => this.hasRole(role));
  }

  getCurrentUser(): AnyUtilisateur | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  // ==================== MÉTHODES UTILITAIRES UI ====================

  showValidateDemandeButton(): boolean {
    return this.isPersonnel() || this.isSuperUser();
  }

  showCreateDemandeButton(): boolean {
    return this.isMedecin() || this.isSuperUser();
  }

  showCreateProductButton(): boolean {
    return this.isPersonnel() || this.isSuperUser();
  }

  showCreateDelivranceButton(): boolean {
    return this.isPersonnel() || this.isSuperUser();
  }

  showCreateTransfusionButton(): boolean {
    return this.isMedecin() || this.isSuperUser();
  }

  showCreateIncidentButton(): boolean {
    return this.isMedecin() || this.isSuperUser();
  }

  canModifyOwnDemande(demande: any): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    return (this.isMedecin() && demande.medecinId === user.id) || this.isSuperUser();
  }

  canModifyOwnDelivrance(delivrance: any): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    
    return (this.isPersonnel() && delivrance.personnelId === user.id) || this.isSuperUser();
  }

  // ==================== MÉTHODES PRIVÉES ====================

  private checkExistingAuth(): void {
    const token = localStorage.getItem(this.TOKEN_KEY);
    const userData = localStorage.getItem(this.USER_KEY);
    
    if (token && userData && this.isTokenValid(token)) {
      try {
        const user = JSON.parse(userData);
        const permissionsData = localStorage.getItem(this.PERMISSIONS_KEY);
        const permissions = permissionsData ? JSON.parse(permissionsData) : this.generatePermissionsFromUserType(user);
        this.setAuthData(token, user, permissions);
      } catch {
        this.clearAuthData();
      }
    } else {
      this.clearAuthData();
    }
    
    this.isLoading.set(false);
  }

  private setAuthData(token: string, user: AnyUtilisateur, permissions: string[]): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    localStorage.setItem(this.PERMISSIONS_KEY, JSON.stringify(permissions));
    
    this.currentUserSubject.next(user);
    this.isAuthenticated.set(true);
    this.userPermissions.set(permissions);
  }

  private clearAuthData(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.PERMISSIONS_KEY);
    
    this.currentUserSubject.next(null);
    this.isAuthenticated.set(false);
    this.userPermissions.set([]);
  }

  private isTokenValid(token: string): boolean {
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() < payload.exp * 1000;
    } catch {
      return false;
    }
  }

  private generatePermissionsFromUserType(user: AnyUtilisateur): string[] {
    const userType = getUserType(user);
    const permissionsMap: { [key: string]: string[] } = {
      'ADMIN': [
        'USER_MANAGEMENT', 'BLOOD_PRODUCT_CREATE', 'BLOOD_PRODUCT_VIEW', 
        'BLOOD_PRODUCT_UPDATE', 'BLOOD_PRODUCT_DELETE', 'PATIENT_MANAGEMENT', 
        'REPORT_VIEW', 'SYSTEM_CONFIG', 'DEMANDE_CREATE', 'DEMANDE_VIEW',
        'DEMANDE_UPDATE', 'DEMANDE_DELETE', 'DEMANDE_VALIDATE', 
        'TRANSFUSION_CREATE', 'TRANSFUSION_VIEW', 'TRANSFUSION_UPDATE', 
        'TRANSFUSION_DELETE', 'INCIDENT_CREATE', 'INCIDENT_VIEW', 
        'INCIDENT_UPDATE', 'INCIDENT_DELETE', 'TRACABILITY_VIEW',
        'TRACABILITY_CREATE', 'TRACABILITY_UPDATE', 'TRACABILITY_DELETE',
        'DELIVRANCE_CREATE', 'DELIVRANCE_VIEW', 'DELIVRANCE_UPDATE',
        'DELIVRANCE_DELETE', 'ALL_ACCESS'
      ],
      'CHEF_SERVICE': [
        'BLOOD_PRODUCT_CREATE', 'BLOOD_PRODUCT_VIEW', 'BLOOD_PRODUCT_UPDATE', 
        'BLOOD_PRODUCT_DELETE', 'PATIENT_MANAGEMENT', 'REPORT_VIEW', 
        'DEMANDE_CREATE', 'DEMANDE_VIEW', 'DEMANDE_UPDATE', 'DEMANDE_DELETE', 
        'DEMANDE_VALIDATE', 'TRANSFUSION_CREATE', 'TRANSFUSION_VIEW', 
        'TRANSFUSION_UPDATE', 'TRANSFUSION_DELETE', 'INCIDENT_CREATE', 
        'INCIDENT_VIEW', 'INCIDENT_UPDATE', 'INCIDENT_DELETE', 
        'TRACABILITY_VIEW', 'TRACABILITY_CREATE', 'TRACABILITY_UPDATE', 
        'TRACABILITY_DELETE', 'DELIVRANCE_CREATE', 'DELIVRANCE_VIEW', 
        'DELIVRANCE_UPDATE', 'DELIVRANCE_DELETE', 'TEAM_MANAGEMENT'
      ],
      'MEDECIN': [
        'BLOOD_PRODUCT_VIEW', 'PATIENT_MANAGEMENT', 'DEMANDE_CREATE', 
        'DEMANDE_VIEW', 'DEMANDE_UPDATE', 'TRANSFUSION_CREATE', 
        'TRANSFUSION_VIEW', 'TRANSFUSION_UPDATE', 'DELIVRANCE_VIEW', 
        'INCIDENT_CREATE', 'INCIDENT_VIEW', 'INCIDENT_UPDATE',
        'PATIENT_HISTORY_VIEW', 'TRACABILITY_VIEW'
      ],
      'PERSONNEL': [
        'BLOOD_PRODUCT_VIEW', 'BLOOD_PRODUCT_CREATE', 'BLOOD_PRODUCT_UPDATE',
        'PATIENT_MANAGEMENT', 'DEMANDE_VIEW', 'DEMANDE_VALIDATE', 
        'DELIVRANCE_CREATE', 'DELIVRANCE_VIEW', 'DELIVRANCE_UPDATE', 
        'TRANSFUSION_VIEW', 'INCIDENT_VIEW', 'TRACABILITY_VIEW',
        'TRACABILITY_CREATE', 'TRACABILITY_UPDATE', 'REPORT_VIEW', 
        'STOCK_MANAGEMENT'
      ]
    };

    return permissionsMap[userType] || ['BASIC_ACCESS'];
  }

  private handleAuthError(error: HttpErrorResponse): Observable<never> {
    let errorResponse: AuthResponse;
    
    if (error.error && typeof error.error === 'object') {
      errorResponse = {
        success: false,
        message: error.error.message || 'Erreur d\'authentification',
        errorType: error.error.errorType || 'OTHER'
      };
    } else {
      errorResponse = {
        success: false,
        message: 'Erreur de connexion au serveur',
        errorType: 'OTHER'
      };
    }
    
    return throwError(() => errorResponse);
  }

  private handleRefreshError(error: HttpErrorResponse): Observable<never> {
    this.clearAuthData();
    return throwError(() => ({ 
      success: false, 
      message: 'Session expirée, veuillez vous reconnecter' 
    }));
  }

  /**
   * Vérifier si l'utilisateur peut modifier une demande spécifique
   */
  canModifierDemande(demande: any): boolean {
    return this.isSuperUser(),this.isMedecin();
  }

  /**
   * Vérifier si l'utilisateur peut supprimer une demande
   */
  canDeleteDemande(): boolean {
    // Seuls les super users peuvent supprimer des demandes
    return this.isSuperUser(),this.isMedecin();
  }

  /**
   * Méthodes utilitaires pour l'affichage
   */
  getRoleSpecificActions(): { [key: string]: boolean } {
    return {
      // PERSONNEL
      canValidate: this.isPersonnel() || this.isSuperUser(),
      canViewOnly: this.isMedecin() && !this.isSuperUser(),
      
      // MÉDECIN
      canCreate: this.isMedecin() || this.isSuperUser(),
      
      // SUPER USERS
      canDelete: this.isSuperUser()
    };
  }

  canCreateDelivrance(): boolean {
  // PERSONNEL et Super Users peuvent créer des délivrances
  return this.isPersonnel() || this.isSuperUser();
}

canViewDelivrances(): boolean {
  // Tous les utilisateurs authentifiés peuvent voir les délivrances
  return this.isLoggedIn();
}

canUpdateDelivrance(delivrance: any): boolean {
  return this.isPersonnel() || this.isSuperUser();
}

canDeleteDelivrance(): boolean {
  // Seuls les super users peuvent supprimer des délivrances
  return this.isPersonnel() || this.isSuperUser();
}

fada(): number {
  // Seuls les super users peuvent supprimer des délivrances
  return this.getCurrentUser()?.id || 0;
}


filterDemandesByPermission(demandes: Demande[]): Demande[] {
  const user = this.getCurrentUser();
  if (!user || !user.id) {
    console.log('❌ Utilisateur non connecté');
    return [];
  }
  
  const userType = getUserType(user);
  const userId = Number(user.id);
  
  console.log('🔍 Filtrage demandes:', {
    userType,
    userId,
    totalDemandes: demandes.length
  });
  
  let result: Demande[] = [];
  
  switch (userType) {
    case 'ADMIN':
    case 'CHEF_SERVICE':
      // Super users voient tout
      result = demandes;
      console.log('👑 Super user - toutes les demandes:', result.length);
      break;
      
    case 'MEDECIN':
      // Médecin ne voit que ses propres demandes
      result = demandes.filter(d => {
        const demandeMedecinId = Number(d.medecin?.id);
        const isMine = userId === demandeMedecinId;
        
        // Log pour déboguer
        if (isMine) {
          console.log('✅ Demande du médecin:', {
            id: d.id,
            patient: `${d.patientPrenom} ${d.patientNom}`,
            medecinId: d.medecin?.id,
            statut: d.statut
          });
        }
        
        return isMine;
      });
      console.log('👨‍⚕️ Médecin - demandes filtrées:', result.length);
      break;
      
    case 'PERSONNEL':
      // Personnel voit toutes les demandes (pour validation)
      result = demandes;
      console.log('👥 Personnel - toutes les demandes:', result.length);
      break;
      
    default:
      console.log('❓ Rôle inconnu:', userType);
      result = [];
  }
  
  return result;
}

/**
 * Filtre les délivrances selon les permissions
 */
filterDelivrancesByPermission(delivrances: Delivrance[]): Delivrance[] {
  const user = this.getCurrentUser();
  if (!user) return [];
  
  const userType = getUserType(user);
  
  switch (userType) {
    case 'ADMIN':
    case 'CHEF_SERVICE':
      return delivrances;
      
    case 'MEDECIN':
      // Médecin voit les délivrances de ses propres patients
      return delivrances.filter(d => 
        d.demande?.medecin?.id === user.id
      );
      
    case 'PERSONNEL':
      // Personnel voit ses propres délivrances et celles de son service
      return delivrances.filter(d => 
        d.personnel.id === user.id || '')
      ;
      
    default:
      return [];
  }
}

/**
 * Filtre les transfusions selon les permissions
 */
filterTransfusionsByPermission(transfusions: Transfusion[]): Transfusion[] {
  const user = this.getCurrentUser();
  if (!user) return [];
  
  const userType = getUserType(user);
  
  switch (userType) {
    case 'ADMIN':
    case 'CHEF_SERVICE':
      return transfusions;
      
    case 'MEDECIN':
      // Médecin voit ses propres transfusions
      return transfusions.filter(t => t.medecin?.id === user.id);
      
    case 'PERSONNEL':
      // Personnel voit les transfusions de son service
      return transfusions;
      
    default:
      return [];
  }
}

/**
 * Filtre les incidents selon les permissions
 */
filterIncidentsByPermission(incidents: IncidentTransfusionnel[]): IncidentTransfusionnel[] {
  const user = this.getCurrentUser();
  if (!user) {
    console.log('🔍 Filtrage incidents: utilisateur non connecté');
    return [];
  }
  
  const userType = getUserType(user);
  const userId = Number(user.id);
  
  console.log('🔍 Filtrage incidents - DÉBUT:', {
    userType,
    userId,
    userName: `${user.prenom} ${user.nom}`,
    totalIncidents: incidents.length
  });
  
  let result: IncidentTransfusionnel[] = [];
  
  switch (userType) {
    case 'ADMIN':
    case 'CHEF_SERVICE':
      // Super users voient tout
      result = incidents;
      console.log('👑 Super user - tous les incidents:', result.length);
      break;
      
    case 'MEDECIN':
      // Médecin voit les incidents de ses propres patients
      result = incidents.filter(i => i.transfusion?.medecin?.id === user.id);
      console.log('👨‍⚕️ Médecin - incidents filtrés:', result.length);
      break;
      
    case 'PERSONNEL':
      // Personnel qualité voit tous les incidents
      result = incidents;
      break;
    default:
      console.log('❓ Rôle inconnu:', userType);
      result = [];
  }
  
  console.log('🔍 Filtrage incidents - FIN:', {
    avant: incidents.length,
    apres: result.length,
    ids: result.map(i => i.id)
  });
  
  return result;
}
}

export { getUserType };
