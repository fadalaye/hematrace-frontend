import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { LoginComponent } from './pages/main-app/login/login.component';
import { UnauthorizedComponent } from './pages/main-app/unauthorized/unauthorized.component';

export const routes: Routes = [
  // Routes publiques
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'unauthorized', 
    component: UnauthorizedComponent
  },
    {
    path: 'activer-compte',
    loadComponent: () =>
      import('./pages/main-app/activer-compte/activer-compte.component')
        .then(m => m.ActiverCompteComponent)
  },
  
  // Redirection racine
  {
    path: '',
    redirectTo: 'app',
    pathMatch: 'full',
  },
  
  // Zone principale
  {
    path: 'app',
    loadComponent: () => 
      import('./pages/hematrace-layout/hematrace-layout.component')
        .then((c) => c.HematraceLayoutComponent),
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      
      // Dashboard
      {
        path: 'dashboard',
        loadComponent: () => 
          import('./pages/main-app/dashboard/dashboard.component')
            .then((c) => c.DashboardComponent),
        data: { 
          roles: ['MEDECIN', 'PERSONNEL', 'CHEF_SERVICE', 'ADMIN'] 
        }
      },
      
      // Utilisateurs
      {
        path: 'utilisateurs',
        children: [
          {
            path: '',
            loadComponent: () => 
              import('./pages/main-app/utilisateurs/utilisateurs.component')
                .then((c) => c.UtilisateursComponent),
            data: { 
              permissions: ['USER_MANAGEMENT']
            }
          }
        ]
      },
      
      // Demandes
      {
        path: 'demandes',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/main-app/demandes/demandes.component')
                .then((c) => c.DemandesComponent),
            data: { 
              permissions: ['DEMANDE_VIEW']
            }
          }
        ]
      },
      
      // Produits sanguins
      {
        path: 'produits-sanguins',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/main-app/produits-sanguins/produits-sanguins.component')
                .then((c) => c.ProduitsSanguinsComponent),
            data: { 
              permissions: ['BLOOD_PRODUCT_VIEW']
            }
          }
        ]
      },
      
      // Délivrances
      {
        path: 'delivrances',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/main-app/delivrances/delivrances.component')
                .then((c) => c.DelivrancesComponent),
            data: { 
              permissions: ['DELIVRANCE_VIEW']
            }
          }
        ]
      },
      
      // Transfusions
      {
        path: 'transfusions',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/main-app/transfusions/transfusions.component')
                .then((c) => c.TransfusionsComponent),
            data: { 
              permissions: ['TRANSFUSION_VIEW']
            }
          },
          {
            path: 'creer',
            loadComponent: () => 
              import('./pages/main-app/transfusions/transfusion-form/transfusion-form.component')
                .then((c) => c.TransfusionFormComponent),
            data: { 
              permissions: ['TRANSFUSION_CREATE']
            }
          },
          {
            path: 'modifier/:id',
            loadComponent: () => 
              import('./pages/main-app/transfusions/transfusion-form/transfusion-form.component')
                .then((c) => c.TransfusionFormComponent),
            data: { 
              permissions: ['TRANSFUSION_UPDATE']
            }
          }
        ]
      },
      
      // Traçabilité
      {
        path: 'tracabilite',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/main-app/tracabilite/tracabilite.component')
                .then((c) => c.TracabiliteComponent),
            data: { 
              permissions: ['TRACABILITY_VIEW']
            }
          }
        ]
      },
      
      // Incidents
      {
        path: 'incidents',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/main-app/incidents/incidents.component')
                .then((c) => c.IncidentsComponent),
            data: { 
              permissions: ['INCIDENT_VIEW']
            }
          },
          {
            path: 'declarer',
            loadComponent: () => 
              import('./pages/main-app/incidents/components/edit-incident/edit-incident.component')
                .then((c) => c.EditIncidentComponent),
            data: { 
              permissions: ['INCIDENT_CREATE']
            }
          },
          {
            path: 'modifier/:id',
            loadComponent: () => 
              import('./pages/main-app/incidents/components/edit-incident/edit-incident.component')
                .then((c) => c.EditIncidentComponent),
            data: { 
              permissions: ['INCIDENT_UPDATE']
            }
          }
        ]
      },
      
      // Profil
      {
        path: 'profil',
        loadComponent: () =>
          import('./pages/hematrace-layout/header/header-options-list/profil/profil.component')
            .then((c) => c.ProfilComponent)
      },
        // Rapports
      {
        path: 'rapports',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./pages/main-app/rapports/rapports.component')
                .then((c) => c.RapportsComponent),
            data: {
              permissions: ['REPORT_VIEW']
            }
          },
          {
            path: 'demandes',
            loadComponent: () =>
              import('./pages/main-app/rapports/rapport-demandes/rapport-demandes.component')
                .then((c) => c.RapportDemandesComponent),
            data: {
              permissions: ['REPORT_VIEW']
            }
          },
          {
            path: 'produits',
            loadComponent: () =>
              import('./pages/main-app/rapports/rapport-produits/rapport-produits.component')
                .then((c) => c.RapportProduitsComponent),
            data: {
              permissions: ['REPORT_VIEW']
            }
          },
          {
            path: 'incidents',
            loadComponent: () =>
              import('./pages/main-app/rapports/rapport-incidents/rapport-incidents.component')
                .then((c) => c.RapportIncidentsComponent),
            data: {
              permissions: ['REPORT_VIEW']
            }
          }
        ]
      }
    ],
  },

  
  // Route 404
  {
    path: '**',
    redirectTo: 'app/dashboard'
  }
];