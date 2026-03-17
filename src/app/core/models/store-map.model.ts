import { MapAisle } from './map-aisle.model';
import { Position } from './position.model';
import { Product } from './product.model';
import { Zone } from './zone.model';

export interface QrPoint {
  pos: Position;
  zoneId: string;
}

export interface StoreMapData {
  aisles: MapAisle[];
  zones: Zone[];
  qrPoints: QrPoint[];
  products: Product[];
}
