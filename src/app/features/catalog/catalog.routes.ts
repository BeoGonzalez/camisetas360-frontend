import { Routes } from '@angular/router';
import { CatalogComponent } from './catalog.component';

/**
 * Rutas del feature de catálogo.
 * Cargadas de forma lazy desde app.routes.ts.
 */
export const CATALOG_ROUTES: Routes = [
  { path: '', component: CatalogComponent },
];
