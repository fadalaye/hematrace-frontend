import { Component, signal } from '@angular/core';
import { OverlayscrollbarsModule } from 'overlayscrollbars-ngx';
import { MenuItem } from '../../../interfaces/menu-item.interface';
import { MENU_ITEMS } from '../../../constants/menu.constants';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  imports: [OverlayscrollbarsModule, RouterLink, RouterLinkActive, NgClass],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  menuItems = signal<MenuItem[]>(MENU_ITEMS);
  activeMenu = signal<string | null>(null);
  toggleMenu(label: string | undefined) {
    this.activeMenu.set(this.activeMenu() === label ? null : label ?? '');
  }

}
