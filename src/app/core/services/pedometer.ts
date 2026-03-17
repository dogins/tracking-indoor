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
  private readonly headingSmoothingFactor = 0.25;

  private smoothedZ = this.zAtRest;
  private smoothedHeading = 0;

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
    const heading = this.getNormalizedCompassHeading(event);
    if (heading === null) {
      return;
    }

    this.smoothedHeading = this.smoothCircularAngle(this.smoothedHeading, heading, this.headingSmoothingFactor);
    this.navigationService.setHeading(this.smoothedHeading);
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

  private getNormalizedCompassHeading(event: DeviceOrientationEvent): number | null {
    const iosHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
    let heading: number | null = null;

    if (typeof iosHeading === 'number' && Number.isFinite(iosHeading)) {
      heading = iosHeading;
    } else if (typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
      heading = 360 - event.alpha;
    }

    if (heading === null) {
      return null;
    }

    const correctedHeading = heading - this.getScreenOrientationOffset();
    return this.normalizeAngle(correctedHeading);
  }

  private getScreenOrientationOffset(): number {
    const screenOrientation = window.screen?.orientation?.angle;
    if (typeof screenOrientation === 'number') {
      return screenOrientation;
    }

    const legacyOrientation = (window as Window & { orientation?: number }).orientation;
    if (typeof legacyOrientation === 'number') {
      return legacyOrientation;
    }

    return 0;
  }

  private normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360;
  }

  private smoothCircularAngle(previous: number, target: number, factor: number): number {
    const delta = ((target - previous + 540) % 360) - 180;
    return this.normalizeAngle(previous + delta * factor);
  }
}
