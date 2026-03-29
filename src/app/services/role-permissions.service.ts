import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class RolePermissionsService {
  
  private rolePermissions = {
    PERSONNEL: [
      // Produits sanguins
      'BLOOD_PRODUCT_VIEW',
      'BLOOD_PRODUCT_CREATE',
      'BLOOD_PRODUCT_UPDATE',
      
      // Demandes
      'DEMANDE_VIEW',
      'DEMANDE_VALIDATE',
      
      // Délivrances
      'DELIVRANCE_VIEW',
      'DELIVRANCE_CREATE',
      'DELIVRANCE_UPDATE',
      
      // Transfusions
      'TRANSFUSION_VIEW',
      
      // Traçabilité
      'TRACABILITY_VIEW',
      'TRACABILITY_CREATE',
      'TRACABILITY_UPDATE',
      
      // Incidents
      'INCIDENT_VIEW',
      
      // Autres
      'PATIENT_MANAGEMENT',
      'REPORT_VIEW',
      'STOCK_MANAGEMENT'
    ],
    
    MEDECIN: [
      // Produits sanguins
      'BLOOD_PRODUCT_VIEW',
      
      // Demandes
      'DEMANDE_VIEW',
      'DEMANDE_CREATE',
      'DEMANDE_UPDATE',
      
      // Délivrances
      'DELIVRANCE_VIEW',
      
      // Transfusions
      'TRANSFUSION_VIEW',
      'TRANSFUSION_CREATE',
      'TRANSFUSION_UPDATE',
      
      // Traçabilité
      'TRACABILITY_VIEW',
      
      // Incidents
      'INCIDENT_VIEW',
      'INCIDENT_CREATE',
      'INCIDENT_UPDATE',
      
      // Autres
      'PATIENT_MANAGEMENT',
      'PATIENT_HISTORY_VIEW'
    ],
    
    CHEF_SERVICE: [
      // Toutes les permissions CRUD
      'BLOOD_PRODUCT_VIEW',
      'BLOOD_PRODUCT_CREATE',
      'BLOOD_PRODUCT_UPDATE',
      'BLOOD_PRODUCT_DELETE',
      
      'DEMANDE_VIEW',
      'DEMANDE_CREATE',
      'DEMANDE_UPDATE',
      'DEMANDE_DELETE',
      'DEMANDE_VALIDATE',
      
      'DELIVRANCE_VIEW',
      'DELIVRANCE_CREATE',
      'DELIVRANCE_UPDATE',
      'DELIVRANCE_DELETE',
      
      'TRANSFUSION_VIEW',
      'TRANSFUSION_CREATE',
      'TRANSFUSION_UPDATE',
      'TRANSFUSION_DELETE',
      
      'TRACABILITY_VIEW',
      'TRACABILITY_CREATE',
      'TRACABILITY_UPDATE',
      'TRACABILITY_DELETE',
      
      'INCIDENT_VIEW',
      'INCIDENT_CREATE',
      'INCIDENT_UPDATE',
      'INCIDENT_DELETE',
      
      'USER_MANAGEMENT',
      'PATIENT_MANAGEMENT',
      'REPORT_VIEW',
      'TEAM_MANAGEMENT'
    ],
    
    ADMIN: [
      // Toutes les permissions de CHEF_SERVICE plus
      'SYSTEM_CONFIG',
      'ALL_ACCESS'
    ]
  };
  
  getPermissionsForRole(role: string): string[] {
    const basePermissions = this.rolePermissions[role as keyof typeof this.rolePermissions] || [];
    
    // ADMIN hérite de toutes les permissions
    if (role === 'ADMIN') {
      const allPermissions = new Set([...basePermissions]);
      
      // Ajouter toutes les permissions des autres rôles
      ['PERSONNEL', 'MEDECIN', 'CHEF_SERVICE'].forEach(otherRole => {
        this.rolePermissions[otherRole as keyof typeof this.rolePermissions]?.forEach(perm => {
          allPermissions.add(perm);
        });
      });
      
      return Array.from(allPermissions);
    }
    
    return basePermissions;
  }
  
  getPermissionsForRoles(roles: string[]): string[] {
    const allPermissions = new Set<string>();
    
    roles.forEach(role => {
      this.getPermissionsForRole(role).forEach(permission => {
        allPermissions.add(permission);
      });
    });
    
    return Array.from(allPermissions);
  }
  
  canRolePerformAction(role: string, permission: string): boolean {
    return this.getPermissionsForRole(role).includes(permission);
  }
}