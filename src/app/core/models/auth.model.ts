/** GET /api/v1/auth/profile (UserProfileDTO). Sincroniza el perfil tras el login. */
export interface UserProfile {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
}

/** Roles de aplicación de Entra (claim `roles`). */
export type AppRole = 'CUSTOMER' | 'CATALOG_MANAGER' | 'ADMIN';
