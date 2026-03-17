import { Injectable, inject } from '@angular/core';
import { NavigationService } from './navigation';

// Threshold for linear acceleration magnitude (m/s²) to detect a step.
// Uses event.acceleration (gravity-free) — much simpler than gravity-based heuristics.
const STEP_THRESHOLD = 1.5;
const STEP_COOLDOWN_MS = 350;

@Injectable({
  providedIn: 'root',
})
export class PedometerService {
  private readonly navigationService = inject(NavigationService);

  private listening = false;
  private lastStepAt = 0;

  // ── Step detection ─────────────────────────────────────────────────────────
  // Uses linear acceleration (no gravity). Peaks > threshold = one step.
  private readonly motionHandler = (event: DeviceMotionEvent) => {
    const a = event.acceleration;
    if (!a) return;

    const magnitude = Math.sqrt((a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2);
    const now = Date.now();

    if (magnitude > STEP_THRESHOLD && now - this.lastStepAt > STEP_COOLDOWN_MS) {
      this.lastStepAt = now;
      this.navigationService.registerStep();
    }
  };

  // ── Compass heading ────────────────────────────────────────────────────────
  // iOS: webkitCompassHeading is true-north, 0 = North, 90 = East.
  // Other: 360 - alpha converts device yaw to same convention.
  private readonly orientationHandler = (event: DeviceOrientationEvent) => {
    const ios = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;

    if (typeof ios === 'number' && Number.isFinite(ios)) {
      this.navigationService.setHeading(ios);
      return;
    }

    if (typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
      this.navigationService.setHeading((360 - event.alpha + 360) % 360);
    }
  };

  isListening(): boolean {
    return this.listening;
  }

  isSupported(): boolean {
    return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
  }

  // On iOS 13+ both DeviceMotion and DeviceOrientation need explicit permission.
  // They must be requested sequentially — iOS only accepts one system dialog at a time.
  async requestPermission(): Promise<boolean> {
    const motionGranted = await this.requestNativePermission(DeviceMotionEvent);
    const orientationGranted = await this.requestNativePermission(DeviceOrientationEvent);
    return motionGranted && orientationGranted;
  }

  startListening(): void {
    if (this.listening) return;

    window.addEventListener('devicemotion', this.motionHandler);
    window.addEventListener('deviceorientation', this.orientationHandler);
    this.listening = true;
  }

  stopListening(): void {
    if (!this.listening) return;

    window.removeEventListener('devicemotion', this.motionHandler);
    window.removeEventListener('deviceorientation', this.orientationHandler);
    this.listening = false;
  }

  private async requestNativePermission(
    api: typeof DeviceMotionEvent | typeof DeviceOrientationEvent,
  ): Promise<boolean> {
    const requestFn = (api as unknown as { requestPermission?: () => Promise<string> }).requestPermission;

    if (typeof requestFn !== 'function') {
      // Android / desktop — no permission needed
      return true;
    }

    try {
      const result = await requestFn();
      return result === 'granted';
    } catch {
      return false;
    }
  }
}
