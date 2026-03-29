import { Transfusion } from './transfusion.interface';

export interface IncidentTransfusionnel {
    id: number;
    transfusion: Transfusion;

    dateIncident: string;     // LocalDate
    heureIncident: string;    // LocalTime
    lieuIncident: string;

    patientPrenom: string;
    patientNom: string;
    patientDateNaissance: string;
    patientNumDossier: string;

    typeProduitTransfuse: string;
    numeroLotProduit: string;
    datePeremptionProduit: string;

    descriptionIncident?: string;
    signes?: string;
    symptomes?: string;
    actionsImmediates?: string;
    personnesInformees?: string;
    analysePreliminaire?: string;
    actionsCorrectives?: string;

    dateHeureDeclaration: string;  // LocalDateTime
    nomDeclarant: string;
    fonctionDeclarant: string;

    registreHemovigilance?: string;
    signatureDeclarant?: string;
    signatureResponsableQualite?: string;
    dateValidation?: string;
}
