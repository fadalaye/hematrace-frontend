import { Transfusion } from './transfusion.interface';

export interface Surveillance {
    id: number;
    transfusion: Transfusion;
    heure: string;        // LocalTime → "HH:mm:ss"
    tension: string;
    temperature: number;
    pouls: number;
    signesCliniques: string;
    observations: string;
}
