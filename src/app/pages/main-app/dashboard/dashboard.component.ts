// src/app/pages/main-app/dashboard/dashboard.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { DashboardService, DashboardStats, RecentActivities } from '../../../services/dashboard.service';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

// Interface pour les activités fusionnées
interface Activity {
  id: string | number;
  type: 'demande' | 'delivrance' | 'transfusion';
  date: Date;
  title: string;
  details: string;
  status?: string;
  color: string;
  icon: string;
  originalData: any;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatBadgeModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('groupeChart') groupeChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('typeChart') typeChartRef!: ElementRef<HTMLCanvasElement>;
  
  today = new Date();
  loading = true;
  error = false;
  chartsCreated = false;
  
  stats: DashboardStats = {
    produits: {
      total: 0,
      disponibles: 0,
      groupes: [],
      types: []
    },
    demandes: {
      total: 0,
      enAttente: 0,
      validees: 0,
      urgentes: 0
    },
    delivrances: {
      total: 0,
      aujourdhui: 0,
      ceMois: 0
    },
    transfusions: {
      total: 0,
      avecEffets: 0,
      sansEffets: 0,
      tolerance: {
        EXCELLENTE: 0,
        BONNE: 0,
        MOYENNE: 0,
        MAUVAISE: 0
      }
    },
    incidents: {
      total: 0,
      valides: 0,
      nonValides: 0,
      parType: {}
    },
    alertes: {
      produitsPerimes: 0,
      demandesUrgentes: 0,
      produitsCritiques: 0
    }
  };
  
  recentActivities: RecentActivities = {
    dernieresDemandes: [],
    dernieresDelivrances: [],
    dernieresTransfusions: []
  };
  
  showAllActivities = false;
  filteredActivities: Activity[] = [];
  
  private groupeChart: Chart<'doughnut'> | null = null;
  private typeChart: Chart<'bar'> | null = null;
  
  constructor(private dashboardService: DashboardService) {}
  
  ngOnInit() {
    this.loadDashboardData();
  }
  
  ngAfterViewInit() {
    // Les graphiques seront créés après le chargement des données
  }
  
  ngOnDestroy() {
    this.destroyCharts();
  }
  
  loadDashboardData() {
    this.loading = true;
    this.error = false;
    this.chartsCreated = false;
    
    this.dashboardService.getDashboardStats().subscribe({
      next: (data) => {
        console.log('=== DONNÉES DASHBOARD COMPLÈTES ===');
        console.log('Données dashboard reçues:', data);
        console.log('Produits sanguins:', data.produits);
        console.log('Groupes sanguins:', data.produits.groupes);
        console.log('Types de produits:', data.produits.types);
        
        this.stats = data;
        
        // Attendre que la vue soit mise à jour avant de créer les graphiques
        setTimeout(() => {
          this.createCharts();
          this.loadRecentActivities();
          this.loading = false;
        }, 100);
      },
      error: (error) => {
        console.error('Erreur lors du chargement du dashboard:', error);
        this.error = true;
        this.loading = false;
        
        // Créer des données de test en cas d'erreur
        this.createTestData();
      }
    });
  }
  
  loadRecentActivities() {
    this.dashboardService.getRecentActivities().subscribe({
      next: (activities) => {
        this.recentActivities = activities;
        this.updateFilteredActivities();
      },
      error: (error) => {
        console.error('Erreur lors du chargement des activités:', error);
      }
    });
  }
  
  private createCharts() {
    this.destroyCharts();
    
    console.log('Création des graphiques...');
    console.log('Groupe chart ref:', this.groupeChartRef);
    console.log('Type chart ref:', this.typeChartRef);
    console.log('Élément groupeChart:', this.groupeChartRef?.nativeElement);
    console.log('Élément typeChart:', this.typeChartRef?.nativeElement);
    console.log('Données groupes:', this.stats.produits.groupes);
    console.log('Données types:', this.stats.produits.types);
    
    // Attendre un peu plus longtemps si les éléments ne sont pas encore disponibles
    if (!this.groupeChartRef?.nativeElement || !this.typeChartRef?.nativeElement) {
      console.log('Éléments Canvas non disponibles, nouvelle tentative dans 100ms...');
      setTimeout(() => this.createCharts(), 100);
      return;
    }
    
    // Vérifier si les données sont disponibles
    if (!this.stats.produits.groupes || this.stats.produits.groupes.length === 0) {
      console.warn('Aucune donnée pour les groupes sanguins');
      // Ne pas créer de données de test automatiquement, afficher le message vide
      this.renderEmptyCharts();
      return;
    }
    
    if (!this.stats.produits.types || this.stats.produits.types.length === 0) {
      console.warn('Aucune donnée pour les types de produits');
      this.renderEmptyCharts();
      return;
    }
    
    // Créer le graphique des groupes sanguins
    this.createGroupeChart();
    
    // Créer le graphique des types de produits
    this.createTypeChart();
    
    this.chartsCreated = true;
  }
  
