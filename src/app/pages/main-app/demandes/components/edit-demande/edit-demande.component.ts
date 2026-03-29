import { Component, inject, input, OnInit, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Demande } from '../../../../../interfaces/demande.interface';
import { MatButtonModule } from "@angular/material/button";
import { MatIconModule } from '@angular/material/icon';
import { DatePipe, CommonModule } from '@angular/common';
import { AuthService } from '../../../../../services/auth.service';
import { AnyUtilisateur, getUserType, isMedecin, isPersonnel, isChefService, isAdmin } from '../../../../../interfaces/any-utilisateur.interface';
import { Medecin } from '../../../../../interfaces/medecin.interface';

@Component({
  selector: 'app-edit-demande',
  imports: [
    CommonModule,
    ReactiveFormsModule, 
    MatButtonModule, 
    MatIconModule
  ],
  providers: [DatePipe],
  templateUrl: './edit-demande.component.html',
  styleUrl: './edit-demande.component.scss'
})
export class EditDemandeComponent implements OnInit {
  form!: FormGroup;
  
  updateItem = input<Demande | null>();
  addedData = output<Demande>();
  saved = output<Demande>();
  cancelled = output<void>();

  private formBuilder = inject(FormBuilder);
  private datePipe = inject(DatePipe);
  private authService = inject(AuthService);

  // Utilisateur connecté
  currentUser = this.authService.getCurrentUser();

  // ✅ Service par défaut selon le type d'utilisateur
  getDefaultService(): string {
    const user = this.currentUser;
    if (!user) return 'Non spécifié';

    if (isMedecin(user)) {
      return user.specialite || 'Médecine';
    } else if (isPersonnel(user)) {
      return user.fonction || 'Soins';
    } else if (isChefService(user)) {
      return user.serviceDirige || 'Direction';
    } else if (isAdmin(user)) {
      return 'Administration';
    } else {
      return getUserType(user) || 'Non spécifié';
    }
  }

  // ✅ Tous les utilisateurs connectés peuvent créer des demandes
  canCreateDemande(): boolean {
    const user = this.currentUser;
    if (!user) return false;

    const userType = getUserType(user);
    return ['MEDECIN', 'PERSONNEL', 'ADMIN', 'CHEF_SERVICE'].includes(userType);
  }

  ngOnInit() {
    this.initForm();
  }

  initForm() {
    const item = this.updateItem();
    
    // Formater la date pour l'input date
    const patientDateNaissance = item?.patientDateNaissance 
      ? this.formatDateForInput(item.patientDateNaissance)
      : '';

    this.form = this.formBuilder.group({
      // Infos patient
      patientNom: [item?.patientNom ?? '', Validators.required],
      patientPrenom: [item?.patientPrenom ?? '', Validators.required],
      patientDateNaissance: [patientDateNaissance, Validators.required],
      patientNumDossier: [item?.patientNumDossier ?? '', Validators.required],
      groupeSanguinPatient: [item?.groupeSanguinPatient ?? '', Validators.required],
      
      // Infos demande
      serviceDemandeur: [
        item?.serviceDemandeur ?? this.getDefaultService(),
        Validators.required
      ],
      typeProduitDemande: [item?.typeProduitDemande ?? '', Validators.required],
      quantiteDemande: [item?.quantiteDemande ?? 1, [Validators.required, Validators.min(1)]],
      indicationTransfusion: [item?.indicationTransfusion ?? '', Validators.required],
      urgence: [item?.urgence ?? false],
      
      // Autres
      observations: [item?.observations ?? ''],
      statut: [item?.statut ?? 'EN ATTENTE', Validators.required]
    });
  }

  onSubmit() {
    console.log('✅ onSubmit() demande appelé');
    
    if (this.form.invalid) {
      console.log('❌ Formulaire demande invalide', this.form.errors);
      this.markFormGroupTouched();
      return;
    }

    // Vérifier que l'utilisateur peut créer des demandes
    if (!this.updateItem() && !this.canCreateDemande()) {
      alert('Vous n\'avez pas les permissions pour créer une demande');
      return;
    }

    // Validation supplémentaire
    if (!this.validateDemande()) {
      return;
    }
    
    console.log('📦 Données du formulaire demande:', this.form.value);
    this.saveDemande();
  }

  saveDemande() {
    const formValue = this.form.value;
    
    // ✅ Vérification que l'utilisateur est bien un médecin (obligatoire pour le backend)
    if (!this.currentUser || !isMedecin(this.currentUser)) {
      alert('Seuls les médecins peuvent créer des demandes');
      return;
    }

    const data: Demande = {
      ...formValue,
      dateHeureDemande: this.updateItem()?.dateHeureDemande || new Date().toISOString(),
      patientDateNaissance: this.formatDateForAPI(formValue.patientDateNaissance),
      
      // ✅ CORRECTION : Envoyer l'objet Medecin COMPLET comme le backend Spring l'attend
      medecin: this.getMedecinComplet(),
      
      // Optionnel selon si l'utilisateur est aussi du personnel
      personnel: this.getPersonnelComplet(),
      
      delivrance: this.updateItem()?.delivrance
    };

    const currentItem = this.updateItem();
    
    if (currentItem?.id) {
      this.saved.emit({ 
        ...data,
        id: currentItem.id 
      });
    } else {
      this.addedData.emit(data);
    }
  }

