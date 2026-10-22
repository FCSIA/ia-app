import { TableAggregate } from '@convex-dev/aggregate';
import { components } from '../_generated/api';
import type { DataModel } from '../_generated/dataModel';
import { auditCategory, type AuditCategory } from '../../../shared/audit';

export const auditByCategory = new TableAggregate<{
  Namespace: AuditCategory; Key: number; DataModel: DataModel; TableName: 'auditEvents';
}>(components.auditByCategory, {
  namespace: (doc) => auditCategory(doc.entityType, doc.action),
  sortKey: (doc) => doc.createdAt,
});
// Category is part of the actor key, allowing actor+category+date counts without scans.
export const auditByActor = new TableAggregate<{
  Namespace: string; Key: [AuditCategory, number]; DataModel: DataModel; TableName: 'auditEvents';
}>(components.auditByActor, {
  namespace: (doc) => doc.actorId ?? 'system',
  sortKey: (doc) => [auditCategory(doc.entityType, doc.action), doc.createdAt],
});
