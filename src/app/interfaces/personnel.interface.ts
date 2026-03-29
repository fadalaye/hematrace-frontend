// interfaces/personnel.interface.ts
import { Utilisateur } from './utilisateur.interface';
import { Demande } from './demande.interface';

export interface Personnel extends Utilisateur {
  fonction: string;
  demandes?: Demande[];
}