import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { combineLatest } from 'rxjs';
import { MapAisle } from '../../core/models/map-aisle.model';
import { Position } from '../../core/models/position.model';
import { Product } from '../../core/models/product.model';
import { NavigationService } from '../../core/services/navigation';
import { PedometerService } from '../../core/services/pedometer';
import { RouteService } from '../../core/services/route';
import { StoreMapService } from '../../core/services/store-map';
import { SensorBarComponent } from '../../shared/components/sensor-bar/sensor-bar';
import { TopbarComponent } from '../../shared/components/topbar/topbar';
import { DistanceFormatPipe } from '../../shared/pipes/distance-format-pipe';

@Component({
  selector: 'app-map-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DistanceFormatPipe, SensorBarComponent, TopbarComponent],
  templateUrl: './map.html',
  styleUrl: './map.scss',
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private readonly navigationService = inject(NavigationService);
  private readonly storeMapService = inject(StoreMapService);
  private readonly routeService = inject(RouteService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly pedometerService = inject(PedometerService);

  @ViewChild('mapCanvas') private readonly canvasRef!: ElementRef<HTMLCanvasElement>;

  private canvas!: HTMLCanvasElement;
  private context!: CanvasRenderingContext2D;
  private resizeObserver?: ResizeObserver;
  private simulationTimer: number | null = null;

  private readonly mapWidth = 600;
  private readonly mapHeight = 560;

  aisles: MapAisle[] = [];
  pos: Position = { x: 300, y: 480 };
  heading = 0;
  steps = 0;
  totalDist = 0;
  driftError = 0;
  trail: Position[] = [];
  routeWaypoints: Position[] = [];
  target: Product | null = null;

  instructionArrow = '🧭';
  instructionText = 'Selecciona un producto para navegar';
  instructionDistance = 0;

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    const context = this.canvas.getContext('2d');
    if (!context) {
      return;
    }
    this.context = context;

    this.resizeCanvas();
    this.observeResize();

    combineLatest([
      this.storeMapService.aisles$,
      this.navigationService.pos$,
      this.navigationService.heading$,
      this.navigationService.steps$,
      this.navigationService.totalDist$,
      this.navigationService.driftError$,
      this.navigationService.trail$,
      this.navigationService.routeWaypoints$,
      this.navigationService.target$,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([aisles, pos, heading, steps, totalDist, driftError, trail, routeWaypoints, target]) => {
        this.aisles = aisles;
        this.pos = pos;
        this.heading = heading;
        this.steps = steps;
        this.totalDist = totalDist;
        this.driftError = driftError;
        this.trail = trail;
        this.routeWaypoints = routeWaypoints;
        this.target = target;

        const instruction = this.routeService.getNextInstruction(this.pos, this.routeWaypoints, this.target);
        this.instructionArrow = instruction.arrow;
        this.instructionText = instruction.text;
        this.instructionDistance = instruction.distanceM;

        this.drawMap();
      });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.stopSimulation();
    this.pedometerService.stopListening();
  }

  goToSearch(): void {
    this.router.navigateByUrl('/search');
  }

  goToScan(): void {
    this.router.navigateByUrl('/scan');
  }

  reset(): void {
    this.stopSimulation();
    this.navigationService.reset();
  }

  toggleSimulation(): void {
    if (this.simulationTimer) {
      this.stopSimulation();
      return;
    }

    if (!this.target || this.routeWaypoints.length === 0) {
      return;
    }

    let waypointIndex = 1;

    this.simulationTimer = window.setInterval(() => {
      const goal = this.routeWaypoints[waypointIndex] ?? this.target?.destPos;
      if (!goal) {
        this.stopSimulation();
        return;
      }

      const dx = goal.x - this.pos.x;
      const dy = goal.y - this.pos.y;
      const dist = Math.sqrt(dx ** 2 + dy ** 2);

      if (dist < 6) {
        waypointIndex += 1;
        if (waypointIndex > this.routeWaypoints.length) {
          this.stopSimulation();
        }
        return;
      }

      const step = 8;
      const ratio = Math.min(1, step / dist);
      const next: Position = {
        x: this.pos.x + dx * ratio,
        y: this.pos.y + dy * ratio,
      };

      this.navigationService.setPosition(next);
      this.navigationService.setHeading((Math.atan2(dx, -dy) * 180) / Math.PI);
    }, 200);
  }

  private stopSimulation(): void {
    if (!this.simulationTimer) {
      return;
    }

    window.clearInterval(this.simulationTimer);
    this.simulationTimer = null;
  }

  private observeResize(): void {
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvas);
  }

  private resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ngZone.runOutsideAngular(() => this.drawMap());
  }

  private logToCanvas(lx: number, ly: number): { x: number; y: number; scale: number } {
    const scaleX = this.canvas.width / this.mapWidth;
    const scaleY = this.canvas.height / this.mapHeight;
    const scale = Math.min(scaleX, scaleY);
    const offX = (this.canvas.width - this.mapWidth * scale) / 2;
    const offY = (this.canvas.height - this.mapHeight * scale) / 2;
    return { x: lx * scale + offX, y: ly * scale + offY, scale };
  }

  private drawMap(): void {
    if (!this.context || !this.canvas) {
      return;
    }

    const ctx = this.context;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#0a0a08';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (const aisle of this.aisles) {
      const topLeft = this.logToCanvas(aisle.x, aisle.y);
      const bottomRight = this.logToCanvas(aisle.x + aisle.w, aisle.y + aisle.h);
      ctx.fillStyle = aisle.color;
      ctx.fillRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
    }

    if (this.routeWaypoints.length > 1) {
      ctx.beginPath();
      for (let index = 0; index < this.routeWaypoints.length; index += 1) {
        const p = this.logToCanvas(this.routeWaypoints[index].x, this.routeWaypoints[index].y);
        if (index === 0) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = '#c8f03c';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (this.trail.length > 1) {
      ctx.beginPath();
      for (let index = 0; index < this.trail.length; index += 1) {
        const p = this.logToCanvas(this.trail[index].x, this.trail[index].y);
        if (index === 0) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.strokeStyle = 'rgba(96,196,240,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const user = this.logToCanvas(this.pos.x, this.pos.y);
    ctx.beginPath();
    ctx.fillStyle = '#60c4f0';
    ctx.arc(user.x, user.y, 7, 0, Math.PI * 2);
    ctx.fill();

    if (this.target) {
      const target = this.logToCanvas(this.target.destPos.x, this.target.destPos.y);
      ctx.beginPath();
      ctx.fillStyle = '#ff5a3c';
      ctx.arc(target.x, target.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
