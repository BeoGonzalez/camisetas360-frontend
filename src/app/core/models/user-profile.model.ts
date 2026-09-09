/**
 * Modelo que representa el perfil del usuario autenticado.
 * Refleja la respuesta del endpoint /api/v1/auth/profile.
 */
export interface UserProfile {
  /** Identificador único del usuario (Azure Object ID o interno) */
  id: string;

  /** Nombre completo del usuario */
  nombre: string;

  /** Correo electrónico corporativo */
  correo: string;

  /** Identificador adicional (employee ID, username, etc.) */
  identificador: string;
}
