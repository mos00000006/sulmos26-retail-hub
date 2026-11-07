// Pure validation helpers shared with Node regression tests.
export const ROLES = ['owner','manager','sales','cashier','stock','dispatch','viewer'];
export const DOC_TYPES = ['grv','count','adjustment','transfer','supplier_return'];
export const permission = (role, resource, action = 'read') => {
  if (role === 'owner') return true;
  if (role === 'manager') return action === 'read' || !['users','business'].includes(resource);
  if (action === 'read') return resource === 'business' || resource === 'stores' || resource === 'products' || resource === 'tasks' ||
    ((role === 'stock' || role === 'viewer') && resource === 'stock_documents') ||
    ((role === 'sales' || role === 'cashier' || role === 'viewer') && resource === 'quotations');
  if (resource === 'tasks') return role !== 'viewer';
  if (resource === 'quotations') return role === 'sales';
  if (resource === 'stock_documents') return role === 'stock';
  return false;
};
export const validLines = (lines) => Array.isArray(lines) && lines.length > 0 && lines.length <= 100 &&
  lines.every(l => l && typeof l.sku === 'string' && l.sku.trim().length > 0 && l.sku.length <= 100 && Number.isInteger(l.qty) && l.qty > 0 && l.qty <= 1000000) &&
  new Set(lines.map(l => l.sku.trim().toLowerCase())).size === lines.length;
export const validMoney = n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000000;
export const canApprove = (role, creatorId, actorId, status) => ['manager','owner'].includes(role) && creatorId !== actorId && status === 'submitted';
