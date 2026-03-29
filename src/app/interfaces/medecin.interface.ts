// interfaces/medecin.interface.ts
import { Utilisateur } from './utilisateur.interface';
import { Demande } from './demande.interface';
import { Transfusion } from './transfusion.interface';

export interface Medecin extends Utilisateur {
  specialite: string;
  demandes?: Demande[];
  transfusions?: Transfusion[];
}