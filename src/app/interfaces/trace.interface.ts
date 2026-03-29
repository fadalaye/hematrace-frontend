// trace.interfaces.ts
export interface Trace {
  id: number;
  entityType: EntityType;
  entityId: number;
  action: ActionType;
  userId: number;
  userName: string;
  userRole: string;
  timestamp: Date;
  details: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface TraceSearchResult {
  id: number;
  type: EntityType;
  reference: string;
  description: string;
  date: Date;
  status: string;
  user: string;
  entity: any;
}

export type EntityType = 
  | 'produit' 
  | 'demande' 
  | 'delivrance' 
  | 'transfusion' 
  | 'incident' 
  | 'surveillance'
  | 'log';

export type ActionType = 
  | 'CREATION'
  | 'MODIFICATION'
  | 'SUPPRESSION'
  | 'VALIDATION'
  | 'REJET'
  | 'CONSULTATION'
  | 'EXPORT';

export interface SearchCriteria {
  entityType?: EntityType[];
  dateRange?: { start: Date; end: Date };
  userId?: number;
  reference?: string;
  status?: string;
  patientName?: string;
  produitCode?: string;
  keywords?: string;
  page?: number;
  pageSize?: number;
}

export interface TraceFilters {
  type?: string;
  id?: number;
  reference?: string;
  dateDebut?: Date;
  dateFin?: Date;
  utilisateur?: string;
  statut?: string;
  query?: string;
}

export interface TraceElement {
  id: number;
  type: string;
  libelle: string;
  reference: string;
  description: string;
  date: Date;
  utilisateur: string;
  statut: string;
  details: any;
  lien: string;
  entity?: any;
  relation?: string;
  etape?: number;
  displayDate?: string;
  icon?: string;
  color?: string;
}