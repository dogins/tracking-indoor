import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StoreMapService } from '../../core/services/store-map';
import { NavigationService } from '../../core/services/navigation';
import { PedometerService } from '../../core/services/pedometer';
import { TopbarComponent } from '../../shared/components/topbar/topbar';
import { Zone } from '../../core/models/zone.model';
import { take } from 'rxjs';

@Component({
  selector: 'app-scan-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, TopbarComponent],
  templateUrl: './scan.html',
  styleUrl: './scan.scss',
})
export class ScanComponent {
  private readonly storeMapService = inject(StoreMapService);
  private readonly navigationService = inject(NavigationService);
  private readonly pedometerService = inject(PedometerService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly zones$ = this.storeMapService.zones$;
  readonly permissionError = signal('');

  constructor() {
    const query = new URLSearchParams(window.location.hash.split('?')[1] ?? window.location.search).get('q');
    if (query) {
      this.storeMapService.zones$.pipe(take(1), takeUntilDestroyed(this.destroyRef)).subscribe((zones) => {
        const zone = zones.find((entry) => entry.id === query);
        if (zone) {
          this.navigationService.setZone(zone.id);
          this.router.navigateByUrl('/map');
        }
      });
    }
  }

  async selectZone(zone: Zone): Promise<void> {
    const granted = await this.pedometerService.requestPermission();
    if (!granted && this.pedometerService.isSupported()) {
      this.permissionError.set('Permiso de sensores no otorgado. Puedes continuar en modo QR.');
    } else {
      this.permissionError.set('');
      this.pedometerService.startListening();
    }

    this.navigationService.setZone(zone.id);
    this.router.navigateByUrl('/map');
  }
}
