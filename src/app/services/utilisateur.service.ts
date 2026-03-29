// services/utilisateur.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, catchError, tap } from 'rxjs';
import { AnyUtilisateur, getUserType } from '../interfaces/any-utilisateur.interface';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class UtilisateurService {
  private http = inject(HttpClient);
  private readonly baseUrl = '${environment.apiUrl}';


  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    })
  };

  /**
   * Récupère tous les utilisateurs
   */
  getAllUtilisateurs(): Observable<AnyUtilisateur[]> {
    console.log('🔄 Chargement de tous les utilisateurs...');
    
    return this.http.get<AnyUtilisateur[]>(`${this.baseUrl}/utilisateurs`, this.httpOptions)
      .pipe(
        tap(users => console.log(`✅ ${users.length} utilisateur(s) chargé(s)`, users)),
        catchError(error => this.handleError(error))
      );
  }

  /**
   * Créer un utilisateur selon son type - AMÉLIORÉ avec meilleure gestion d'erreurs
   */
  createUtilisateur(utilisateur: AnyUtilisateur): Observable<AnyUtilisateur> {
    const type = getUserType(utilisateur);
    const url = this.getCreateUrlByType(type);
    
    // Nettoyage des données pour la création
    const sanitizedData = this.sanitizeUserDataForCreation(utilisateur);

    console.log('🟢 Création utilisateur:', { 
      type, 
      url, 
      donnéesNettoyées: sanitizedData
    });

    // Validation finale avant envoi
    const validation = this.validateUserData(sanitizedData, 'CREATE');
    if (!validation.isValid) {
      return throwError(() => new Error(validation.errors.join(', ')));
    }

    return this.http.post<AnyUtilisateur>(url, sanitizedData, this.httpOptions)
      .pipe(
        tap(response => console.log('✅ Utilisateur créé avec succès:', response)),
        catchError(error => this.handleCreateError(error)) // ✅ CHANGEMENT ICI : Méthode spécifique pour création
      );
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Gestion spécifique des erreurs de création
   */
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
      // Extraire le message d'erreur du backend
      userMessage = this.extractBackendErrorMessage(error);
    } else if (error.status === 409) {
      userMessage = 'Conflit : Données déjà existantes.';
    } else if (error.status === 0) {
      userMessage = 'Erreur de connexion au serveur. Vérifiez votre connexion.';
    } else if (error.status >= 500) {
      userMessage = 'Erreur serveur. Veuillez réessayer plus tard.';
    }

    return throwError(() => new Error(userMessage));
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Extraction du message d'erreur backend
   */
  private extractBackendErrorMessage(error: HttpErrorResponse): string {
    if (!error.error) {
      return 'Données invalides envoyées au serveur.';
    }

    // Si le backend retourne un objet avec un message
    if (typeof error.error === 'object') {
      const serverError = error.error;
      
      // Format Spring Boot standard avec message
      if (serverError.message) {
        return serverError.message; // "Le matricule existe déjà", "L'email existe déjà", etc.
      }
      
      // Format avec champ "error"
      if (serverError.error) {
        return serverError.error;
      }
      
      // Validation errors (Spring Boot)
      if (serverError.errors) {
        const validationErrors = Object.values(serverError.errors).flat();
        return `Erreurs de validation: ${validationErrors.join(', ')}`;
      }
      
      // Essayer de stringifier l'objet
      try {
        const errorStr = JSON.stringify(serverError);
        if (errorStr !== '{}') {
          return `Erreur serveur: ${errorStr}`;
        }
      } catch (e) {
        console.warn('Impossible de parser l\'erreur:', e);
      }
    }
    
    // Si c'est une string directement
    if (typeof error.error === 'string' && error.error.length > 0) {
      return error.error;
    }

    // Message par défaut avec les erreurs courantes
    return 'Erreur de validation. Vérifiez que le matricule et l\'email ne sont pas déjà utilisés.';
  }

  /**
   * Mettre à jour un utilisateur existant
   */
  updateUtilisateur(id: number, utilisateur: AnyUtilisateur): Observable<AnyUtilisateur> {
    const type = getUserType(utilisateur);
    const url = this.getUpdateUrlByType(type, id);
    
    // Nettoyage des données pour la mise à jour
    const sanitizedData = this.sanitizeUserDataForUpdate(utilisateur, id);

    console.log('🟡 Mise à jour utilisateur:', { 
      type, 
      url, 
      id,
      donnéesNettoyées: sanitizedData 
    });

    // Validation finale avant envoi
    const validation = this.validateUserData(sanitizedData, 'UPDATE');
    if (!validation.isValid) {
      return throwError(() => new Error(validation.errors.join(', ')));
    }

    return this.http.put<AnyUtilisateur>(url, sanitizedData, this.httpOptions)
      .pipe(
        tap(response => console.log('✅ Utilisateur mis à jour avec succès:', response)),
        catchError(error => this.handleUpdateError(error)) // ✅ CHANGEMENT ICI : Méthode spécifique pour mise à jour
      );
  }

  /**
   * ✅ NOUVELLE MÉTHODE : Gestion spécifique des erreurs de mise à jour
   */
  private handleUpdateError(error: HttpErrorResponse): Observable<never> {
    console.error('🔍 ERREUR MISE À JOUR DÉTAILLÉE:', error);

    let userMessage = 'Erreur lors de la mise à jour.';

    if (error.status === 400) {
      userMessage = this.extractBackendErrorMessage(error);
    } else if (error.status === 404) {
      userMessage = 'Utilisateur non trouvé.';
    } else if (error.status === 409) {
      userMessage = 'Conflit : Les nouvelles données entrent en conflit avec des données existantes.';
    }

    return throwError(() => new Error(userMessage));
  }

  /**
   * Supprimer un utilisateur
   */
  deleteUtilisateur(id: number): Observable<void> {
    const url = `${this.baseUrl}/utilisateurs/${id}`;
    
    console.log('🔴 Suppression utilisateur:', { id, url });

    return this.http.delete<void>(url, this.httpOptions)
      .pipe(
        tap(() => console.log(`✅ Utilisateur ${id} supprimé avec succès`)),
        catchError(error => this.handleError(error))
      );
  }

  /**
   * Récupérer un utilisateur par son ID
   */
  getUtilisateurById(id: number): Observable<AnyUtilisateur> {
    const url = `${this.baseUrl}/utilisateurs/${id}`;
    
    console.log('🔍 Récupération utilisateur par ID:', { id, url });

    return this.http.get<AnyUtilisateur>(url, this.httpOptions)
      .pipe(
        tap(user => console.log('✅ Utilisateur récupéré:', user)),
        catchError(error => this.handleError(error))
      );
  }

  /**
   * Rechercher des utilisateurs
   */
  searchUtilisateurs(term: string): Observable<AnyUtilisateur[]> {
    const params = new HttpParams().set('search', term);
    
    console.log('🔍 Recherche utilisateurs:', term);

    return this.http.get<AnyUtilisateur[]>(`${this.baseUrl}/utilisateurs/search`, { 
      ...this.httpOptions, 
      params 
    }).pipe(
      tap(users => console.log(`✅ ${users.length} résultat(s) trouvé(s)`, users)),
      catchError(error => this.handleError(error))
    );
  }

  /**
   * Nettoyage des données pour la création
   */
  private sanitizeUserDataForCreation(utilisateur: AnyUtilisateur): any {
    // Faire une copie profonde
    const sanitized = JSON.parse(JSON.stringify(utilisateur));
    
    console.log('🧹 Nettoyage données création - Avant:', sanitized);

    // SUPPRIMER l'ID pour la création
    delete sanitized.id;

    // Nettoyer le mot de passe
    sanitized.motDePasse = this.cleanPasswordField(sanitized.motDePasse);

    // Supprimer les relations et champs problématiques
    this.removeProblematicFields(sanitized);

    // Nettoyer les champs vides/undefined
    this.cleanEmptyFields(sanitized);

    // Formater les dates
    this.formatDates(sanitized);

    console.log('🧹 Nettoyage données création - Après:', sanitized);
    return sanitized;
  }

  /**
   * Nettoyage des données pour la mise à jour
   */
  private sanitizeUserDataForUpdate(utilisateur: AnyUtilisateur, id: number): any {
    // Faire une copie profonde
    const sanitized = JSON.parse(JSON.stringify(utilisateur));
    
    console.log('🧹 Nettoyage données mise à jour - Avant:', sanitized);

    // S'assurer que l'ID est présent
    sanitized.id = id;

    // Nettoyer le mot de passe
    sanitized.motDePasse = this.cleanPasswordField(sanitized.motDePasse);
    
    // Si le mot de passe est vide, le supprimer (ne pas mettre à jour)
    if (!sanitized.motDePasse || sanitized.motDePasse.toString().trim() === '') {
      delete sanitized.motDePasse;
      console.log('🔐 Mot de passe vide - suppression du champ');
    }

    // Supprimer les relations et champs problématiques
    this.removeProblematicFields(sanitized);

    // Nettoyer les champs vides/undefined
    this.cleanEmptyFields(sanitized, true); // Garder les strings vides pour mise à jour

    // Formater les dates
    this.formatDates(sanitized);

    console.log('🧹 Nettoyage données mise à jour - Après:', sanitized);
    return sanitized;
  }

  /**
   * Nettoie le champ mot de passe
   */
  private cleanPasswordField(password: any): string {
    if (!password) return '';

    let cleanedPassword = password;

    // Gérer les tableaux Angular
    if (Array.isArray(cleanedPassword)) {
      cleanedPassword = cleanedPassword[0] || '';
      console.log('🔄 Mot de passe converti depuis tableau:', cleanedPassword);
    }

    // Gérer les objets Angular
    if (typeof cleanedPassword === 'object' && cleanedPassword !== null) {
      if ('value' in cleanedPassword) {
        cleanedPassword = cleanedPassword.value || '';
        console.log('🔄 Mot de passe extrait depuis objet:', cleanedPassword);
      } else {
        cleanedPassword = '';
        console.log('⚠️ Mot de passe objet non reconnu, valeur mise à vide');
      }
    }

    // Convertir en string et trimmer
    return cleanedPassword.toString().trim();
  }

  /**
   * Supprime les champs problématiques
   */
  private removeProblematicFields(data: any): void {
    const fieldsToRemove = [
      'demandes',
      'transfusions',
      'photoProfil', // Si non utilisé
      'createdAt',
      'updatedAt',
      'version'
    ];

    fieldsToRemove.forEach(field => {
      if (field in data) {
        delete data[field];
        console.log(`🗑️ Champ supprimé: ${field}`);
      }
    });
  }

  /**
   * Nettoie les champs vides
   */
  private cleanEmptyFields(data: any, keepEmptyStrings: boolean = false): void {
    Object.keys(data).forEach(key => {
      const value = data[key];
      
      if (value === undefined || value === null) {
        delete data[key];
        console.log(`🗑️ Champ ${key} supprimé (undefined/null)`);
      } else if (!keepEmptyStrings && typeof value === 'string' && value.trim() === '') {
        delete data[key];
        console.log(`🗑️ Champ ${key} supprimé (string vide)`);
      } else if (Array.isArray(value) && value.length === 0) {
        delete data[key];
        console.log(`🗑️ Champ ${key} supprimé (tableau vide)`);
      }
    });
  }

  /**
   * Formate les dates
   */
  private formatDates(data: any): void {
    const dateFields = ['dateNaissance', 'dateEmbauche'];
    
    dateFields.forEach(field => {
      if (data[field]) {
        try {
          const date = new Date(data[field]);
          if (!isNaN(date.getTime())) {
            data[field] = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
            console.log(`📅 Champ ${field} formaté: ${data[field]}`);
          } else {
            console.warn(`❌ Date invalide pour ${field}:`, data[field]);
            delete data[field];
          }
        } catch (error) {
          console.warn(`❌ Erreur format date ${field}:`, error);
          delete data[field];
        }
      }
    });
  }

  /**
   * Validation des données utilisateur
   */
  private validateUserData(data: any, operation: 'CREATE' | 'UPDATE'): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Champs obligatoires pour création
    const requiredFields = [
      'matricule', 'nom', 'prenom', 'email', 'sexe', 
      'dateNaissance', 'statut'
    ];

    if (operation === 'CREATE') {
      requiredFields.forEach(field => {
        if (!data[field] || data[field].toString().trim() === '') {
          errors.push(`Le champ ${field} est requis`);
        }
      });

      // Mot de passe requis en création
      if (!data.motDePasse || data.motDePasse.toString().trim() === '') {
        errors.push('Le mot de passe est requis pour la création');
      }
    }

    // Validation email
    if (data.email && !this.isValidEmail(data.email)) {
      errors.push('Format d\'email invalide');
    }

    // Validation dates
    if (data.dateNaissance && !this.isValidDate(data.dateNaissance)) {
      errors.push('Date de naissance invalide');
    }

    if (data.dateEmbauche && !this.isValidDate(data.dateEmbauche)) {
      errors.push('Date d\'embauche invalide');
    }

    // Validation champs spécifiques par type
    const type = getUserType(data);
    if (type === 'MEDECIN' && (!data.specialite || data.specialite.trim() === '')) {
      errors.push('La spécialité est requise pour un médecin');
    }

    if (errors.length > 0) {
      console.error('❌ Erreurs validation:', errors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validation email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validation date
   */
  private isValidDate(dateString: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Récupère le bon endpoint selon le type
   */
  private getCreateUrlByType(type: string): string {
    const endpoints: Record<string, string> = {
      'MEDECIN': `${this.baseUrl}/medecins`,
      'PERSONNEL': `${this.baseUrl}/personnel`,
      'CHEF_SERVICE': `${this.baseUrl}/chefs-service`,
      'ADMIN': `${this.baseUrl}/admins`
    };
    
    const url = endpoints[type] || `${this.baseUrl}/utilisateurs`;
    console.log(`🌐 Endpoint création ${type}: ${url}`);
    return url;
  }

  /**
   * Récupère le bon endpoint pour la mise à jour
   */
  private getUpdateUrlByType(type: string, id: number): string {
    const endpoints: Record<string, string> = {
      'MEDECIN': `${this.baseUrl}/medecins/${id}`,
      'PERSONNEL': `${this.baseUrl}/personnel/${id}`,
      'CHEF_SERVICE': `${this.baseUrl}/chefs-service/${id}`,
      'ADMIN': `${this.baseUrl}/admins/${id}`
    };
    
    const url = endpoints[type] || `${this.baseUrl}/utilisateurs/${id}`;
    console.log(`🌐 Endpoint mise à jour ${type}: ${url}`);
    return url;
  }

  /**
   * Gestion des erreurs HTTP génériques
   */
  private handleError = (error: HttpErrorResponse) => {
    console.error('🔍 ANALYSE ERREUR DÉTAILLÉE:', {
      status: error.status,
      statusText: error.statusText,
      url: error.url,
      error: error.error,
      errorString: String(error.error),
      headers: error.headers,
      message: error.message
    });

    let userMessage = 'Une erreur est survenue.';

    if (error.error instanceof ErrorEvent) {
      userMessage = `Erreur réseau: ${error.error.message}`;
    } else {
      switch (error.status) {
        case 400:
          userMessage = this.analyzeBadRequest(error);
          break;
        case 404:
          userMessage = 'Ressource non trouvée.';
          break;
        case 500:
          userMessage = 'Erreur interne du serveur.';
          break;
        default:
          userMessage = `Erreur ${error.status}: ${error.statusText}`;
      }
    }

    return throwError(() => new Error(userMessage));
  }

  /**
   * Analyse approfondie des erreurs 400
   */
  private analyzeBadRequest(error: HttpErrorResponse): string {
    console.log('🔍 Analyse détaillée erreur 400:');
    
    if (error.error) {
      console.log('📦 Body error existe:', error.error);
      
      if (typeof error.error === 'string' && error.error.length > 0) {
        return `Erreur serveur: ${error.error}`;
      }
      
      if (typeof error.error === 'object') {
        if (error.error.message) {
          return error.error.message;
        }
        if (error.error.error) {
          return error.error.error;
        }
      }
    }
    
    return 'Erreur de validation. Vérifiez les données envoyées.';
  }

  /**
   * Vérifie la santé de l'API
   */
  checkHealth(): Observable<{ status: string; timestamp: string }> {
    return this.http.get<{ status: string; timestamp: string }>(
      `${this.baseUrl}/health`, 
      this.httpOptions
    ).pipe(
      catchError(error => this.handleError(error))
    );
  }
}