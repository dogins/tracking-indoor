import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, startWith, switchMap } from 'rxjs';
import { Product } from '../../core/models/product.model';
import { NavigationService } from '../../core/services/navigation';
import { StoreMapService } from '../../core/services/store-map';
import { TopbarComponent } from '../../shared/components/topbar/topbar';

@Component({
  selector: 'app-search-screen',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncPipe, ReactiveFormsModule, TopbarComponent],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchComponent {
  private readonly storeMapService = inject(StoreMapService);
  private readonly navigationService = inject(NavigationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly queryControl = new FormControl('', { nonNullable: true });
  readonly products$ = this.queryControl.valueChanges.pipe(
    startWith(''),
    debounceTime(300),
    switchMap((query) => this.storeMapService.searchProducts(query))
  );

  readonly currentZone$ = this.navigationService.currentZone$;

  constructor() {
    this.queryControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  selectProduct(product: Product): void {
    this.navigationService.selectProduct(product);
    this.router.navigateByUrl('/map');
  }

  backToMap(): void {
    this.router.navigateByUrl('/map');
  }
}
