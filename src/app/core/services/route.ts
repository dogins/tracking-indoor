import { Injectable, inject } from '@angular/core';
import { combineLatest } from 'rxjs';
import { Position } from '../models/position.model';
import { Product } from '../models/product.model';
import { StoreMapService } from './store-map';

@Injectable({
  providedIn: 'root',
})
export class RouteService {
  private readonly storeMapService = inject(StoreMapService);

  private nodeMap = new Map<string, Position>();
  private adjacency = new Map<string, { nodeId: string; dist: number }[]>();

  private readonly pathSub = combineLatest([
    this.storeMapService.pathNodes$,
    this.storeMapService.pathEdges$,
  ]).subscribe(([nodes, edges]) => {
    this.nodeMap = new Map(nodes.map((n) => [n.id, n.pos]));
    this.adjacency = new Map();

    for (const n of nodes) {
      this.adjacency.set(n.id, []);
    }

    for (const [a, b] of edges) {
      const posA = this.nodeMap.get(a);
      const posB = this.nodeMap.get(b);
      if (!posA || !posB) continue;

      const d = this.distance(posA, posB);
      this.adjacency.get(a)!.push({ nodeId: b, dist: d });
      this.adjacency.get(b)!.push({ nodeId: a, dist: d });
    }
  });

  buildRoute(from: Position, to: Position): Position[] {
    if (this.nodeMap.size === 0) return [from, to];

    const startNode = this.closestNode(from);
    const endNode = this.closestNode(to);
    if (!startNode || !endNode) return [from, to];
    if (startNode === endNode) return [from, to];

    const path = this.dijkstra(startNode, endNode);
    if (path.length === 0) return [from, to];

    const waypoints: Position[] = [from];
    for (const nodeId of path) {
      const pos = this.nodeMap.get(nodeId);
      if (pos) waypoints.push(pos);
    }
    waypoints.push(to);

    return this.simplifyPath(waypoints);
  }

  getNextInstruction(
    pos: Position,
    waypoints: Position[],
    target: Product | null,
  ): {
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

    const text = distanceM < 1 ? `Llegaste a ${target.name}` : `Avanza hacia ${target.loc}`;

    return { arrow, text, distanceM };
  }

  private closestNode(pos: Position): string | null {
    let best: string | null = null;
    let bestDist = Infinity;

    for (const [id, nodePos] of this.nodeMap) {
      const d = this.distance(pos, nodePos);
      if (d < bestDist) {
        bestDist = d;
        best = id;
      }
    }

    return best;
  }

  private dijkstra(start: string, end: string): string[] {
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    const visited = new Set<string>();

    for (const nodeId of this.adjacency.keys()) {
      dist.set(nodeId, Infinity);
      prev.set(nodeId, null);
    }
    dist.set(start, 0);

    while (true) {
      let u: string | null = null;
      let uDist = Infinity;

      for (const [nodeId, d] of dist) {
        if (!visited.has(nodeId) && d < uDist) {
          u = nodeId;
          uDist = d;
        }
      }

      if (!u || u === end) break;
      visited.add(u);

      for (const neighbor of this.adjacency.get(u) ?? []) {
        if (visited.has(neighbor.nodeId)) continue;
        const alt = uDist + neighbor.dist;
        if (alt < (dist.get(neighbor.nodeId) ?? Infinity)) {
          dist.set(neighbor.nodeId, alt);
          prev.set(neighbor.nodeId, u);
        }
      }
    }

    const path: string[] = [];
    let current: string | null = end;
    while (current) {
      path.unshift(current);
      current = prev.get(current) ?? null;
    }

    return path[0] === start ? path : [];
  }

  private simplifyPath(points: Position[]): Position[] {
    if (points.length <= 2) return points;

    const result: Position[] = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const p = result[result.length - 1];
      const curr = points[i];
      const next = points[i + 1];

      const dx1 = curr.x - p.x;
      const dy1 = curr.y - p.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;

      if (Math.abs(dx1 * dy2 - dy1 * dx2) > 0.1) {
        result.push(curr);
      }
    }
    result.push(points[points.length - 1]);

    return result;
  }

  private distance(a: Position, b: Position): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx ** 2 + dy ** 2);
  }
}
