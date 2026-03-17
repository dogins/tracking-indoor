import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'topbar',
  },
  imports: [],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class TopbarComponent {
  title = input.required<string>();
  subtitle = input('NAVEGACIÓN INDOOR');
  backLabel = input('Volver');
  showBack = input(false);

  back = output<void>();

  onBackClick(): void {
    this.back.emit();
  }
}
