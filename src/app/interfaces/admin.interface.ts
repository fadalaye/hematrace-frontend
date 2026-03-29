// interfaces/admin.interface.ts
import { Utilisateur } from './utilisateur.interface';

export interface Admin extends Utilisateur {
  role: string;
  droitsAccess?: string;
}