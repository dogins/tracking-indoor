import { Position } from './position.model';

export interface Zone {
  id: string;
  name: string;
  code: string;
  icon: string;
  anchorPos: Position;
}
