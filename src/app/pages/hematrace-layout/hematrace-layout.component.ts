import { Component } from '@angular/core';
import { HeaderComponent } from "./header/header.component";
import { SidebarComponent } from "./sidebar/sidebar.component";
import { RouterOutlet } from "@angular/router";
import { FooterComponent } from "./footer/footer.component"; 

@Component({
  selector: 'app-hematrace-layout',
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, FooterComponent],
  templateUrl: './hematrace-layout.component.html',
  styleUrls: ['./hematrace-layout.component.scss']
})
export class HematraceLayoutComponent {

}
