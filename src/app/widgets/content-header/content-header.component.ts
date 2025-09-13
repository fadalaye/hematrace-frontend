import { Component, input } from '@angular/core';
import { RouterLinkActive, RouterLink } from '@angular/router';

@Component({
  selector: 'app-content-header',
  imports: [RouterLinkActive, RouterLink],
  templateUrl: './content-header.component.html',
  styleUrl: './content-header.component.scss'
})
export class ContentHeaderComponent {
  readonly title = input.required<string>();
  readonly subRoute = input.required<string>();
  readonly route = input<string>();
  lastRoute = input<boolean>(false);
  lastRouteName = input<string>();

}
