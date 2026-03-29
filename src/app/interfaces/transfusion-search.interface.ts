// transfusion-search.interface.ts
export interface TransfusionSearchCriteria {
  medecinId?: number;
  produitSanguinId?: number;
  groupeSanguin?: string;
  tolerance?: string;
  effetsIndesirables?: boolean;
  startDate?: Date;
  endDate?: Date;
  patientNom?: string;
  patientPrenom?: string;
  patientNumDossier?: string;
}