  /**
   * Retourne un objet Medecin complet avec tous les champs requis par le backend Spring
   */
  private getMedecinComplet(): Medecin {
  const user = this.currentUser;
  
  if (!user || !isMedecin(user)) {
    throw new Error('Utilisateur non connecté ou non médecin');
  }

  // ✅ Utilise l'ID de l'utilisateur (7) comme ID du médecin
  // Votre structure : table medecin n'a pas d'ID propre, utilise utilisateur_id
  return {
    id: user.id!, // ← ID utilisateur (7) qui est aussi l'ID médecin
    matricule: user.matricule!,
    nom: user.nom!,
    prenom: user.prenom!,
    email: user.email!,
    sexe: user.sexe!,
    dateNaissance: user.dateNaissance!,
    statut: user.statut!,
    specialite: user.specialite!, // 'Cardiologie' depuis votre base
    telephone: user.telephone || '',
    adresse: user.adresse || '',
    dateEmbauche: user.dateEmbauche || '',
    photoProfil: user.photoProfil || '',
    demandes: [],
    transfusions: []
  };
}

  /**
   * Retourne un objet Personnel complet si l'utilisateur est du personnel
   */
  private getPersonnelComplet(): any {
    const user = this.currentUser;
    
    if (user && isPersonnel(user)) {
      return {
        id: user.id!,
        matricule: user.matricule!,
        nom: user.nom!,
        prenom: user.prenom!,
        email: user.email!,
        sexe: user.sexe!,
        dateNaissance: user.dateNaissance!,
        statut: user.statut!,
        fonction: user.fonction!,
        telephone: user.telephone || '',
        adresse: user.adresse || '',
        dateEmbauche: user.dateEmbauche || '',
        photoProfil: user.photoProfil || '',
        demandes: []
      };
    }
    return undefined;
  }

  /**
   * Récupère l'ID du demandeur selon le type d'utilisateur
   */
  private getDemandeurId(): number {
    const user = this.currentUser;
    if (!user?.id) {
      throw new Error('Utilisateur non connecté');
    }
    return user.id;
  }

  /**
   * Récupère l'ID du personnel si applicable
   */
  private getPersonnelId(): number | undefined {
    const user = this.currentUser;
    if (user && isPersonnel(user) && user.id) {
      return user.id;
    }
    return undefined;
  }

  /**
   * Détermine le médecin demandeur selon l'utilisateur connecté
   */
  private getDemandeurMedecin(): any {
    const user = this.currentUser;
    if (!user || !isMedecin(user)) return null;

    return {
      id: user.id,
      matricule: user.matricule,
      nom: user.nom,
      prenom: user.prenom,
      specialite: user.specialite,
      email: user.email
    };
  }

  /**
   * Détermine le personnel demandeur selon l'utilisateur connecté
   */
  private getDemandeurPersonnel(): any {
    const user = this.currentUser;
    if (!user || !isPersonnel(user)) return null;

    return {
      id: user.id,
      matricule: user.matricule,
      nom: user.nom,
      prenom: user.prenom,
      fonction: user.fonction,
      email: user.email
    };
  }

  /**
   * Détermine le chef de service demandeur
   */
  private getDemandeurChefService(): any {
    const user = this.currentUser;
    if (!user || !isChefService(user)) return null;

    return {
      id: user.id,
      matricule: user.matricule,
      nom: user.nom,
      prenom: user.prenom,
      serviceDirige: user.serviceDirige,
      email: user.email
    };
  }

  /**
   * Détermine l'admin demandeur
   */
  private getDemandeurAdmin(): any {
    const user = this.currentUser;
    if (!user || !isAdmin(user)) return null;

    return {
      id: user.id,
      matricule: user.matricule,
      nom: user.nom,
      prenom: user.prenom,
      role: user.role,
      email: user.email
    };
  }

  /**
   * Validation personnalisée de la demande
   */
  private validateDemande(): boolean {
    const formValue = this.form.value;
    
    // Validation de la date de naissance
    const birthDate = new Date(formValue.patientDateNaissance);
    if (birthDate > new Date()) {
      alert('La date de naissance ne peut pas être dans le futur');
      return false;
    }

    // Validation de l'âge (optionnel)
    const age = this.calculateAge(birthDate);
    if (age > 120) {
      alert('L\'âge du patient semble invalide');
      return false;
    }

    return true;
  }

  /**
   * Calcule l'âge à partir de la date de naissance
   */
  private calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }

  /**
   * Marque tous les champs comme touchés pour afficher les erreurs
   */
  private markFormGroupTouched() {
    Object.keys(this.form.controls).forEach(key => {
      const control = this.form.get(key);
      control?.markAsTouched();
    });
  }

  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  private formatDateForAPI(date: string): string {
    if (!date) return '';
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }
    return this.datePipe.transform(date, 'yyyy-MM-dd') || '';
  }

  cancel() {
    console.log('❌ Annulation demande');
    this.cancelled.emit();
  }
}