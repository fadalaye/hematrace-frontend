import { MenuItem } from "../interfaces/menu-item.interface";

export const MENU_ITEMS: MenuItem[] = [
{
    label: 'Accueil',
    icon: 'bi bi-house',
    route: 'dashboard',
},
{
    label: 'Produits sanguins',
    icon: 'bi bi-droplet',
    route: 'produits-sanguins',
},
{
    label: 'Demandes',
    icon: 'bi bi-inbox',
    route: 'demandes',
},
{
    label: 'Delivrances',
    icon: 'bi bi-file-earmark-medical',
    route: 'delivrances',
},
{
    label: 'Transfusions',
    icon: 'bi bi-heart-pulse',
    route: 'transfusions',
},
{
    label: 'Traçabilité',
    icon: 'bi bi-diagram-3',
    route: 'tracabilite',
},
{
    label: 'Incidents transfusionnels',
    icon: 'bi bi-exclamation-triangle',
    route: 'incidents',
},
{
    label: 'Rapports & Statistiques',
    icon: 'bi bi-bar-chart',
    route: '',
    subMenu: [
        { label: 'Rapport des demandes', icon: 'bi bi-file-earmark-text', route: 'rapports/demandes' },
        { label: 'Rapport des produits', icon: 'bi bi-file-earmark-text', route: 'rapports/produits' },
        { label: 'Rapport des incidents', icon: 'bi bi-file-earmark-text', route: 'rapports/incidents' },
    ]
},
{
    label: 'Utilisateurs',
    icon: 'bi bi-people',
    route: 'utilisateurs',
}
];
