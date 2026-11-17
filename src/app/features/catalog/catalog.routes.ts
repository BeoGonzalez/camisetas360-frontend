import { Routes } from '@angular/router';
import { CatalogComponent } from './catalog.component';

/**
 * Rutas del feature de catálogo (lazy y públicas: el backend permite leer el catálogo sin sesión).
 */
export const CATALOG_ROUTES: Routes = [
  { path: '', component: CatalogComponent },
  {
    path: ':sku',
    loadComponent: () => import('./product-detail.component').then((m) => m.ProductDetailComponent),
  },
];
