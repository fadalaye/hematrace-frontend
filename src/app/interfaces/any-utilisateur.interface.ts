// interfaces/any-utilisateur.interface.ts
import { Utilisateur } from './utilisateur.interface';
import { Personnel } from './personnel.interface';
import { Medecin } from './medecin.interface';
import { ChefService } from './chef-service.interface';
import { Admin } from './admin.interface';

export type AnyUtilisateur = Utilisateur | Personnel | Medecin | ChefService | Admin;

// Type guards robustes
export function isMedecin(user: AnyUtilisateur): user is Medecin {
  return 'specialite' in user && 
         typeof (user as any).specialite === 'string' && 
         (user as any).specialite.trim().length > 0;
}

export function isPersonnel(user: AnyUtilisateur): user is Personnel {
  return 'fonction' in user && 
         typeof (user as any).fonction === 'string' && 
         (user as any).fonction.trim().length > 0;
}

export function isChefService(user: AnyUtilisateur): user is ChefService {
  return 'serviceDirige' in user && 
         typeof (user as any).serviceDirige === 'string' && 
         (user as any).serviceDirige.trim().length > 0;
}

export function isAdmin(user: AnyUtilisateur): user is Admin {
  return 'role' in user && 
         typeof (user as any).role === 'string' && 
         (user as any).role.trim().length > 0;
}

/** Retourne le type interne */
export function getUserType(user: AnyUtilisateur): string {
  if (isMedecin(user)) return 'MEDECIN';
  if (isPersonnel(user)) return 'PERSONNEL';
  if (isChefService(user)) return 'CHEF_SERVICE';
  if (isAdmin(user)) return 'ADMIN';
  return 'UTILISATEUR';
}

/** Libellés lisibles pour l'UI */
export function getUserTypeLabel(user: AnyUtilisateur): string {
  switch (getUserType(user)) {
    case 'MEDECIN': return 'Médecin';
    case 'PERSONNEL': return 'Personnel';
    case 'CHEF_SERVICE': return 'Chef de Service';
    case 'ADMIN': return 'Administrateur';
    default: return 'Utilisateur';
  }
}

/** Extrait les données spécifiques d'un type d'utilisateur */
export function getSpecificData(user: AnyUtilisateur): any {
  if (isMedecin(user)) {
    return { specialite: user.specialite };
  }
  if (isPersonnel(user)) {
    return { fonction: user.fonction };
  }
  if (isChefService(user)) {
    return { 
      serviceDirige: user.serviceDirige, 
      departement: user.departement 
    };
  }
  if (isAdmin(user)) {
    return { 
      role: user.role, 
      droitsAccess: user.droitsAccess 
    };
  }
  return {};
}

/** Crée un objet utilisateur pour l'API en enlevant les relations */
export function prepareUserForAPI(user: AnyUtilisateur): any {
  const { demandes, transfusions, ...userData } = user as any;
  return userData;
}