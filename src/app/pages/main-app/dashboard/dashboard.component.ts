import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  DashboardAlert,
  DashboardOverview,
  DashboardRecentActivities,
  DashboardRecentActivity,
  DashboardService,
  DashboardStats,
  DashboardTrends
} from '../../../services/dashboard.service';
import { BaseChartDirective } from 'ng2-charts';
import { Chart, registerables, ChartData, ChartOptions } from 'chart.js';

Chart.register(...registerables);

type DashboardPeriod = 7 | 15 | 30;
type ActivityFilter = 'ALL' | 'DEMANDE' | 'DÉLIVRANCE' | 'TRANSFUSION';

interface DashboardKpiCard {
  title: string;
  value: number | string;
  subtitle: string;
  icon: string;
  colorClass: string;
  route: string;
  queryParams?: Record<string, string | number | boolean>;
}

interface DashboardQuickMetric {
  label: string;
  value: number | string;
  helper: string;
  state: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  icon: string;
}

interface DashboardShortcut {
  title: string;
  subtitle: string;
  icon: string;
  route: string;
  colorClass: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, BaseChartDirective, DatePipe, DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  loading = true;
  errorMessage = '';

  overview: DashboardOverview | null = null;
  recentActivities: DashboardRecentActivities | null = null;
  trends: DashboardTrends | null = null;

  selectedPeriod: DashboardPeriod = 7;
  selectedActivityFilter: ActivityFilter = 'ALL';
  lastRefresh: Date | null = null;

  heroStats: DashboardQuickMetric[] = [];
  mainKpis: DashboardKpiCard[] = [];
  operationalMetrics: DashboardQuickMetric[] = [];
  quickShortcuts: DashboardShortcut[] = [];

  allRecentActivities: DashboardRecentActivity[] = [];
  filteredRecentActivities: DashboardRecentActivity[] = [];

  stockByGroupChartData: ChartData<'doughnut'> = {
    labels: [],
    datasets: [
      {
        data: [],
        backgroundColor: [
          '#2563eb',
          '#14b8a6',
          '#f59e0b',
          '#ef4444',
          '#8b5cf6',
          '#06b6d4',
          '#84cc16',
          '#f97316'
        ],
        borderWidth: 0,
        hoverOffset: 8
      }
    ]
  };