  private renderEmptyCharts() {
    // Rendre les canvas vides avec un message
    if (this.groupeChartRef?.nativeElement) {
      this.renderEmptyChartMessage(this.groupeChartRef.nativeElement, 'Aucun produit sanguin disponible');
    }
    if (this.typeChartRef?.nativeElement) {
      this.renderEmptyChartMessage(this.typeChartRef.nativeElement, 'Aucun produit en stock');
    }
  }
  
  private createGroupeChart() {
    try {
      const canvas = this.groupeChartRef.nativeElement;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Impossible d\'obtenir le contexte Canvas pour le graphique des groupes');
        return;
      }
      
      // Nettoyer l'ancien graphique
      if (this.groupeChart) {
        this.groupeChart.destroy();
      }
      
      // Filtrer les groupes avec des données
      const groupes = this.stats.produits.groupes.filter(g => g.count > 0);
      
      if (groupes.length === 0) {
        console.log('Aucune donnée non-nulle pour le graphique des groupes');
        this.renderEmptyChartMessage(canvas, 'Aucun produit sanguin disponible');
        return;
      }
      
      // Préparer les données
      const labels = groupes.map(g => g.groupe);
      const data = groupes.map(g => g.count);
      const backgroundColors = groupes.map(g => g.couleur);
      const borderColors = groupes.map(g => this.adjustColor(g.couleur, -30));
      
      console.log('Création graphique groupes avec données:', { labels, data, backgroundColors });
      
