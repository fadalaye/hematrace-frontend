import { Delivrance } from './delivrance.interface';
import { Transfusion } from './transfusion.interface';

export interface ProduitSanguin {
    id?: number;
    delivrance?: Delivrance;  // Optionnel
    transfusion?: Transfusion; // Optionnel
    codeProduit: string;
    typeProduit: string;
    groupeSanguin: string;
    rhesus: string;
    volumeMl: number;
    datePrelevement: string;   // LocalDate → "YYYY-MM-DD"
    datePeremption: string;    // LocalDate → "YYYY-MM-DD"
    etat: string;              // ex : disponible, expiré
}