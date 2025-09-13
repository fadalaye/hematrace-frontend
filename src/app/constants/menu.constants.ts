import { MenuItem } from "../interfaces/menu-item.interface";

export const MENU_ITEMS: MenuItem[] = [
    { 
        label: 'dashboard',
        icon: 'bi bi-house',
        route: 'dashboard', 
    },
    { 
        label: 'users',
        icon: 'bi bi-people',
        route: 'users', 
    },
    { 
        label: 'Reports',
        // icon: 'bi bi-bar-chart-fill',
        icon: 'fas fa-chart-column',
        route: '', 
        subMenu: [
           {
            label: 'User Report',
            icon: 'bi bi-bar-chart-fill',
            route: 'user-repport',
           },
           {
            label: 'Manager Report',
            icon: 'bi bi-bar-chart-fill',
            route: 'manager-report',
          }
        ]
    }
];