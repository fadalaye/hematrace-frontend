// interfaces/chef-service.interface.ts
import { Utilisateur } from './utilisateur.interface';

export interface ChefService extends Utilisateur {
  serviceDirige: string;
  departement: string;
}