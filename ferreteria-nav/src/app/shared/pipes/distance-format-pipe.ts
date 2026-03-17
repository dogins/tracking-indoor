import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'distanceFormat',
})
export class DistanceFormatPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return '0.0 m';
    }

    return `${value.toFixed(1)} m`;
  }
}