  stockByTypeChartData: ChartData<'bar'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Total',
        backgroundColor: '#2563eb',
        borderRadius: 10,
        barThickness: 22
      },
      {
        data: [],
        label: 'Disponibles',
        backgroundColor: '#14b8a6',
        borderRadius: 10,
        barThickness: 22
      }
    ]
  };

  trendsChartData: ChartData<'line'> = {
    labels: [],
    datasets: [
      {
        data: [],
        label: 'Demandes',
        tension: 0.35,
        fill: false,
        borderColor: '#2563eb',
        backgroundColor: '#2563eb',
        pointRadius: 3,
        pointHoverRadius: 5
      },
      {
        data: [],
        label: 'Délivrances',
        tension: 0.35,
        fill: false,
        borderColor: '#14b8a6',
        backgroundColor: '#14b8a6',
        pointRadius: 3,
        pointHoverRadius: 5
      },
      {
        data: [],
        label: 'Transfusions',
        tension: 0.35,
        fill: false,
        borderColor: '#f59e0b',
        backgroundColor: '#f59e0b',
        pointRadius: 3,
        pointHoverRadius: 5
      },
      {
        data: [],
        label: 'Incidents',
        tension: 0.35,
        fill: false,
        borderColor: '#ef4444',
        backgroundColor: '#ef4444',
        pointRadius: 3,
        pointHoverRadius: 5
      }
    ]
  };

  doughnutOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    animation: {
      duration: 700
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 18
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.label}: ${context.raw} unité(s)`
        }
      }
    }
  };

  barOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 700
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 18
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.raw}`
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          maxRotation: 0
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.15)'
        }
      }
    }
  };

  lineOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800
    },
    interaction: {
      mode: 'index',
      intersect: false
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 18
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.raw}`
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        },
        grid: {
          color: 'rgba(148, 163, 184, 0.15)'
        }
      }
    }
  };

  constructor(
    private dashboardService: DashboardService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.buildQuickShortcuts();
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      overview: this.dashboardService.getOverview(),
      recentActivities: this.dashboardService.getRecentActivities(10),
      trends: this.dashboardService.getTrends(this.selectedPeriod)
    }).subscribe({
      next: ({ overview, recentActivities, trends }) => {
        this.overview = overview;
        this.recentActivities = recentActivities;
        this.trends = trends;
        this.lastRefresh = new Date();

        this.buildHeroStats(overview.stats);
        this.buildKpis(overview.stats);
        this.buildOperationalMetrics(overview.stats);
        this.buildCharts();
        this.buildRecentActivities();

        this.loading = false;
      },
      error: (error) => {
        console.error('Erreur de chargement du dashboard:', error);
        this.errorMessage = 'Impossible de charger les données du tableau de bord.';
        this.loading = false;
      }
    });
  }

  onPeriodChange(period: DashboardPeriod): void {
    if (this.selectedPeriod === period) {
      return;
    }
    this.selectedPeriod = period;
    this.loadDashboard();
  }

  onActivityFilterChange(filter: ActivityFilter): void {
    this.selectedActivityFilter = filter;
    this.applyActivityFilter();
  }

  goToRoute(route: string, queryParams?: Record<string, string | number | boolean>): void {
    this.router.navigate([route], { queryParams });
  }

  openKpi(card: DashboardKpiCard): void {
    this.goToRoute(card.route, card.queryParams);
  }

  private buildQuickShortcuts(): void {
    this.quickShortcuts = [
      {
        title: 'Produits',
        subtitle: 'Consulter le stock',
        icon: 'fas fa-vials',
        route: '/app/produits-sanguins',
        colorClass: 'shortcut-primary'
      },
      {
        title: 'Demandes',
        subtitle: 'Suivre les demandes',
        icon: 'fas fa-file-medical',
        route: '/app/demandes',
        colorClass: 'shortcut-info'
      },
      {
        title: 'Délivrances',
        subtitle: 'Voir les délivrances',
        icon: 'fas fa-truck-loading',
        route: '/app/delivrances',
        colorClass: 'shortcut-success'
      },
      {
        title: 'Transfusions',
        subtitle: 'Historique des actes',
        icon: 'fas fa-heartbeat',
        route: '/app/transfusions',
        colorClass: 'shortcut-warning'
      },
      {
        title: 'Incidents',
        subtitle: 'Déclarations et suivi',
        icon: 'fas fa-triangle-exclamation',
        route: '/app/incidents',
        colorClass: 'shortcut-danger'
      },
      {
        title: 'Rapports',
        subtitle: 'Exports et statistiques',
        icon: 'fas fa-chart-column',
        route: '/app/rapports',
        colorClass: 'shortcut-secondary'
      }
    ];
  }

  private buildHeroStats(stats: DashboardStats): void {
    this.heroStats = [
      {
        label: 'Stock total',
        value: stats.totalProduits,
        helper: 'Produits enregistrés',
        state: 'info',
        icon: 'fas fa-database'
      },
      {
        label: 'Disponibles',
        value: stats.produitsDisponibles,
        helper: 'Prêts à être délivrés',
        state: 'success',
        icon: 'fas fa-box-open'
      },
      {
        label: 'Urgences',
        value: stats.demandesUrgentes,
        helper: 'Demandes prioritaires',
        state: stats.demandesUrgentes > 0 ? 'warning' : 'neutral',
        icon: 'fas fa-bell'
      },
      {
        label: 'Incidents',
        value: stats.totalIncidents,
        helper: 'Signalements cumulés',
        state: stats.totalIncidents > 0 ? 'danger' : 'neutral',
        icon: 'fas fa-triangle-exclamation'
      }
    ];
  }

  private buildKpis(stats: DashboardStats): void {
    this.mainKpis = [
      {
        title: 'Produits totaux',
        value: stats.totalProduits,
        subtitle: 'Volume global du stock',
        icon: 'fas fa-tint',
        colorClass: 'kpi-primary',
        route: '/app/produits-sanguins'
      },
      {
        title: 'Disponibles',
        value: stats.produitsDisponibles,
        subtitle: 'Produits immédiatement utilisables',
        icon: 'fas fa-box-open',
        colorClass: 'kpi-success',
        route: '/app/produits-sanguins',
        queryParams: { etat: 'DISPONIBLE' }
      },
      {
        title: 'Délivrés',
        value: stats.produitsDelivres,
        subtitle: 'Produits sortis du stock',
        icon: 'fas fa-shipping-fast',
        colorClass: 'kpi-info',
        route: '/app/delivrances'
      },
      {
        title: 'Utilisés',
        value: stats.produitsUtilises,
        subtitle: 'Produits transfusés',
        icon: 'fas fa-syringe',
        colorClass: 'kpi-dark',
        route: '/app/transfusions'
      },
      {
        title: 'Expirés',
        value: stats.produitsExpires,
        subtitle: 'Produits périmés',
        icon: 'fas fa-exclamation-triangle',
        colorClass: 'kpi-danger',
        route: '/app/produits-sanguins',
        queryParams: { etat: 'EXPIRÉ' }
      },
      {
        title: 'Demandes urgentes',
        value: stats.demandesUrgentes,
        subtitle: 'Nécessitent une action rapide',
        icon: 'fas fa-bell',
        colorClass: 'kpi-warning',
        route: '/app/demandes',
        queryParams: { urgence: true }
      },
      {
        title: 'Délivrances',
        value: stats.totalDelivrances,
        subtitle: 'Total des délivrances',
        icon: 'fas fa-truck-loading',
        colorClass: 'kpi-secondary',
        route: '/app/delivrances'
      },
      {
        title: 'Transfusions',
        value: stats.totalTransfusions,
        subtitle: 'Total des actes transfusionnels',
        icon: 'fas fa-heartbeat',
        colorClass: 'kpi-primary',
        route: '/app/transfusions'
      }
    ];
  }

  private buildOperationalMetrics(stats: DashboardStats): void {
    const tauxUtilisation = this.safePercentValue(stats.produitsUtilises, stats.totalProduits);
    const tauxPerte = this.safePercentValue(stats.produitsExpires, stats.totalProduits);
    const tauxDisponibilite = this.safePercentValue(stats.produitsDisponibles, stats.totalProduits);
    const tauxEffetsIndesirables = this.safePercentValue(stats.transfusionsAvecEffets, stats.totalTransfusions);
    const tauxValidationIncidents = this.safePercentValue(stats.incidentsValides, stats.totalIncidents);
    const tauxSatisfactionDemandes = this.safePercentValue(stats.demandesDelivrees, stats.totalDemandes);

    this.operationalMetrics = [
      {
        label: 'Taux de disponibilité',
        value: `${tauxDisponibilite.toFixed(1)}%`,
        helper: 'Produits disponibles / stock total',
        state: tauxDisponibilite >= 60 ? 'success' : tauxDisponibilite >= 35 ? 'warning' : 'danger',
        icon: 'fas fa-warehouse'
      },
      {
        label: 'Taux d’utilisation',
        value: `${tauxUtilisation.toFixed(1)}%`,
        helper: 'Produits utilisés / stock total',
        state: 'info',
        icon: 'fas fa-chart-line'
      },
      {
        label: 'Taux de perte',
        value: `${tauxPerte.toFixed(1)}%`,
        helper: 'Produits expirés / stock total',
        state: tauxPerte < 5 ? 'success' : tauxPerte < 12 ? 'warning' : 'danger',
        icon: 'fas fa-trash-alt'
      },
      {
        label: 'Effets indésirables',
        value: `${tauxEffetsIndesirables.toFixed(1)}%`,
        helper: 'Transfusions avec effets / total',
        state: tauxEffetsIndesirables === 0 ? 'success' : tauxEffetsIndesirables < 10 ? 'warning' : 'danger',
        icon: 'fas fa-notes-medical'
      },
      {
        label: 'Validation incidents',
        value: `${tauxValidationIncidents.toFixed(1)}%`,
        helper: 'Incidents validés / total incidents',
        state: tauxValidationIncidents >= 70 ? 'success' : tauxValidationIncidents > 0 ? 'warning' : 'neutral',
        icon: 'fas fa-check-circle'
      },
      {
        label: 'Satisfaction demandes',
        value: `${tauxSatisfactionDemandes.toFixed(1)}%`,
        helper: 'Demandes délivrées / total demandes',
        state: tauxSatisfactionDemandes >= 70 ? 'success' : tauxSatisfactionDemandes >= 40 ? 'warning' : 'danger',
        icon: 'fas fa-clipboard-check'
      }
    ];
  }

  private buildCharts(): void {
    if (!this.overview || !this.trends) {
      return;
    }

    this.stockByGroupChartData = {
      labels: this.overview.stockParGroupe.map(item => item.groupe),
      datasets: [
        {
          data: this.overview.stockParGroupe.map(item => item.total),
          backgroundColor: [
            '#2563eb',
            '#14b8a6',
            '#f59e0b',
            '#ef4444',
            '#8b5cf6',
            '#06b6d4',
            '#84cc16',
            '#f97316'
          ],
          borderWidth: 0,
          hoverOffset: 8
        }
      ]
    };

    this.stockByTypeChartData = {
      labels: this.overview.stockParType.map(item => item.type),
      datasets: [
        {
          data: this.overview.stockParType.map(item => item.total),
          label: 'Total',
          backgroundColor: '#2563eb',
          borderRadius: 10,
          barThickness: 22
        },
        {
          data: this.overview.stockParType.map(item => item.disponibles),
          label: 'Disponibles',
          backgroundColor: '#14b8a6',
          borderRadius: 10,
          barThickness: 22
        }
      ]
    };

    this.trendsChartData = {
      labels: this.trends.points.map(point => this.formatTrendLabel(point.label)),
      datasets: [
        {
          data: this.trends.points.map(point => point.demandes),
          label: 'Demandes',
          tension: 0.35,
          fill: false,
          borderColor: '#2563eb',
          backgroundColor: '#2563eb',
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          data: this.trends.points.map(point => point.delivrances),
          label: 'Délivrances',
          tension: 0.35,
          fill: false,
          borderColor: '#14b8a6',
          backgroundColor: '#14b8a6',
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          data: this.trends.points.map(point => point.transfusions),
          label: 'Transfusions',
          tension: 0.35,
          fill: false,
          borderColor: '#f59e0b',
          backgroundColor: '#f59e0b',
          pointRadius: 3,
          pointHoverRadius: 5
        },
        {
          data: this.trends.points.map(point => point.incidents),
          label: 'Incidents',
          tension: 0.35,
          fill: false,
          borderColor: '#ef4444',
          backgroundColor: '#ef4444',
          pointRadius: 3,
          pointHoverRadius: 5
        }
      ]
    };
  }

  private buildRecentActivities(): void {
    if (!this.recentActivities) {
      this.allRecentActivities = [];
      this.filteredRecentActivities = [];
      return;
    }

    this.allRecentActivities = [
      ...this.recentActivities.dernieresDemandes,
      ...this.recentActivities.dernieresDelivrances,
      ...this.recentActivities.dernieresTransfusions
    ].sort((a, b) => new Date(b.dateHeure).getTime() - new Date(a.dateHeure).getTime());

    this.applyActivityFilter();
  }

  private applyActivityFilter(): void {
    if (this.selectedActivityFilter === 'ALL') {
      this.filteredRecentActivities = [...this.allRecentActivities];
      return;
    }

    this.filteredRecentActivities = this.allRecentActivities.filter(
      activity => activity.type === this.selectedActivityFilter
    );
  }

  getAlertClass(alert: DashboardAlert): string {
    switch (alert.niveau) {
      case 'DANGER':
        return 'alert-danger-soft';
      case 'WARNING':
        return 'alert-warning-soft';
      default:
        return 'alert-info-soft';
    }
  }

  getMetricClass(state: string): string {
    switch (state) {
      case 'success':
        return 'metric-success';
      case 'warning':
        return 'metric-warning';
      case 'danger':
        return 'metric-danger';
      case 'info':
        return 'metric-info';
      default:
        return 'metric-neutral';
    }
  }

  getActivityBadgeClass(type: string): string {
    switch (type) {
      case 'DEMANDE':
        return 'badge-soft badge-soft-primary';
      case 'DÉLIVRANCE':
        return 'badge-soft badge-soft-info';
      case 'TRANSFUSION':
        return 'badge-soft badge-soft-success';
      default:
        return 'badge-soft badge-soft-secondary';
    }
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'DEMANDE':
        return 'fas fa-file-medical';
      case 'DÉLIVRANCE':
        return 'fas fa-truck-loading';
      case 'TRANSFUSION':
        return 'fas fa-heartbeat';
      default:
        return 'fas fa-circle';
    }
  }

  getActivityTypeLabel(filter: ActivityFilter): string {
    switch (filter) {
      case 'DEMANDE':
        return 'Demandes';
      case 'DÉLIVRANCE':
        return 'Délivrances';
      case 'TRANSFUSION':
        return 'Transfusions';
      default:
        return 'Toutes';
    }
  }

  trackByActivity(index: number, item: DashboardRecentActivity): number {
    return item.id;
  }

  trackByKpi(index: number, item: DashboardKpiCard): string {
    return item.title;
  }

  trackByShortcut(index: number, item: DashboardShortcut): string {
    return item.title;
  }

  private safePercentValue(value: number, total: number): number {
    if (!total || total <= 0) {
      return 0;
    }
    return (value / total) * 100;
  }

  private formatTrendLabel(label: string): string {
    const date = new Date(label);
    if (Number.isNaN(date.getTime())) {
      return label;
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit'
    }).format(date);
  }
}