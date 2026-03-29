import { Medecin } from './medecin.interface';
import { Surveillance } from './surveillance.interface';
import { ProduitSanguin } from './produit-sanguin.interface';
import { IncidentTransfusionnel } from './incident-transfusionnel.interface';

export interface Transfusion {
    id?: number;
    
    // Relations optionnelles
    medecin?: Medecin;
    produitSanguin?: ProduitSanguin;
    surveillances?: Surveillance[];
    incidentTransfusionnel?: IncidentTransfusionnel;
    
    // IDs optionnels
    medecinId?: number;
    produitSanguinId?: number;
    
    // Champs obligatoires
    patientPrenom: string;
    patientNom: string;
    patientDateNaissance: string;
    patientNumDossier: string;
    groupeSanguinPatient: string;
    dateTransfusion: string;
    heureDebut: string;
    etatPatientApres: string;
    tolerance: string;
    effetsIndesirables: boolean;
    prenomDeclarant: string;
    nomDeclarant: string;
    fonctionDeclarant: string;
    
    // Champs optionnels
    heureFin?: string;
    notes?: string;
    volumeMl?: number;
    typeEffet?: string;
    graviteEffet?: string;
    dateDeclaration?: string;
}

export interface CreerTransfusionRequest {
    // Inclure tous les champs persistés
    medecinId: number;
    produitSanguinId: number;
    
    // Informations patient
    patientPrenom: string;
    patientNom: string;
    patientDateNaissance: string;  // "YYYY-MM-DD"
    patientNumDossier: string;
    groupeSanguinPatient: string;
    
    // Dates et heures
    dateTransfusion: string;        // "YYYY-MM-DD"
    heureDebut: string;             // "HH:mm:ss"
    heureFin?: string;              // "HH:mm:ss"
    
    // État patient
    etatPatientApres: string;
    tolerance: string;
    effetsIndesirables: boolean;
    typeEffet?: string;
    graviteEffet?: string;
    
    // Déclarant
    prenomDeclarant: string;
    nomDeclarant: string;
    fonctionDeclarant: string;
    
    // Autres champs
    notes?: string;
    volumeMl?: number;
    dateDeclaration?: string;
}

export interface TransfusionWithSurveillancesRequest {
    // Champs de la transfusion
    medecinId: number;
    produitSanguinId: number;
    patientPrenom: string;
    patientNom: string;
    patientDateNaissance: string;  // "YYYY-MM-DD"
    patientNumDossier: string;
    groupeSanguinPatient: string;
    heureFin?: string;              // "HH:mm:ss"
    etatPatientApres: string;
    tolerance: string;
    effetsIndesirables: boolean;
    typeEffet?: string;
    prenomDeclarant: string;
    nomDeclarant: string;
    fonctionDeclarant: string;
    
    // Dates
    dateTransfusion: string;        // "YYYY-MM-DD"
    heureDebut: string;             // "HH:mm:ss"
    notes?: string;
    volumeMl?: number;
    graviteEffet?: string;
    dateDeclaration?: string;
    
    // Incident transfusionnel (optionnel)
    incident?: IncidentTransfusionnelRequest;
    
    // Surveillances (optionnel)
    surveillances: SurveillanceRequest[];
}

export interface IncidentTransfusionnelRequest {
    dateIncident: string;           // "YYYY-MM-DD"
    heureIncident: string;          // "HH:mm:ss"
    lieuIncident: string;
    typeProduitTransfuse: string;
    numeroLotProduit: string;
    datePeremptionProduit: string;  // "YYYY-MM-DD"
    descriptionIncident?: string;
    signes?: string;
    symptomes?: string;
    actionsImmediates?: string;
    personnesInformees?: string;
    analysePreliminaire?: string;
    actionsCorrectives?: string;
    nomDeclarant: string;
    fonctionDeclarant: string;
    registreHemovigilance?: string;
}

export interface SurveillanceRequest {
    heure: string;                  // "HH:mm:ss"
    tension: string;
    temperature: number;
    pouls: number;
    signesCliniques: string;
    observations?: string;
}