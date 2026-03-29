// incident-search.interface.ts
export interface IncidentSearchCriteria {
    dateIncident?: Date;
    startDate?: Date;
    endDate?: Date;
    patientNom?: string;
    patientPrenom?: string;
    patientNumDossier?: string;
    typeProduit?: string;
    valide?: boolean;
    transfusionId?: number;
    lieuIncident?: string;
    }