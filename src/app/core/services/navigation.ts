import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, take } from 'rxjs';
import { Position } from '../models/position.model';
import { Product } from '../models/product.model';
import { QrPoint } from '../models/store-map.model';
import { Zone } from '../models/zone.model';
import { RouteService } from './route';
import { StoreMapService } from './store-map';

interface PathSegment {
  from: Position;
  to: Position;
}

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
  private pathSegments: PathSegment[] = [];

  private readonly pathSub = combineLatest([
    this.storeMapService.pathNodes$,
    this.storeMapService.pathEdges$,
  ]).subscribe(([nodes, edges]) => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n.pos]));
    this.pathSegments = edges
      .map(([a, b]) => ({ from: nodeMap.get(a)!, to: nodeMap.get(b)! }))
      .filter((seg) => seg.from && seg.to);
  });

  setZone(zoneId: string): void {
    this.storeMapService.zones$.pipe(take(1)).subscribe((zones) => {
      const selectedZone = zones.find((zone) => zone.id === zoneId);
      if (!selectedZone) {
        return;
      }

      this.currentZone$.next(selectedZone);
      const snapped = this.snapToPath(selectedZone.anchorPos);
      this.pos$.next(snapped);
      this.trail$.next([snapped]);
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

    const raw: Position = {
      x: current.x + Math.sin(radians) * logicalStep,
      y: current.y - Math.cos(radians) * logicalStep,
    };

    const next = this.snapToPath(raw);

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
    const snapped = this.snapToPath(position);
    this.pos$.next(snapped);
    this.pushTrail(snapped);
    this.autoCalibrateWithQr(snapped);
  }

  calibrate(qrPos: Position): void {
    const snapped = this.snapToPath(qrPos);
    this.pos$.next(snapped);
    this.driftError$.next(0);
    this.pushTrail(snapped);
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

  private snapToPath(raw: Position): Position {
    if (this.pathSegments.length === 0) return raw;

    let best = raw;
    let bestDist = Infinity;

    for (const seg of this.pathSegments) {
      const p = this.closestPointOnSegment(raw, seg.from, seg.to);
      const d = this.distance(raw, p);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }

    return best;
  }

  private closestPointOnSegment(p: Position, a: Position, b: Position): Position {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return a;

    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    return { x: a.x + t * dx, y: a.y + t * dy };
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
