import { Component, inject, signal } from '@angular/core';
import { CommonModule, NgClass } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../services/auth.service';
import { AnyUtilisateur, getUserTypeLabel } from '../../../../interfaces/any-utilisateur.interface';

@Component({
  selector: 'app-header-options-list',
  imports: [NgClass, RouterLink, CommonModule], // Ajouter RouterLink ici
  templateUrl: './header-options-list.component.html',
  styleUrl: './header-options-list.component.scss'
})
export class HeaderOptionsListComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  isMessages = signal<boolean>(false);
  isNotifications = signal<boolean>(false);
  isProfileOpen = signal<boolean>(false);

  // Signal pour l'utilisateur connecté
  currentUser = signal<AnyUtilisateur | null>(null);

  constructor() {
    // S'abonner aux changements de l'utilisateur
    this.authService.currentUser$.subscribe(user => {
      this.currentUser.set(user);
    });
  }

  /**
   * Obtenir le nom complet de l'utilisateur
   */
  getFullName(): string {
    const user = this.currentUser();
    return user ? `${user.prenom} ${user.nom}` : 'Utilisateur';
  }

  /**
   * Obtenir le rôle formaté de l'utilisateur
   */
  getFormattedRole(): string {
    const user = this.currentUser();
    return user ? getUserTypeLabel(user) : '';
  }

  /**
   * Obtenir la date d'embauche formatée
   */
  getFormattedHireDate(): string {
    const user = this.currentUser();
    if (!user?.dateEmbauche) return 'Date non disponible';
    
    const date = new Date(user.dateEmbauche);
    return `Membre depuis ${date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
  }

  /**
   * Obtenir l'initiale pour l'avatar
   */
  getInitials(): string {
    const user = this.currentUser();
    if (!user) return 'U';
    return `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase();
  }

  /**
   * Déconnexion
   */
  logout(): void {
    this.authService.logout();
    this.setProfileOpen(false);
  }

  /**
   * Navigation vers la page profil
   */
  goToProfile(): void {
    this.setProfileOpen(false);
    this.router.navigate(['/app/profil']);
  }

  // Méthodes existantes pour la gestion des dropdowns
  setMessages(value?: boolean) {
    this.isMessages.set(value ?? !this.isMessages());
  }

  setNotifications(value?: boolean) {
    this.isNotifications.set(value ?? !this.isNotifications());
  }

  setProfileOpen(value?: boolean) {
    this.isProfileOpen.set(value ?? !this.isProfileOpen());
  }

  toggleNotificationDropdown() {
    this.setMessages(false);
    this.setProfileOpen(false);
    this.setNotifications();
  }

  toggleMessagesDropdown() {
    this.setMessages();
    this.setNotifications(false);
    this.setProfileOpen(false);
  }

  toggleProfileDropdown() {
    this.setProfileOpen();
    this.setMessages(false);
    this.setNotifications(false);
  }

  toggleFullscreen() {
    const doc: any = document;
    const docEl: any = document.documentElement;

    if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    }
  }
}