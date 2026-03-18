import { MapAisle } from './map-aisle.model';
import { Position } from './position.model';
import { Product } from './product.model';
import { Zone } from './zone.model';

export interface QrPoint {
  pos: Position;
  zoneId: string;
}

export interface PathNode {
  id: string;
  pos: Position;
}

export interface StoreMapData {
  aisles: MapAisle[];
  zones: Zone[];
  qrPoints: QrPoint[];
  products: Product[];
  pathNodes: PathNode[];
  pathEdges: [string, string][];
}
