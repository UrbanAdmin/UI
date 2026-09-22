import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  readonly kicker = input.required<string>();
  readonly title = input.required<string>();
  readonly hint = input<string>();
}
