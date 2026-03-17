import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, shareReplay } from 'rxjs';
import { MapAisle } from '../models/map-aisle.model';
import { Product } from '../models/product.model';
import { QrPoint, StoreMapData } from '../models/store-map.model';
import { Zone } from '../models/zone.model';

@Injectable({
  providedIn: 'root',
})
export class StoreMapService {
  private readonly http = inject(HttpClient);

  private readonly data$ = this.http.get<StoreMapData>('assets/store-map.json').pipe(
    shareReplay(1)
  );

  readonly aisles$: Observable<MapAisle[]> = this.data$.pipe(map((data) => data.aisles));
  readonly zones$: Observable<Zone[]> = this.data$.pipe(map((data) => data.zones));
  readonly products$: Observable<Product[]> = this.data$.pipe(map((data) => data.products));
  readonly qrPoints$: Observable<QrPoint[]> = this.data$.pipe(map((data) => data.qrPoints));

  getProductsByZone(zoneId: string): Observable<Product[]> {
    return this.products$.pipe(map((products) => products.filter((product) => product.zoneId === zoneId)));
  }

  searchProducts(query: string): Observable<Product[]> {
    const normalizedQuery = query.trim().toLowerCase();
    return this.products$.pipe(
      map((products) => {
        if (!normalizedQuery) {
          return products;
        }

        return products.filter((product) => {
          const haystack = `${product.name} ${product.meta} ${product.loc}`.toLowerCase();
          return haystack.includes(normalizedQuery);
        });
      })
    );
  }
}
