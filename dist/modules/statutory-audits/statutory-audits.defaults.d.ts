import type { AuditLocationCategory } from "./statutory-audits.types.js";
export interface StatutoryAuditDefaultLocation {
    locationCategory: AuditLocationCategory;
    locationName: string;
    sortOrder: number;
}
export declare const DEFAULT_STATUTORY_AUDIT_LOCATIONS: StatutoryAuditDefaultLocation[];
