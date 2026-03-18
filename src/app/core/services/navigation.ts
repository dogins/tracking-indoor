import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, take } from 'rxjs';
import { Position } from '../models/position.model';
import { Product } from '../models/product.model';
import { QrPoint } from '../models/store-map.model';
import { Zone } from '../models/zone.model';
import { RouteService } from './route';
import { StoreMapService } from './store-map';

@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  private readonly routeService = inject(RouteService);
  private readonly storeMapService = inject(StoreMapService);

  readonly pos$ = new BehaviorSubject<Position>({ x: 300, y: 500 });
  readonly steps$ = new BehaviorSubject<number>(0);
  readonly totalDist$ = new BehaviorSubject<number>(0);
  readonly driftError$ = new BehaviorSubject<number>(0);
  readonly heading$ = new BehaviorSubject<number>(0);
  readonly target$ = new BehaviorSubject<Product | null>(null);
  readonly currentZone$ = new BehaviorSubject<Zone | null>(null);
  readonly trail$ = new BehaviorSubject<Position[]>([]);
  readonly routeWaypoints$ = new BehaviorSubject<Position[]>([]);

  private readonly strideMeters = 0.65;
  private readonly logicalUnitsPerMeter = 20;
  private readonly qrCalibRadiusLogical = 30;
  private activeQrInRange: string | null = null;

  setZone(zoneId: string): void {
    this.storeMapService.zones$.pipe(take(1)).subscribe((zones) => {
      const selectedZone = zones.find((zone) => zone.id === zoneId);
      if (!selectedZone) {
        return;
      }

      this.currentZone$.next(selectedZone);
      this.pos$.next(selectedZone.anchorPos);
      this.trail$.next([selectedZone.anchorPos]);
      this.driftError$.next(0);
      this.routeWaypoints$.next([]);
      this.activeQrInRange = selectedZone.id;
    });
  }

  selectProduct(product: Product): void {
    this.target$.next(product);
    const position = this.pos$.value;
    this.routeWaypoints$.next(this.routeService.buildRoute(position, product.destPos));
  }

  registerStep(): void {
    const heading = this.heading$.value;
    const radians = (heading * Math.PI) / 180;
    const logicalStep = this.strideMeters * this.logicalUnitsPerMeter;
    const current = this.pos$.value;

    const next: Position = {
      x: current.x + Math.sin(radians) * logicalStep,
      y: current.y - Math.cos(radians) * logicalStep,
    };

    this.pos$.next(next);
    this.steps$.next(this.steps$.value + 1);
    this.totalDist$.next(this.totalDist$.value + this.strideMeters);
    this.driftError$.next(this.driftError$.value + 0.08);
    this.pushTrail(next);
    this.autoCalibrateWithQr(next);
  }

  setHeading(heading: number): void {
    this.heading$.next((heading + 360) % 360);
  }

  setPosition(position: Position): void {
    this.pos$.next(position);
    this.pushTrail(position);
    this.autoCalibrateWithQr(position);
  }

  calibrate(qrPos: Position): void {
    this.pos$.next(qrPos);
    this.driftError$.next(0);
    this.pushTrail(qrPos);
  }

  reset(): void {
    this.pos$.next({ x: 300, y: 500 });
    this.steps$.next(0);
    this.totalDist$.next(0);
    this.driftError$.next(0);
    this.target$.next(null);
    this.currentZone$.next(null);
    this.trail$.next([]);
    this.routeWaypoints$.next([]);
    this.activeQrInRange = null;
  }

  private autoCalibrateWithQr(position: Position): void {
    this.storeMapService.qrPoints$.pipe(take(1)).subscribe((points) => {
      const closePoint = points.find((point) => this.distance(position, point.pos) <= this.qrCalibRadiusLogical);
      if (!closePoint) {
        this.activeQrInRange = null;
        return;
      }

      if (closePoint.zoneId === this.activeQrInRange) {
        return;
      }

      this.activeQrInRange = closePoint.zoneId;
      this.calibrate(closePoint.pos);
      this.syncZoneFromQr(closePoint);
    });
  }

  private syncZoneFromQr(point: QrPoint): void {
    this.storeMapService.zones$.pipe(take(1)).subscribe((zones) => {
      const selectedZone = zones.find((zone) => zone.id === point.zoneId) ?? null;
      this.currentZone$.next(selectedZone);
    });
  }

  private pushTrail(position: Position): void {
    const trail = [...this.trail$.value, position];
    this.trail$.next(trail.slice(-120));
  }

  private distance(a: Position, b: Position): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx ** 2 + dy ** 2);
  }
}
