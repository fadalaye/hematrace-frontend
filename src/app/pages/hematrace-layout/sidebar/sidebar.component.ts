import { Component, inject, signal } from '@angular/core';
import { OverlayscrollbarsModule } from 'overlayscrollbars-ngx';
import { MenuItem } from '../../../interfaces/menu-item.interface';
import { MENU_ITEMS } from '../../../constants/menu.constants';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  imports: [OverlayscrollbarsModule, RouterLink, RouterLinkActive, NgClass],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  private authService = inject(AuthService);

  // Menu complet
  private fullMenuItems = signal<MenuItem[]>(MENU_ITEMS);
  
  // Menu filtré selon les permissions
  filteredMenuItems = signal<MenuItem[]>([]);
  
  activeMenu = signal<string | null>(null);

  constructor() {
    // Filtrer le menu au chargement
    this.filterMenuByPermissions();
    
    // Réagir aux changements d'authentification
    this.authService.currentUser$.subscribe(() => {
      this.filterMenuByPermissions();
    });
  }
  hasPermissionForRoute(route: string | undefined): boolean {
    const requiredPermissions = this.getRequiredPermissionsForRoute(route);
    return this.authService.hasAnyPermission(requiredPermissions);
  }
  toggleMenu(label: string | undefined) {
    this.activeMenu.set(this.activeMenu() === label ? null : label ?? '');
  }

  /**
   * Filtre les éléments du menu selon les permissions de l'utilisateur
   */
  private filterMenuByPermissions(): void {
    const user = this.authService.getCurrentUser();
    
    if (!user) {
      this.filteredMenuItems.set([]);
      return;
    }

    const filteredMenu = this.fullMenuItems().filter(item => 
      this.canAccessMenuItem(item)
    );

    this.filteredMenuItems.set(filteredMenu);
  }

  /**
   * Vérifie si l'utilisateur peut accéder à un élément du menu
   */
  private canAccessMenuItem(item: MenuItem): boolean {
    const userPermissions = this.authService.userPermissions();
    
    // Mapping des routes aux permissions requises
    const routePermissions: { [key: string]: string[] } = {
      'dashboard': ['BASIC_ACCESS'],
      'produits-sanguins': ['BLOOD_PRODUCT_VIEW', 'BLOOD_PRODUCT_MANAGEMENT'],
      'demandes': ['DEMANDE_VIEW', 'DEMANDE_CREATE', 'DEMANDE_MANAGE', 'DEMANDE_MANAGEMENT'],
      'delivrances': ['DELIVRANCE_VIEW', 'DELIVRANCE_CREATE', 'DELIVRANCE_MANAGE', 'DELIVRANCE_MANAGEMENT'],
      'transfusions': ['TRANSFUSION_VIEW', 'TRANSFUSION_CREATE', 'TRANSFUSION_MANAGE', 'TRANSFUSION_MANAGEMENT'],
      'tracabilite': ['TRACABILITY_VIEW'],
      'incidents': ['INCIDENT_VIEW', 'INCIDENT_REPORT', 'INCIDENT_MANAGEMENT'],
      'utilisateurs': ['USER_MANAGEMENT']
    };

    // Pour les items simples
    if (item.route && !item.subMenu) {
      const requiredPermissions = routePermissions[item.route] || ['BASIC_ACCESS'];
      return this.authService.hasAnyPermission(requiredPermissions);
    }

    // Pour les items avec sous-menu
    if (item.subMenu) {
      // Vérifier si au moins un sous-menu est accessible
      const hasAccessibleSubMenu = item.subMenu.some(subItem => {
        const subRequiredPermissions = this.getRequiredPermissionsForRoute(subItem.route);
        return this.authService.hasAnyPermission(subRequiredPermissions);
      });
      
      return hasAccessibleSubMenu;
    }

    return true; // Pour les headers et autres éléments sans route
  }

  /**
   * Retourne les sous-menus accessibles pour un item parent
   */
  getAccessibleSubMenuItems(subMenuItems: MenuItem[]): MenuItem[] {
    return subMenuItems.filter(subItem => {
      const requiredPermissions = this.getRequiredPermissionsForRoute(subItem.route);
      return this.authService.hasAnyPermission(requiredPermissions);
    });
  }

  /**
   * Détermine les permissions requises pour une route donnée
   */
  private getRequiredPermissionsForRoute(route: string | undefined): string[] {
    if (!route) return ['BASIC_ACCESS'];

    const routePermissions: { [key: string]: string[] } = {
      'dashboard': ['BASIC_ACCESS'],
      'produits-sanguins': ['BLOOD_PRODUCT_VIEW', 'BLOOD_PRODUCT_MANAGEMENT'],
      'demandes': ['DEMANDE_VIEW', 'DEMANDE_CREATE', 'DEMANDE_MANAGE', 'DEMANDE_MANAGEMENT'],
      'delivrances': ['DELIVRANCE_VIEW', 'DELIVRANCE_CREATE', 'DELIVRANCE_MANAGE', 'DELIVRANCE_MANAGEMENT'],
      'transfusions': ['TRANSFUSION_VIEW', 'TRANSFUSION_CREATE', 'TRANSFUSION_MANAGE', 'TRANSFUSION_MANAGEMENT'],
      'tracabilite': ['TRACABILITY_VIEW'],
      'incidents': ['INCIDENT_VIEW', 'INCIDENT_REPORT', 'INCIDENT_MANAGEMENT'],
      'rapports/demandes': ['REPORT_VIEW'],
      'rapports/produits': ['REPORT_VIEW'],
      'rapports/incidents': ['REPORT_VIEW'],
      'utilisateurs': ['USER_MANAGEMENT']
    };

    return routePermissions[route] || ['BASIC_ACCESS'];
  }
}