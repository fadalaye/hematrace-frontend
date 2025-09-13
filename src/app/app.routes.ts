import { Routes } from '@angular/router';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'app',
        pathMatch: 'full',

    },
    {
        path: 'app',
        loadComponent: () => 
            import('./pages/hematrace-layout/hematrace-layout.component').
                then((c)=> c.HematraceLayoutComponent
            ),
            children: [
                {
                    path: '',
                    redirectTo: 'dashboard',
                    pathMatch: 'full',
                },
                {
                    path: 'dashboard',
                    loadComponent: () => 
                        import('./pages/main-app/dashboard/dashboard.component').then((c)=> c.DashboardComponent),
                },
                {
                    path: 'users',
                    loadComponent: () => 
                        import('./pages/main-app/users/users.component').then((c)=> c.UsersComponent),
                },
            ],

    }         
];
