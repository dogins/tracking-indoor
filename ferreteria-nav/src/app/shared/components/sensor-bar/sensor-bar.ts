import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-sensor-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'class': 'sensor-bar',
  },
  imports: [DecimalPipe],
  templateUrl: './sensor-bar.html',
  styleUrl: './sensor-bar.scss',
})
export class SensorBarComponent {
  steps = input(0);
  heading = input(0);
  distanceM = input(0);
  driftM = input(0);
}
