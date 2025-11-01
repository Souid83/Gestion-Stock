/**
 * RBAC (Role-Based Access Control) System
 * Defines roles, permissions, and access control functions
 */

// Define all available roles in the system
export type Role = 'ADMIN_FULL' | 'ADMIN' | 'COMPTABLE' | 'MAGASIN' | 'VENDEUR';

// Export role constants for easy reference
export const ROLES = {
  ADMIN_FULL: 'ADMIN_FULL' as Role,
  ADMIN: 'ADMIN' as Role,
  COMPTABLE: 'COMPTABLE' as Role,
  MAGASIN: 'MAGASIN' as Role,
  VENDEUR: 'VENDEUR' as Role,
};

// Define all available permissions
export type Permission =
  | 'accessSettings'
  | 'viewOrders'
  | 'viewConsignments'
  | 'accessPricing'
  | 'mapListing'
  | 'createFromListing'
  | 'ignoreListing';

// Permission matrix: defines what each role can do
const permissions: Record<Role, Permission[]> = {
  ADMIN_FULL: [
    'accessSettings',
    'viewOrders',
    'viewConsignments',
    'accessPricing',
    'mapListing',
    'createFromListing',
    'ignoreListing',
  ],
  ADMIN: [
    'viewOrders',
    'viewConsignments',
  ],
  COMPTABLE: [
    'viewOrders',
    'viewConsignments',
  ],
  MAGASIN: [
    'viewOrders',
  ],
  VENDEUR: [
    'viewOrders',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function can(permission: Permission, role: Role): boolean {
  console.log('[RBAC] Checking permission:', { permission, role, hasPermission: permissions[role]?.includes(permission) });
  return permissions[role]?.includes(permission) ?? false;
}

/**
 * Check if a role can view consignments (sous-traitants/dépôt-vente)
 * Only ADMIN_FULL and COMPTABLE have access
 */
export function canViewConsignments(role: Role): boolean {
  console.log('[RBAC] canViewConsignments check:', { role, canView: role === ROLES.ADMIN_FULL || role === ROLES.ADMIN || role === ROLES.COMPTABLE });
  return role === ROLES.ADMIN_FULL || role === ROLES.ADMIN || role === ROLES.COMPTABLE;
}

/**
 * Check if a role can view VAT/tax information in consignments
 * Only ADMIN_FULL and COMPTABLE can see VAT details
 */
export function canViewConsignmentsVAT(role: Role): boolean {
  console.log('[RBAC] canViewConsignmentsVAT check:', { role, canView: role === ROLES.ADMIN_FULL || role === ROLES.ADMIN || role === ROLES.COMPTABLE });
  return role === ROLES.ADMIN_FULL || role === ROLES.ADMIN || role === ROLES.COMPTABLE;
}

/**
 * Check if a user can see purchase prices
 * Rules:
 * - ADMIN_FULL can see all purchase prices
 * - Other roles cannot see purchase prices
 */
export function canSeePurchasePrice(
  role: Role,
  createdBy?: string | null,
  currentUserId?: string | null
): boolean {
  console.log('[RBAC] canSeePurchasePrice check:', {
    role,
    createdBy,
    currentUserId,
    canSee: role === ROLES.ADMIN_FULL
  });

  // Only ADMIN_FULL can see all purchase prices
  return role === ROLES.ADMIN_FULL;
}

/**
 * Check if a user is an administrator
 */
export function isAdminRole(role: Role): boolean {
  return role === ROLES.ADMIN_FULL;
}

/**
 * Check if a user is a comptable (accountant)
 */
export function isComptableRole(role: Role): boolean {
  return role === ROLES.COMPTABLE;
}

/**
 * Get a human-readable label for a role
 */
export function getRoleLabel(role: Role): string {
  const labels: Record<Role, string> = {
    ADMIN_FULL: 'Administrateur Complet',
    ADMIN: 'Administrateur',
    COMPTABLE: 'Comptable',
    MAGASIN: 'Magasin',
    VENDEUR: 'Vendeur',
  };
  return labels[role] || role;
}

/**
 * Get all available roles
 */
export function getAllRoles(): Role[] {
  return Object.values(ROLES);
}
