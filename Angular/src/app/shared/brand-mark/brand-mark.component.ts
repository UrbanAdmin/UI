import { Component, ChangeDetectionStrategy, input } from '@angular/core';

/** The real UrbanAdmin app icon (018-app-icon): three stacked rounded bars,
 *  flush left, widening top to bottom, on a sage ground - see
 *  Mobile/UrbanAdmin.Tenant.Mobile/Resources/AppIcon/appicon(fg).svg, whose
 *  exact rect geometry this reproduces rather than approximating it. */
@Component({
  selector: 'app-brand-mark',
  standalone: true,
  templateUrl: './brand-mark.component.html',
  styleUrl: './brand-mark.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandMarkComponent {
  readonly size = input<number>(34);
}
