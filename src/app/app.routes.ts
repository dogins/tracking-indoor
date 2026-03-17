import { Routes } from '@angular/router';
import { ScanComponent } from './features/scan/scan';
import { MapComponent } from './features/map/map';
import { SearchComponent } from './features/search/search';

export const routes: Routes = [
	{ path: 'scan', component: ScanComponent },
	{ path: 'map', component: MapComponent },
	{ path: 'search', component: SearchComponent },
	{ path: '', pathMatch: 'full', redirectTo: 'scan' },
	{ path: '**', redirectTo: 'scan' },
];
