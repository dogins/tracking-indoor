import { Position } from './position.model';

export interface Product {
  id: number;
  name: string;
  meta: string;
  price: string;
  emoji: string;
  zoneId: string;
  loc: string;
  destPos: Position;
}
