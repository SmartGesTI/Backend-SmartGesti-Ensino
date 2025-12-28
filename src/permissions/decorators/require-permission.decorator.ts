import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'permissions';

export interface PermissionRequirement {
  resource: string;
  action: string;
}

/**
 * Decorator para especificar permissões necessárias em uma rota
 * 
 * @example
 * @RequirePermission('schools', 'create')
 * async createSchool() { }
 */
export const RequirePermission = (resource: string, action: string) =>
  SetMetadata(PERMISSION_KEY, { resource, action } as PermissionRequirement);

/**
 * Decorator para especificar que a rota requer ser proprietário
 * 
 * @example
 * @RequireOwner()
 * async transferOwnership() { }
 */
export const RequireOwner = () =>
  SetMetadata(PERMISSION_KEY, { resource: '*', action: '*' } as PermissionRequirement);

/**
 * Decorator para especificar que a rota requer um cargo específico
 * 
 * @example
 * @RequireRole('admin')
 * async manageUsers() { }
 */
export const ROLE_KEY = 'role';
export const RequireRole = (roleSlug: string) =>
  SetMetadata(ROLE_KEY, roleSlug);
