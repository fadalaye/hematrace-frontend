// interfaces/delivrance.interface.ts
import { Demande } from './demande.interface';
import { ProduitSanguin } from './produit-sanguin.interface';
import { Personnel } from './personnel.interface';

// Interface pour la réponse API
export interface DelivranceApiResponse {
  data: DelivranceWrapper[];
  success: boolean;
  count: number;
}

// Interface pour le wrapper de l'API
export interface DelivranceWrapper {
  produitsDisponiblesCount: number;
  delivrance: Delivrance;          // C'est ICI que se trouve la vraie délivrance
  produitsTransfusesCount: number;
  aProduitsDisponibles: boolean;
}

// Interface principale pour une délivrance
export interface Delivrance {
  id?: number;
  dateHeureDelivrance: string | Date;
  
  // Relations
  demande: Demande;
  produitsSanguins: ProduitSanguin[];
  personnel: Personnel;
  
  // Informations de délivrance
  destination: string;
  modeTransport: string;
  observations?: string;
}

// Interface pour les réponses détaillées (dépréciée - utiliser DelivranceApiResponse)
export interface DelivranceWithDetails extends Delivrance {
  demande: Demande;
  produitsSanguins: ProduitSanguin[];
  personnel: Personnel;
}

// Interface pour la création
export interface CreerDelivranceData {
  demandeId: number;
  produitIds: number[];
  personnelId: number;
  destination: string;
  modeTransport: string;
  observations?: string;
}

// Interface pour la réponse de création
export interface CreerDelivranceResponse {
  success: boolean;
  message: string;
  delivrance?: Delivrance;
  errors?: string[];
}