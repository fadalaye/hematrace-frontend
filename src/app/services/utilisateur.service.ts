// services/utilisateur.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AnyUtilisateur, getUserType } from '../interfaces/any-utilisateur.interface';
import { environment } from '../../environments/environment';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: string;
}

export interface CreateUtilisateurAdminRequest {
  matricule: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  sexe?: string;
  dateNaissance?: string;
  adresse?: string;
  dateEmbauche?: string;
  statut?: string;

  typeUtilisateur: 'ADMIN' | 'MEDECIN' | 'PERSONNEL' | 'CHEF_SERVICE';

  specialite?: string;
  fonction?: string;
  serviceDirige?: string;
  departement?: string;
  role?: string;
  droitsAccess?: string;
}

export interface CreateUtilisateurAdminResponse {
  success: boolean;
  message: string;
  email: string;
  statut: string;
}

@Injectable({
  providedIn: 'root'
})
export class UtilisateurService {
  private http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}`;

  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    })
  };

  getAllUtilisateurs(): Observable<AnyUtilisateur[]> {
    console.log('🔄 Chargement de tous les utilisateurs...');

    return this.http.get<AnyUtilisateur[]>(`${this.baseUrl}/utilisateurs`, this.httpOptions).pipe(
      tap(users => console.log(`✅ ${users.length} utilisateur(s) chargé(s)`, users)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Création via l'endpoint admin :
   * POST /api/admin/utilisateurs
   */
  createUtilisateur(utilisateur: AnyUtilisateur): Observable<CreateUtilisateurAdminResponse> {
    const payload = this.buildAdminCreatePayload(utilisateur);

    console.log('🟢 Création utilisateur via admin:', {
      endpoint: `${this.baseUrl}/admin/utilisateurs`,
      payload
    });

    const validation = this.validateAdminCreatePayload(payload);
    if (!validation.isValid) {
      return throwError(() => new Error(validation.errors.join(', ')));
    }

    return this.http.post<CreateUtilisateurAdminResponse>(
      `${this.baseUrl}/admin/utilisateurs`,
      payload,
      this.httpOptions
    ).pipe(
      tap(response => console.log('✅ Utilisateur créé avec succès via admin:', response)),
      catchError(error => this.handleCreateError(error))
    );
  }

  updateUtilisateur(id: number, utilisateur: AnyUtilisateur): Observable<AnyUtilisateur> {
    const type = getUserType(utilisateur);
    const url = this.getUpdateUrlByType(type, id);
    const sanitizedData = this.sanitizeUserDataForUpdate(utilisateur, id);

    console.log('🟡 Mise à jour utilisateur:', {
      type,
      url,
      id,
      donnéesNettoyées: sanitizedData
    });

    const validation = this.validateUserDataForUpdate(sanitizedData);
    if (!validation.isValid) {
      return throwError(() => new Error(validation.errors.join(', ')));
    }

    return this.http.put<AnyUtilisateur>(url, sanitizedData, this.httpOptions).pipe(
      tap(response => console.log('✅ Utilisateur mis à jour avec succès:', response)),
      catchError(error => this.handleUpdateError(error))
    );
  }

  deleteUtilisateur(id: number): Observable<void> {
    const url = `${this.baseUrl}/utilisateurs/${id}`;

    console.log('🔴 Suppression utilisateur:', { id, url });

    return this.http.delete<void>(url, this.httpOptions).pipe(
      tap(() => console.log(`✅ Utilisateur ${id} supprimé avec succès`)),
      catchError(error => this.handleError(error))
    );
  }

  getUtilisateurById(id: number): Observable<AnyUtilisateur> {
    const url = `${this.baseUrl}/utilisateurs/${id}`;

    console.log('🔍 Récupération utilisateur par ID:', { id, url });

    return this.http.get<AnyUtilisateur>(url, this.httpOptions).pipe(
      tap(user => console.log('✅ Utilisateur récupéré:', user)),
      catchError(error => this.handleError(error))
    );
  }

  searchUtilisateurs(term: string): Observable<AnyUtilisateur[]> {
    const params = new HttpParams().set('search', term);

    console.log('🔍 Recherche utilisateurs:', term);

    return this.http.get<AnyUtilisateur[]>(
      `${this.baseUrl}/utilisateurs/search`,
      { ...this.httpOptions, params }
    ).pipe(
      tap(users => console.log(`✅ ${users.length} résultat(s) trouvé(s)`, users)),
      catchError(error => this.handleError(error))
    );
  }

  private buildAdminCreatePayload(utilisateur: AnyUtilisateur): CreateUtilisateurAdminRequest {
    const raw = JSON.parse(JSON.stringify(utilisateur));
    const typeUtilisateur = getUserType(raw) as CreateUtilisateurAdminRequest['typeUtilisateur'];

    const payload: CreateUtilisateurAdminRequest = {
      matricule: (raw.matricule || '').trim(),
      nom: (raw.nom || '').trim(),
      prenom: (raw.prenom || '').trim(),
      email: (raw.email || '').trim().toLowerCase(),
      telephone: raw.telephone?.trim() || undefined,
      sexe: raw.sexe || undefined,
      dateNaissance: this.formatDate(raw.dateNaissance),
      adresse: raw.adresse?.trim() || undefined,
      dateEmbauche: this.formatDate(raw.dateEmbauche),
      statut: 'EN_ATTENTE_ACTIVATION',
      typeUtilisateur
    };

    switch (typeUtilisateur) {
      case 'MEDECIN':
        payload.specialite = raw.specialite?.trim() || '';
        break;
      case 'PERSONNEL':
        payload.fonction = raw.fonction?.trim() || '';
        break;
      case 'CHEF_SERVICE':
        payload.serviceDirige = raw.serviceDirige?.trim() || '';
        payload.departement = raw.departement?.trim() || '';
        break;
      case 'ADMIN':
        payload.role = raw.role?.trim() || '';
        payload.droitsAccess = raw.droitsAccess?.trim() || '';
        break;
    }

    return payload;
  }

  private validateAdminCreatePayload(
    data: CreateUtilisateurAdminRequest
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    const requiredFields: (keyof CreateUtilisateurAdminRequest)[] = [
      'matricule',
      'nom',
      'prenom',
      'email',
      'typeUtilisateur'
    ];

    requiredFields.forEach(field => {
      const value = data[field];
      if (!value || value.toString().trim() === '') {
        errors.push(`Le champ ${field} est requis`);
      }
    });

    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Format d\'email invalide');
    }

    if (data.dateNaissance && !this.isValidDate(data.dateNaissance)) {
      errors.push('Date de naissance invalide');
    }

    if (data.dateEmbauche && !this.isValidDate(data.dateEmbauche)) {
      errors.push('Date d\'embauche invalide');
    }

    if (data.typeUtilisateur === 'MEDECIN' && !data.specialite?.trim()) {
      errors.push('La spécialité est requise pour un médecin');
    }

    if (data.typeUtilisateur === 'PERSONNEL' && !data.fonction?.trim()) {
      errors.push('La fonction est requise pour le personnel');
    }

    if (data.typeUtilisateur === 'CHEF_SERVICE' && !data.serviceDirige?.trim()) {
      errors.push('Le service dirigé est requis pour un chef de service');
    }

    if (data.typeUtilisateur === 'ADMIN' && !data.role?.trim()) {
      errors.push('Le rôle est requis pour un administrateur');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private sanitizeUserDataForUpdate(utilisateur: AnyUtilisateur, id: number): any {
    const sanitized = JSON.parse(JSON.stringify(utilisateur));

    console.log('🧹 Nettoyage données mise à jour - Avant:', sanitized);

    sanitized.id = id;

    sanitized.motDePasse = this.cleanPasswordField(sanitized.motDePasse);

    if (!sanitized.motDePasse || sanitized.motDePasse.toString().trim() === '') {
      delete sanitized.motDePasse;
      console.log('🔐 Mot de passe vide - suppression du champ');
    }

    this.removeProblematicFields(sanitized);
    this.cleanEmptyFields(sanitized, true);
    this.formatDatesInObject(sanitized);

    console.log('🧹 Nettoyage données mise à jour - Après:', sanitized);
    return sanitized;
  }

  private validateUserDataForUpdate(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Format d\'email invalide');
    }

    if (data.dateNaissance && !this.isValidDate(data.dateNaissance)) {
      errors.push('Date de naissance invalide');
    }

    if (data.dateEmbauche && !this.isValidDate(data.dateEmbauche)) {
      errors.push('Date d\'embauche invalide');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private cleanPasswordField(password: any): string {
    if (!password) return '';

    let cleanedPassword = password;

    if (Array.isArray(cleanedPassword)) {
      cleanedPassword = cleanedPassword[0] || '';
    }

    if (typeof cleanedPassword === 'object' && cleanedPassword !== null) {
      if ('value' in cleanedPassword) {
        cleanedPassword = cleanedPassword.value || '';
      } else {
        cleanedPassword = '';
      }
    }

    return cleanedPassword.toString().trim();
  }

  private removeProblematicFields(data: any): void {
    const fieldsToRemove = [
      'demandes',
      'transfusions',
      'createdAt',
      'updatedAt',
      'version'
    ];

    fieldsToRemove.forEach(field => {
      if (field in data) {
        delete data[field];
      }
    });
  }

  private cleanEmptyFields(data: any, keepEmptyStrings: boolean = false): void {
    Object.keys(data).forEach(key => {
      const value = data[key];

      if (value === undefined || value === null) {
        delete data[key];
      } else if (!keepEmptyStrings && typeof value === 'string' && value.trim() === '') {
        delete data[key];
      } else if (Array.isArray(value) && value.length === 0) {
        delete data[key];
      }
    });
  }

  private formatDatesInObject(data: any): void {
    const dateFields = ['dateNaissance', 'dateEmbauche'];

    dateFields.forEach(field => {
      if (data[field]) {
        const formatted = this.formatDate(data[field]);
        if (formatted) {
          data[field] = formatted;
        } else {
          delete data[field];
        }
      }
    });
  }

  private formatDate(value: any): string | undefined {
    if (!value) return undefined;

    try {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return undefined;
      }
      return date.toISOString().split('T')[0];
    } catch {
      return undefined;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidDate(dateString: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  private getUpdateUrlByType(type: string, id: number): string {
    const endpoints: Record<string, string> = {
      'MEDECIN': `${this.baseUrl}/medecins/${id}`,
      'PERSONNEL': `${this.baseUrl}/personnel/${id}`,
      'CHEF_SERVICE': `${this.baseUrl}/chefs-service/${id}`,
      'ADMIN': `${this.baseUrl}/admins/${id}`
    };

    return endpoints[type] || `${this.baseUrl}/utilisateurs/${id}`;
  }

  private handleCreateError(error: HttpErrorResponse): Observable<never> {
    console.error('🔍 ERREUR CRÉATION DÉTAILLÉE:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      error: error.error,
      headers: error.headers
    });

    let userMessage = 'Erreur lors de la création.';

    if (error.status === 400) {
      userMessage = this.extractBackendErrorMessage(error);
    } else if (error.status === 409) {
      userMessage = 'Conflit : données déjà existantes.';
    } else if (error.status === 0) {
      userMessage = 'Erreur de connexion au serveur. Vérifiez votre connexion.';
    } else if (error.status >= 500) {
      userMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
    }

    return throwError(() => new Error(userMessage));
  }

  private handleUpdateError(error: HttpErrorResponse): Observable<never> {
    console.error('🔍 ERREUR MISE À JOUR DÉTAILLÉE:', error);

    let userMessage = 'Erreur lors de la mise à jour.';

    if (error.status === 400) {
      userMessage = this.extractBackendErrorMessage(error);
    } else if (error.status === 404) {
      userMessage = 'Utilisateur non trouvé.';
    } else if (error.status === 409) {
      userMessage = 'Conflit : les nouvelles données entrent en conflit avec des données existantes.';
    }

    return throwError(() => new Error(userMessage));
  }

  private extractBackendErrorMessage(error: HttpErrorResponse): string {
    if (!error.error) {
      return 'Données invalides envoyées au serveur.';
    }

    if (typeof error.error === 'object') {
      const serverError = error.error;

      if (serverError.message) {
        return serverError.message;
      }

      if (serverError.error) {
        return serverError.error;
      }

      if (serverError.errors) {
        const validationErrors = Object.values(serverError.errors).flat();
        return `Erreurs de validation: ${validationErrors.join(', ')}`;
      }

      try {
        const errorStr = JSON.stringify(serverError);
        if (errorStr !== '{}') {
          return `Erreur serveur: ${errorStr}`;
        }
      } catch {
        // rien
      }
    }

    if (typeof error.error === 'string' && error.error.length > 0) {
      return error.error;
    }

    return 'Erreur de validation. Vérifiez que le matricule et l’email ne sont pas déjà utilisés.';
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('❌ Erreur HTTP:', error);

    let message = 'Une erreur inattendue est survenue.';

    if (error.status === 0) {
      message = 'Impossible de joindre le serveur.';
    } else if (error.status === 404) {
      message = 'Ressource introuvable.';
    } else if (error.status === 500) {
      message = 'Erreur interne du serveur.';
    } else if (error.error?.message) {
      message = error.error.message;
    }

    return throwError(() => new Error(message));
  }
}