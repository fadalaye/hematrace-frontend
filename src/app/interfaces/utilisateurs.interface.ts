// utilisateur.interface.ts

export interface Utilisateur {
    id?: number;
    matricule: string;
    nom: string;
    prenom: string;
    email: string;
    telephone?: string; // optionnel
    sexe: 'M' | 'F';    // car tu as un char en Java (M/F)
    dateNaissance: string; // format ISO 'YYYY-MM-DD'
    adresse?: string;
    dateEmbauche?: string; // 'YYYY-MM-DD'
    motDePasse: string;
    photoProfil?: string;
    statut: string; // Exemple : 'ACTIF', 'INACTIF'
}