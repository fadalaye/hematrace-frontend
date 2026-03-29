// components/utilisateurs/components/user-type-selector/user-type-selector.component.ts
import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-user-type-selector',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="p-4">
      <h2 mat-dialog-title class="mb-3 text-center">Créer un nouvel utilisateur</h2>
      
      <div mat-dialog-content>
        <p class="text-muted mb-4 text-center">Sélectionnez le type d'utilisateur à créer :</p>
        
        <div class="row g-3">
          <div class="col-6" *ngFor="let type of userTypes">
            <button 
              class="card h-100 w-100 border-0 text-start p-3 user-type-card"
              (click)="selectType(type.value)"
              [class.selected]="selectedType === type.value"
              [class]="selectedType === type.value ? type.borderColor : ''">
              <div class="card-body p-0 text-center">
                <mat-icon class="display-6 mb-2" [class]="type.color">{{ type.icon }}</mat-icon>
                <h6 class="card-title fw-medium mb-1">{{ type.label }}</h6>
                <small class="text-muted">{{ type.description }}</small>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div mat-dialog-actions class="justify-content-end gap-2 mt-4">
        <button mat-stroked-button (click)="cancel()">Annuler</button>
        <button mat-raised-button color="primary" 
                [disabled]="!selectedType"
                (click)="confirm()">
          <mat-icon>arrow_forward</mat-icon>
          Continuer
        </button>
      </div>
    </div>
  `,
  styles: [`
    .user-type-card {
      transition: all 0.3s ease;
      cursor: pointer;
      border: 2px solid transparent !important;
    }
    .user-type-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    }
    .user-type-card.selected {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .border-primary { border-color: #3f51b5 !important; background-color: #f5f7ff; }
    .border-info { border-color: #17a2b8 !important; background-color: #f0f9ff; }
    .border-warning { border-color: #ffc107 !important; background-color: #fffbf0; }
    .border-danger { border-color: #dc3545 !important; background-color: #fff5f5; }
  `]
})
export class UserTypeSelectorComponent {
  selectedType: string = '';

  userTypes = [
    { 
      value: 'MEDECIN', 
      label: 'Médecin', 
      icon: 'local_hospital',
      color: 'text-primary',
      borderColor: 'border-primary',
      description: 'Personnel médical avec spécialité'
    },
    { 
      value: 'PERSONNEL', 
      label: 'Personnel', 
      icon: 'badge',
      color: 'text-info',
      borderColor: 'border-info',
      description: 'Staff administratif et support'
    },
    { 
      value: 'CHEF_SERVICE', 
      label: 'Chef de Service', 
      icon: 'supervisor_account',
      color: 'text-warning',
      borderColor: 'border-warning',
      description: 'Responsable de département'
    },
    { 
      value: 'ADMIN', 
      label: 'Administrateur', 
      icon: 'admin_panel_settings',
      color: 'text-danger',
      borderColor: 'border-danger',
      description: 'Accès complet au système'
    }
  ];

  constructor(private dialogRef: MatDialogRef<UserTypeSelectorComponent>) {}

  selectType(type: string) {
    this.selectedType = type;
  }

  confirm() {
    this.dialogRef.close(this.selectedType);
  }

  cancel() {
    this.dialogRef.close();
  }
}