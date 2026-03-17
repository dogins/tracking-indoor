import { Injectable, inject } from '@angular/core';
import { NavigationService } from './navigation';

@Injectable({
  providedIn: 'root',
})
export class PedometerService {
  private readonly navigationService = inject(NavigationService);

  private listening = false;
  private lastStepAt = 0;
  private readonly threshold = 2.5;
  private readonly cooldownMs = 350;

  private motionHandler = (event: DeviceMotionEvent) => {
    const ax = event.accelerationIncludingGravity?.x ?? 0;
    const ay = event.accelerationIncludingGravity?.y ?? 0;
    const az = event.accelerationIncludingGravity?.z ?? 0;
    const magnitude = Math.sqrt(ax ** 2 + ay ** 2 + az ** 2);
    const delta = Math.abs(magnitude - 9.81);
    const now = Date.now();

    if (delta > this.threshold && now - this.lastStepAt > this.cooldownMs) {
      this.lastStepAt = now;
      this.navigationService.registerStep();
    }
  };

  private orientationHandler = (event: DeviceOrientationEvent) => {
    if (typeof event.alpha === 'number') {
      this.navigationService.setHeading(event.alpha);
    }
  };

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    const needsPermissionRequest = typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function';

    if (!needsPermissionRequest) {
      return true;
    }

    try {
      const status = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  startListening(): void {
    if (this.listening || !this.isSupported()) {
      return;
    }

    window.addEventListener('devicemotion', this.motionHandler);
    window.addEventListener('deviceorientation', this.orientationHandler);
    this.listening = true;
  }

  stopListening(): void {
    if (!this.listening) {
      return;
    }

    window.removeEventListener('devicemotion', this.motionHandler);
    window.removeEventListener('deviceorientation', this.orientationHandler);
    this.listening = false;
  }
}
