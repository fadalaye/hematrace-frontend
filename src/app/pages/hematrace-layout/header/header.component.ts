import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HeaderOptionsListComponent } from "./header-options-list/header-options-list.component";

@Component({
  selector: 'app-header',
  imports: [RouterLink, HeaderOptionsListComponent],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss'
})
export class HeaderComponent {
  toggleSidebar() {
    document.body.classList.toggle('sidebar-collapse');
    document.body.classList.toggle('sidebar-open');
  }
}
