// interfaces/utilisateur.interface.ts
export interface Utilisateur {
  id?: number;
  matricule: string;
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  sexe: 'M' | 'F';
  dateNaissance: string;
  adresse?: string;
  dateEmbauche?: string;
  motDePasse?: string;
  photoProfil?: string;
  statut: 'ACTIF' | 'INACTIF' | 'CONGÉ';
}