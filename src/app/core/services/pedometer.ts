import { Injectable, inject } from '@angular/core';
import { NavigationService } from './navigation';

const STEP_PEAK_DEVIATION = 0.5;
const STEP_VALLEY_RETURN = 0.15;
const STEP_COOLDOWN_MS = 280;
const STEP_MIN_MS = 100;
const STEP_MAX_MS = 600;
const SHAKE_REJECT_THRESHOLD = 5.0;
const MAGNITUDE_SMOOTHING = 0.72;
const GRAVITY_SMOOTHING = 0.9;
const BASELINE_SMOOTHING = 0.985;

@Injectable({
  providedIn: 'root',
})
export class PedometerService {
  private readonly navigationService = inject(NavigationService);

  private listening = false;
  private lastStepAt = 0;
  private inStepCandidate = false;
  private candidateStartedAt = 0;
  private smoothedMagnitude = 0;
  private baselineMagnitude = 0;
  private baselineReady = false;

  private gravityX = 0;
  private gravityY = 0;
  private gravityZ = 0;

  // ── Step detection (adaptive baseline + peak-valley) ───────────────────────
  // Tracks a running baseline of resting magnitude, detects steps as deviations above it.
  private readonly motionHandler = (event: DeviceMotionEvent) => {
    const linear = this.getLinearAcceleration(event);
    if (!linear) return;

    const magnitude = Math.sqrt(linear.x ** 2 + linear.y ** 2 + linear.z ** 2);
    this.smoothedMagnitude = this.smoothedMagnitude * MAGNITUDE_SMOOTHING + magnitude * (1 - MAGNITUDE_SMOOTHING);

    if (!this.baselineReady) {
      this.baselineMagnitude = this.smoothedMagnitude;
      this.baselineReady = true;
    } else {
      this.baselineMagnitude = this.baselineMagnitude * BASELINE_SMOOTHING + this.smoothedMagnitude * (1 - BASELINE_SMOOTHING);
    }

    const deviation = this.smoothedMagnitude - this.baselineMagnitude;
    const now = Date.now();

    if (this.smoothedMagnitude > SHAKE_REJECT_THRESHOLD) {
      this.inStepCandidate = false;
      return;
    }

    if (!this.inStepCandidate) {
      if (deviation >= STEP_PEAK_DEVIATION && now - this.lastStepAt > STEP_COOLDOWN_MS) {
        this.inStepCandidate = true;
        this.candidateStartedAt = now;
      }
      return;
    }

    const candidateDuration = now - this.candidateStartedAt;

    if (candidateDuration > STEP_MAX_MS) {
      this.inStepCandidate = false;
      return;
    }

    if (deviation <= STEP_VALLEY_RETURN && candidateDuration >= STEP_MIN_MS) {
      this.lastStepAt = now;
      this.inStepCandidate = false;
      this.navigationService.registerStep();
    }
  };

  private getLinearAcceleration(event: DeviceMotionEvent): { x: number; y: number; z: number } | null {
    const linear = event.acceleration;
    if (linear && this.isFinite3(linear.x, linear.y, linear.z)) {
      return {
        x: linear.x ?? 0,
        y: linear.y ?? 0,
        z: linear.z ?? 0,
      };
    }

    const withGravity = event.accelerationIncludingGravity;
    if (!withGravity || !this.isFinite3(withGravity.x, withGravity.y, withGravity.z)) {
      return null;
    }

    const gx = withGravity.x ?? 0;
    const gy = withGravity.y ?? 0;
    const gz = withGravity.z ?? 0;

    this.gravityX = this.gravityX * GRAVITY_SMOOTHING + gx * (1 - GRAVITY_SMOOTHING);
    this.gravityY = this.gravityY * GRAVITY_SMOOTHING + gy * (1 - GRAVITY_SMOOTHING);
    this.gravityZ = this.gravityZ * GRAVITY_SMOOTHING + gz * (1 - GRAVITY_SMOOTHING);

    return {
      x: gx - this.gravityX,
      y: gy - this.gravityY,
      z: gz - this.gravityZ,
    };
  }

  private isFinite3(x: number | null | undefined, y: number | null | undefined, z: number | null | undefined): boolean {
    return Number.isFinite(x ?? NaN) && Number.isFinite(y ?? NaN) && Number.isFinite(z ?? NaN);
  }

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

    this.smoothedMagnitude = 0;
    this.baselineMagnitude = 0;
    this.baselineReady = false;
    this.inStepCandidate = false;

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