      // Créer le graphique
      this.groupeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 2,
            hoverOffset: 15
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 12,
                padding: 15,
                font: {
                  size: 11
                },
                usePointStyle: true,
                pointStyle: 'circle'
              }
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || '';
                  const value = context.raw as number;
                  const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                  return `${label}: ${value} unités (${percentage}%)`;
                }
              }
            }
          },
          cutout: '65%',
          animation: {
            animateScale: true,
            animateRotate: true
          }
        }
      });
      
      console.log('Graphique des groupes créé avec succès');
    } catch (error) {
      console.error('Erreur lors de la création du graphique des groupes:', error);
    }
  }
  
  private createTypeChart() {
    try {
      const canvas = this.typeChartRef.nativeElement;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        console.error('Impossible d\'obtenir le contexte Canvas pour le graphique des types');
        return;
      }
      
      // Nettoyer l'ancien graphique
      if (this.typeChart) {
        this.typeChart.destroy();
      }
      
      // Filtrer les types avec des données
      const types = this.stats.produits.types.filter(t => t.count > 0);
      
      if (types.length === 0) {
        console.log('Aucune donnée non-nulle pour le graphique des types');
        this.renderEmptyChartMessage(canvas, 'Aucun produit disponible');
        return;
      }
      
      // Préparer les données
      const labels = types.map(t => t.type);
      const data = types.map(t => t.count);
      const backgroundColors = types.map(t => t.couleur);
      const borderColors = types.map(t => this.adjustColor(t.couleur, -30));
      
      console.log('Création graphique types avec données:', { labels, data, backgroundColors });
      
      // Créer le graphique
      this.typeChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{
            label: 'Nombre de produits',
            data: data,
            backgroundColor: backgroundColors,
            borderColor: borderColors,
            borderWidth: 1,
            borderRadius: 6,
            barPercentage: 0.7,
            categoryPercentage: 0.8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1,
                precision: 0,
                callback: function(value) {
                  if (Math.floor(Number(value)) === Number(value)) {
                    return value.toString();
                  }
                  return '';
                }
              },
              grid: {
                color: 'rgba(0, 0, 0, 0.05)'
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                maxRotation: 45,
                minRotation: 0
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  return `${context.dataset.label}: ${context.raw}`;
                }
              }
            }
          },
          animation: {
            duration: 1000,
            easing: 'easeOutQuart'
          }
        }
      });
      
      console.log('Graphique des types créé avec succès');
    } catch (error) {
      console.error('Erreur lors de la création du graphique des types:', error);
    }
  }
  
  private renderEmptyChartMessage(canvas: HTMLCanvasElement, message: string) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Effacer le canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dessiner un cercle gris
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2 - 20, 60, 0, Math.PI * 2);
    ctx.fillStyle = '#f5f5f5';
    ctx.fill();
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Dessiner une icône
    ctx.font = '40px Material Icons';
    ctx.fillStyle = '#bdbdbd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('pie_chart', canvas.width / 2, canvas.height / 2 - 20);
    
    // Ajouter le texte
    ctx.font = '14px Arial';
    ctx.fillStyle = '#757575';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 + 50);
  }
  
  destroyCharts() {
    if (this.groupeChart) {
      this.groupeChart.destroy();
      this.groupeChart = null;
    }
    if (this.typeChart) {
      this.typeChart.destroy();
      this.typeChart = null;
    }
    this.chartsCreated = false;
  }
  
  refreshDashboard() {
    this.loadDashboardData();
  }
  
  toggleActivities() {
    this.showAllActivities = !this.showAllActivities;
    this.updateFilteredActivities();
  }
  
  updateFilteredActivities() {
    // Combine toutes les activités et trie par date
    const allActivities: Activity[] = [];
    
    // Convertir les demandes
    this.recentActivities.dernieresDemandes.forEach(demande => {
      if (demande && demande.id) {
        allActivities.push({
          id: demande.id,
          type: 'demande',
          date: new Date(demande.dateHeureDemande || Date.now()),
          title: `Demande pour ${demande.patientPrenom || ''} ${demande.patientNom || ''}`.trim(),
          details: `${demande.serviceDemandeur || ''} • ${demande.produitsDemandes?.length || 0} produit(s)`,
          status: demande.statut,
          color: 'primary',
          icon: 'description',
          originalData: demande
        });
      }
    });
    
    // Convertir les délivrances
    this.recentActivities.dernieresDelivrances.forEach(delivrance => {
      if (delivrance && delivrance.id) {
        allActivities.push({
          id: delivrance.id,
          type: 'delivrance',
          date: new Date(delivrance.dateHeureDelivrance || Date.now()),
          title: `Délivrance vers ${delivrance.destination || 'destination inconnue'}`,
          details: `${delivrance.produitsSanguins?.length || 0} produit(s)`,
          status: 'DÉLIVRÉ',
          color: 'success',
          icon: 'local_shipping',
          originalData: delivrance
        });
      }
    });
    
    // Convertir les transfusions
    this.recentActivities.dernieresTransfusions.forEach(transfusion => {
      if (transfusion && transfusion.id) {
        allActivities.push({
          id: transfusion.id,
          type: 'transfusion',
          date: new Date(transfusion.dateTransfusion || Date.now()),
          title: `Transfusion de ${transfusion.patientPrenom || ''} ${transfusion.patientNom || ''}`.trim(),
          details: `${transfusion.typeProduit || ''} • Groupe ${transfusion.groupeSanguin || ''}`,
          status: transfusion.tolerance,
          color: 'warn',
          icon: 'healing',
          originalData: transfusion
        });
      }
    });
    
    // Trier par date (plus récent en premier)
    allActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    this.filteredActivities = this.showAllActivities ? allActivities : allActivities.slice(0, 6);
  }
  
  dismissAlerts() {
    this.stats.alertes = {
      produitsPerimes: 0,
      demandesUrgentes: 0,
      produitsCritiques: 0
    };
    // Sauvegarder dans localStorage pour ne pas réafficher pendant 24h
    localStorage.setItem('dashboardAlertsDismissed', new Date().toISOString());
  }
  
  getActivitiesToShow(): Activity[] {
    return this.filteredActivities;
  }
  
  getIncidentsByType(): Array<{name: string, count: number}> {
    if (!this.stats.incidents.parType || Object.keys(this.stats.incidents.parType).length === 0) {
      return [];
    }
    
    return Object.entries(this.stats.incidents.parType)
      .map(([name, count]) => ({
        name: this.formatIncidentTypeName(name),
        count: count as number
      }))
      .sort((a, b) => b.count - a.count);
  }
  
  formatIncidentTypeName(name: string): string {
    const mapping: {[key: string]: string} = {
      'SANG': 'Sang total',
      'SANG_TOTAL': 'Sang total',
      'PLASMA': 'Plasma',
      'PLAQUETTES': 'Plaquettes',
      'GLOBULES_ROUGES': 'Globules rouges',
      'GLOBULES': 'Globules rouges'
    };
    
    return mapping[name] || name.replace(/_/g, ' ');
  }
  
  getStatusClass(status?: string): string {
    if (!status) return 'bg-secondary';
    
    const statut = status.toString().toUpperCase();
    if (statut.includes('VALID') || statut.includes('APPROUV') || statut.includes('DÉLIVRÉ')) return 'bg-success';
    if (statut.includes('ATTENTE') || statut.includes('EN_COURS') || statut.includes('PENDING')) return 'bg-warning';
    if (statut.includes('REJET') || statut.includes('REFUS') || statut.includes('REJECTED')) return 'bg-danger';
    if (statut.includes('TERMIN') || statut.includes('COMPLET') || statut.includes('FINISHED')) return 'bg-info';
    return 'bg-secondary';
  }
  
  getStatusText(status?: string): string {
    if (!status) return 'Inconnu';
    
    const statut = status.toString().toUpperCase();
    if (statut.includes('VALID') || statut.includes('APPROUV')) return 'Validée';
    if (statut.includes('DÉLIVRÉ') || statut.includes('DELIVERED')) return 'Délivré';
    if (statut.includes('ATTENTE') || statut.includes('PENDING')) return 'En attente';
    if (statut.includes('REJET') || statut.includes('REFUS') || statut.includes('REJECTED')) return 'Rejetée';
    if (statut.includes('EN_COURS') || statut.includes('IN_PROGRESS')) return 'En cours';
    if (statut.includes('TERMIN') || statut.includes('COMPLET') || statut.includes('FINISHED')) return 'Terminée';
    return status;
  }
  
  getToleranceClass(tolerance?: string): string {
    if (!tolerance) return 'bg-secondary';
    
    const tol = tolerance.toString().toUpperCase();
    if (tol.includes('EXCELLENT')) return 'bg-success';
    if (tol.includes('BONNE') || tol.includes('GOOD')) return 'bg-info';
    if (tol.includes('MOYENNE') || tol.includes('MEDIUM') || tol.includes('AVERAGE')) return 'bg-warning';
    if (tol.includes('MAUVAISE') || tol.includes('BAD') || tol.includes('POOR')) return 'bg-danger';
    return 'bg-secondary';
  }
  
  formatDate(dateString?: string | null): string {
    if (!dateString || dateString.trim() === '') return 'N/A';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const timeOptions: Intl.DateTimeFormatOptions = { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      };
      
      // Si c'est aujourd'hui
      if (date.toDateString() === today.toDateString()) {
        return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', timeOptions)}`;
      }
      
      // Si c'était hier
      if (date.toDateString() === yesterday.toDateString()) {
        return `Hier à ${date.toLocaleTimeString('fr-FR', timeOptions)}`;
      }
      
      // Si c'était il y a moins de 7 jours
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays < 7) {
        return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
      }
      
      // Si c'était cette année
      if (date.getFullYear() === now.getFullYear()) {
        return date.toLocaleDateString('fr-FR', { 
          day: '2-digit', 
          month: 'short'
        });
      }
      
      // Sinon, afficher la date complète
      return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Erreur de formatage de date:', error, dateString);
      return dateString;
    }
  }
  
  getProgressValue(): number {
    const total = this.stats.produits.total;
    const disponibles = this.stats.produits.disponibles;
    return total > 0 ? Math.round((disponibles / total) * 100) : 0;
  }
  
  getContrastColor(hexColor: string): string {
    if (!hexColor || !hexColor.startsWith('#')) return '#000000';
    
    try {
      // Convertir hex en RGB
      const hex = hexColor.replace('#', '');
      
      let r: number, g: number, b: number;
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      } else {
        return '#000000';
      }
      
      // Calculer la luminance relative
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      // Retourner noir ou blanc selon la luminance
      return luminance > 0.5 ? '#000000' : '#FFFFFF';
    } catch (error) {
      return '#000000';
    }
  }
  
  private adjustColor(color: string, amount: number): string {
    if (!color || !color.startsWith('#')) return color || '#cccccc';
    
    try {
      const hex = color.replace('#', '');
      if (hex.length !== 3 && hex.length !== 6) return color;
      
      let r: number, g: number, b: number;
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      }
      
      r = Math.max(0, Math.min(255, r + amount));
      g = Math.max(0, Math.min(255, g + amount));
      b = Math.max(0, Math.min(255, b + amount));
      
      return `rgb(${r}, ${g}, ${b})`;
    } catch (error) {
      return color;
    }
  }
  
  // Méthode de débogage
  debugData() {
    console.log('=== DÉBOGAGE GRAPHIQUES ===');
    console.log('GroupeChartRef:', this.groupeChartRef);
    console.log('TypeChartRef:', this.typeChartRef);
    console.log('Stats produits:', this.stats.produits);
    console.log('Groupes sanguins:', this.stats.produits.groupes);
    console.log('Types produits:', this.stats.produits.types);
    console.log('Graphique groupes créé:', !!this.groupeChart);
    console.log('Graphique types créé:', !!this.typeChart);
    console.log('Charts créés:', this.chartsCreated);
    
    // Tester avec des données factices
    if (this.stats.produits.total === 0 || this.stats.produits.groupes.every(g => g.count === 0)) {
      console.log('Données vides, utilisation de données de test');
      this.createTestData();
    }
  }
  
  private createTestData() {
    console.log('Création de données de test...');
    
    // Données de test pour le débogage
    this.stats.produits = {
      total: 45,
      disponibles: 38,
      groupes: [
        { groupe: 'A+', count: 12, couleur: '#dc3545' },
        { groupe: 'B+', count: 8, couleur: '#0d6efd' },
        { groupe: 'AB+', count: 4, couleur: '#198754' },
        { groupe: 'O+', count: 10, couleur: '#ffc107' },
        { groupe: 'A-', count: 3, couleur: '#6610f2' },
        { groupe: 'B-', count: 2, couleur: '#20c997' },
        { groupe: 'AB-', count: 1, couleur: '#fd7e14' },
        { groupe: 'O-', count: 5, couleur: '#6f42c1' }
      ],
      types: [
        { type: 'Sang total', count: 20, icon: 'bloodtype', couleur: '#dc3545' },
        { type: 'Plasma', count: 12, icon: 'water_drop', couleur: '#0d6efd' },
        { type: 'Plaquettes', count: 8, icon: 'pie_chart', couleur: '#198754' },
        { type: 'Globules rouges', count: 5, icon: 'circle', couleur: '#ffc107' }
      ]
    };
    
    console.log('Données de test créées:', this.stats.produits);
    
    // Recréer les graphiques avec les données de test
    setTimeout(() => {
      console.log('Tentative de création des graphiques avec données de test...');
      console.log('Éléments disponibles:', {
        groupeChart: !!this.groupeChartRef?.nativeElement,
        typeChart: !!this.typeChartRef?.nativeElement
      });
      this.createCharts();
    }, 500);
  }
  
  // Méthode pour forcer la recréation des graphiques
  recreateCharts() {
    console.log('Recréation des graphiques...');
    this.destroyCharts();
    setTimeout(() => {
      this.createCharts();
    }, 300);
  }
  
  // Calculer la somme des groupes sanguins
  getGroupesTotal(): number {
    return this.stats.produits.groupes.reduce((sum, groupe) => sum + groupe.count, 0);
  }
  
  // Calculer la somme des types de produits
  getTypesTotal(): number {
    return this.stats.produits.types.reduce((sum, type) => sum + type.count, 0);
  }
  
  // Vérifier si les graphiques doivent afficher un message vide
  shouldShowEmptyChart(type: 'groupes' | 'types'): boolean {
    if (type === 'groupes') {
      return !this.stats.produits.groupes || 
             this.stats.produits.groupes.length === 0 || 
             this.getGroupesTotal() === 0;
    } else {
      return !this.stats.produits.types || 
             this.stats.produits.types.length === 0 || 
             this.getTypesTotal() === 0;
    }
  }

  
}