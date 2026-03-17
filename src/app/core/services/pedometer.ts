import { Injectable, inject } from '@angular/core';
import { NavigationService } from './navigation';

@Injectable({
  providedIn: 'root',
})
export class PedometerService {
  private readonly navigationService = inject(NavigationService);

  private listening = false;
  private lastStepAt = 0;
  private readonly cooldownMs = 300;
  private readonly zAtRest = 9.81;
  private readonly zPeakThreshold = 0.8;
  private readonly smoothingFactor = 0.7;
  private readonly magnitudeThreshold = 1.2;

  private smoothedZ = this.zAtRest;

  private motionHandler = (event: DeviceMotionEvent) => {
    const ax = event.accelerationIncludingGravity?.x ?? 0;
    const ay = event.accelerationIncludingGravity?.y ?? 0;
    const az = event.accelerationIncludingGravity?.z ?? 0;
    const magnitude = Math.sqrt(ax ** 2 + ay ** 2 + az ** 2);
    this.smoothedZ = this.smoothedZ * this.smoothingFactor + az * (1 - this.smoothingFactor);

    const zDelta = Math.abs(this.smoothedZ - this.zAtRest);
    const magnitudeDelta = Math.abs(magnitude - this.zAtRest);
    const now = Date.now();

    if (now - this.lastStepAt > this.cooldownMs && (zDelta > this.zPeakThreshold || magnitudeDelta > this.magnitudeThreshold)) {
      this.lastStepAt = now;
      this.navigationService.registerStep();
    }
  };

  private orientationHandler = (event: DeviceOrientationEvent) => {
    const compassHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;

    if (typeof compassHeading === 'number') {
      this.navigationService.setHeading(compassHeading);
      return;
    }

    if (typeof event.alpha === 'number') {
      this.navigationService.setHeading(event.alpha);
    }
  };

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
  }

  isListening(): boolean {
    return this.listening;
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    const motionPromise = this.requestMotionPermission();
    const orientationPromise = this.requestOrientationPermission();
    const [motionGranted, orientationGranted] = await Promise.all([motionPromise, orientationPromise]);

    return motionGranted || orientationGranted;
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

  private async requestMotionPermission(): Promise<boolean> {
    const request = (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
    if (typeof request !== 'function') {
      return true;
    }

    try {
      const status = await request();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  private async requestOrientationPermission(): Promise<boolean> {
    const request = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
    if (typeof request !== 'function') {
      return true;
    }

    try {
      const status = await request();
      return status === 'granted';
    } catch {
      return false;
    }
  }
}
