export interface RequestContext {
  requestId: string;
  userId?: string;
  userRole?: string;
  method: string;
  url: string;
  ip?: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  context: RequestContext;
  createdAt: string;
}
