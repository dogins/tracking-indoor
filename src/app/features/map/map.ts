import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
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
import { DistanceFormatPipe } from '../../shared/pipes/distance-format-pipe';

@Component({
  selector: 'app-map-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, DistanceFormatPipe],
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
  private readonly cdr = inject(ChangeDetectorRef);
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
  sensorMessage = '';

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
        this.cdr.markForCheck();
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

  async activateSensors(): Promise<void> {
    if (this.pedometerService.isListening()) {
      this.sensorMessage = 'Sensores ya están activos.';
      return;
    }

    const granted = await this.pedometerService.requestPermission();
    if (granted) {
      this.pedometerService.startListening();
      this.sensorMessage = 'Sensores activos: brújula y podómetro habilitados.';
      this.cdr.markForCheck();
      return;
    }

    this.sensorMessage = 'No se pudo activar sensores. Revisa permisos del navegador.';
    this.cdr.markForCheck();
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
    const w = this.canvas.width;
    const h = this.canvas.height;
    const { scale } = this.logToCanvas(0, 0);

    // Background (Google Maps off-white)
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f0ede6';
    ctx.fillRect(0, 0, w, h);

    // Grid every 5 meters (100 logical units)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;
    for (let lx = 0; lx <= this.mapWidth; lx += 100) {
      const p1 = this.logToCanvas(lx, 0);
      const p2 = this.logToCanvas(lx, this.mapHeight);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
    for (let ly = 0; ly <= this.mapHeight; ly += 100) {
      const p1 = this.logToCanvas(0, ly);
      const p2 = this.logToCanvas(this.mapWidth, ly);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }

    // Aisles (rounded rectangles with labels)
    for (const aisle of this.aisles) {
      const tl = this.logToCanvas(aisle.x, aisle.y);
      const br = this.logToCanvas(aisle.x + aisle.w, aisle.y + aisle.h);
      const aw = br.x - tl.x;
      const ah = br.y - tl.y;
      const r = Math.min(6 * scale, aw / 4, ah / 4);

      ctx.beginPath();
      ctx.roundRect(tl.x, tl.y, aw, ah, r);
      ctx.fillStyle = aisle.color;
      ctx.fill();
      ctx.strokeStyle = '#b8b2a8';
      ctx.lineWidth = 1;
      ctx.stroke();

      const fontSize = Math.max(10, Math.floor(13 * scale));
      ctx.fillStyle = '#3c4043';
      ctx.font = `600 ${fontSize}px Barlow, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(aisle.name, tl.x + aw / 2, tl.y + ah / 2 - 6 * scale);

      const codeFontSize = Math.max(8, Math.floor(10 * scale));
      ctx.font = `400 ${codeFontSize}px 'DM Mono', monospace`;
      ctx.fillStyle = '#80868b';
      ctx.fillText(aisle.code, tl.x + aw / 2, tl.y + ah / 2 + 10 * scale);
    }

    // Route (Google blue solid line)
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
      ctx.strokeStyle = '#4285F4';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.stroke();
    }

    // Trail
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
      ctx.strokeStyle = 'rgba(66, 133, 244, 0.3)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Target marker (red pin)
    if (this.target) {
      const t = this.logToCanvas(this.target.destPos.x, this.target.destPos.y);
      ctx.beginPath();
      ctx.arc(t.x, t.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#EA4335';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#c62828';
      ctx.fill();
    }

    // User position (Google Maps blue dot with accuracy halo)
    const user = this.logToCanvas(this.pos.x, this.pos.y);
    ctx.beginPath();
    ctx.arc(user.x, user.y, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(66, 133, 244, 0.15)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(user.x, user.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#4285F4';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Scale bar
    this.drawScaleBar(ctx, scale);
  }

  private drawScaleBar(ctx: CanvasRenderingContext2D, scale: number): void {
    const metersToShow = 5;
    const logicalLen = metersToShow * 20;
    const p0 = this.logToCanvas(0, 0);
    const p1 = this.logToCanvas(logicalLen, 0);
    const barPx = p1.x - p0.x;

    const x = 16;
    const y = this.canvas.height - 24;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x - 6, y - 14, barPx + 52, 28, 4);
    ctx.fill();

    ctx.strokeStyle = '#3c4043';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + barPx, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y + 4);
    ctx.moveTo(x + barPx, y - 4);
    ctx.lineTo(x + barPx, y + 4);
    ctx.stroke();

    ctx.fillStyle = '#3c4043';
    ctx.font = '11px Barlow, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${metersToShow} m`, x + barPx + 6, y);
  }
}
