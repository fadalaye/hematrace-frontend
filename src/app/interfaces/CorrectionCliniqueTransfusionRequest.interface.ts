import { SurveillanceRequest } from '../interfaces/transfusion.interface';

export interface CorrectionCliniqueTransfusionRequest {
  tolerance: string;
  etatPatientApres: string;
  effetsIndesirables: boolean;
  typeEffet?: string;
  graviteEffet?: string;
  notes?: string;
  surveillances: SurveillanceRequest[];
}
