import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  private authService = inject(AuthService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): boolean {
    // 1. Vérifier la connexion
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    // 2. COURT-CIRCUIT : ADMIN et CHEF_SERVICE ont accès total
    if (this.authService.isSuperUser()) {
      return true;
    }

    // 3. Vérifications pour les autres rôles
    const requiredPermissions = route.data['permissions'] as string[];
    const requiredRoles = route.data['roles'] as string[];

    // Vérifier les permissions si spécifiées
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasPermission = requiredPermissions.some(permission => 
        this.authService.hasPermission(permission)
      );
      
      if (!hasPermission) {
        this.router.navigate(['/unauthorized']);
        return false;
      }
    }

    // Vérifier les rôles si spécifiés
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some(role => 
        this.authService.hasRole(role)
      );
      
      if (!hasRole) {
        this.router.navigate(['/unauthorized']);
        return false;
      }
    }

    return true;
  }
}