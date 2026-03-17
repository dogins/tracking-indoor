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

  isListening(): boolean {
    return this.listening;
  }

  async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) {
      return false;
    }

    const motionGranted = await this.requestMotionPermission();
    const orientationGranted = await this.requestOrientationPermission();
    return motionGranted && orientationGranted;
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
