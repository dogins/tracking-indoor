import { Injectable } from '@angular/core';
import { Position } from '../models/position.model';
import { Product } from '../models/product.model';

@Injectable({
  providedIn: 'root',
})
export class RouteService {
  private readonly corridorY = 430;

  buildRoute(from: Position, to: Position): Position[] {
    return [
      from,
      { x: from.x, y: this.corridorY },
      { x: to.x, y: this.corridorY },
      to,
    ];
  }

  getNextInstruction(pos: Position, waypoints: Position[], target: Product | null): {
    arrow: string;
    text: string;
    distanceM: number;
  } {
    if (!target) {
      return { arrow: '🧭', text: 'Selecciona un producto para navegar', distanceM: 0 };
    }

    const nextWaypoint = waypoints.find((point) => this.distance(pos, point) > 10) ?? target.destPos;
    const dx = nextWaypoint.x - pos.x;
    const dy = nextWaypoint.y - pos.y;
    const distanceLogical = Math.sqrt(dx ** 2 + dy ** 2);
    const distanceM = distanceLogical / 20;

    let arrow = '⬆️';
    if (Math.abs(dx) > Math.abs(dy)) {
      arrow = dx > 0 ? '➡️' : '⬅️';
    } else if (Math.abs(dy) > 0) {
      arrow = dy > 0 ? '⬇️' : '⬆️';
    }

    const text = distanceM < 1
      ? `Llegaste a ${target.name}`
      : `Avanza hacia ${target.loc}`;

    return { arrow, text, distanceM };
  }

  private distance(a: Position, b: Position): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx ** 2 + dy ** 2);
  }
}
