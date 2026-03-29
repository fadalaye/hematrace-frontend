// profil.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../../services/auth.service';
import { 
  AnyUtilisateur, 
  getUserTypeLabel, 
  isMedecin, 
  isPersonnel, 
  isChefService, 
  isAdmin,
  getSpecificData 
} from '../../../../../interfaces/any-utilisateur.interface';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './profil.component.html',
  styleUrls: ['./profil.component.scss']
})
export class ProfilComponent {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  currentUser = signal<AnyUtilisateur | null>(null);
  isLoading = signal(false);
  isEditing = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  // Formulaire de profil
  profileForm = this.fb.group({
    nom: ['', [Validators.required]],
    prenom: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    telephone: [''],
    sexe: [''],
    dateNaissance: ['']
  });

  // Formulaire de changement de mot de passe
  passwordForm = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  constructor() {
    this.loadUserProfile();
  }

  /**
   * Charger les données du profil utilisateur
   */
  private loadUserProfile(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUser.set(user);
      this.profileForm.patchValue({
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        telephone: user.telephone || '',
        sexe: user.sexe,
        dateNaissance: user.dateNaissance
      });
    }
  }

  /**
   * Activer/désactiver le mode édition
   */
  toggleEdit(): void {
    this.isEditing.set(!this.isEditing());
    if (!this.isEditing()) {
      this.loadUserProfile(); // Recharger les données originales
    }
  }

  /**
   * Sauvegarder les modifications du profil
   */
  saveProfile(): void {
    if (this.profileForm.valid) {
      this.isLoading.set(true);
      this.errorMessage.set('');

      // Simuler la sauvegarde
      setTimeout(() => {
        const user = this.currentUser();
        if (user) {
          const updatedUser = {
            ...user,
            ...this.profileForm.value
          };

          console.log('Profil mis à jour:', updatedUser);
        }
        
        this.isLoading.set(false);
        this.isEditing.set(false);
        this.successMessage.set('Profil mis à jour avec succès');
        
        setTimeout(() => this.successMessage.set(''), 3000);
      }, 1000);
    }
  }

  /**
   * Changer le mot de passe
   */
  changePassword(): void {
    if (this.passwordForm.valid) {
      const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;

      if (newPassword !== confirmPassword) {
        this.errorMessage.set('Les mots de passe ne correspondent pas');
        return;
      }

      this.isLoading.set(true);

      setTimeout(() => {
        console.log('Changement de mot de passe simulé');
        this.isLoading.set(false);
        this.successMessage.set('Mot de passe changé avec succès');
        this.passwordForm.reset();
        
        setTimeout(() => this.successMessage.set(''), 3000);
      }, 1000);
    }
  }

  /**
   * Obtenir les initiales pour l'avatar
   */
  getInitials(): string {
    const user = this.currentUser();
    if (!user) return 'U';
    return `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase();
  }

  /**
   * Formater la date d'embauche
   */
  getFormattedHireDate(): string {
    const user = this.currentUser();
    if (!user?.dateEmbauche) return 'Non disponible';
    
    return new Date(user.dateEmbauche).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Obtenir le rôle formaté
   */
  getFormattedRole(): string {
    const user = this.currentUser();
    return user ? getUserTypeLabel(user) : 'Utilisateur';
  }

  /**
   * Vérifier le type d'utilisateur et obtenir les données spécifiques
   */
  getProfessionalInfo(): any {
    const user = this.currentUser();
    if (!user) return null;

    if (isMedecin(user)) {
      return {
        type: 'Médecin',
        specialite: user.specialite
      };
    }

    if (isPersonnel(user)) {
      return {
        type: 'Personnel',
        fonction: user.fonction
      };
    }

    if (isChefService(user)) {
      return {
        type: 'Chef de Service',
        serviceDirige: user.serviceDirige,
        departement: user.departement
      };
    }

    if (isAdmin(user)) {
      return {
        type: 'Administrateur',
        role: user.role,
        droitsAccess: user.droitsAccess
      };
    }

    return null;
  }

  /**
   * Vérifier si l'utilisateur a des informations professionnelles
   */
  hasProfessionalInfo(): boolean {
    return this.getProfessionalInfo() !== null;
  }
}