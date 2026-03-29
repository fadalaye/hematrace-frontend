import { Medecin } from './medecin.interface';
import { Personnel } from './personnel.interface';
import { Delivrance } from './delivrance.interface';

export interface Demande {
    id?: number;

    medecinId: number;           // ✅ ID du médecin obligatoire
    medecin?: Medecin;           // Optionnel pour la lecture
    personnelId?: number;        // Optionnel pour le personnel
    personnel?: Personnel;       // Optionnel pour la lecture
    delivrance?: Delivrance;     // Optionnel
    
    // Infos demande
    dateHeureDemande: string;   // LocalDateTime → string ISO "YYYY-MM-DDTHH:mm:ss"
    serviceDemandeur: string;

    // Infos patient
    patientPrenom: string;
    patientNom: string;
    patientDateNaissance: string; // LocalDate → string "YYYY-MM-DD"
    patientNumDossier: string;
    groupeSanguinPatient: string;

    // Produit demandé
    typeProduitDemande: string;
    quantiteDemande: number;
    indicationTransfusion: string;
    urgence: boolean;

    // Autres
    observations?: string; // Optionnel
    statut: 'EN ATTENTE' | 'VALIDÉE' | 'REJETÉE'; 
}

export type StatutDemande = 'EN ATTENTE' | 'VALIDÉE' | 'REJETÉE';
