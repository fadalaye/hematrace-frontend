import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-rapports',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './rapports.component.html',
  styleUrl: './rapports.component.scss'
})
export class RapportsComponent {
  cards = [
    {
      title: 'Rapport des demandes',
      description: 'Consulter les demandes par période, statut, service et médecin.',
      icon: 'assignment',
      route: '/app/rapports/demandes'
    },
    {
      title: 'Rapport des produits',
      description: 'Analyser les produits sanguins par type, groupe et état.',
      icon: 'inventory_2',
      route: '/app/rapports/produits'
    },
    {
      title: 'Rapport des incidents',
      description: 'Suivre les incidents transfusionnels par gravité et évolution.',
      icon: 'warning',
      route: '/app/rapports/incidents'
    }
  ];
}