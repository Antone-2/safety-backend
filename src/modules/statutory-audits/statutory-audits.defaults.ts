import type { AuditLocationCategory } from "./statutory-audits.types.js";

export interface StatutoryAuditDefaultLocation {
  locationCategory: AuditLocationCategory;
  locationName: string;
  sortOrder: number;
}

export const DEFAULT_STATUTORY_AUDIT_LOCATIONS: StatutoryAuditDefaultLocation[] = [
  { locationCategory: "FACTORIES", locationName: "FACTORY - MOGADISHU ROAD", sortOrder: 1 },
  { locationCategory: "FACTORIES", locationName: "FACTORY - KISUMU", sortOrder: 2 },
  { locationCategory: "FACTORIES", locationName: "FACTORY- RUFF N TUFF", sortOrder: 3 },
  { locationCategory: "FACTORIES", locationName: "FACTORY - CP ALLIED", sortOrder: 4 },
  { locationCategory: "FACTORIES", locationName: "FACTORY - MOMBASA PLANT", sortOrder: 5 },
  { locationCategory: "FACTORIES", locationName: "FACTORY - COLORANT", sortOrder: 6 },
  { locationCategory: "DEPOTS", locationName: "EXPORT WAREHOUSE-SINAI", sortOrder: 7 },
  { locationCategory: "DEPOTS", locationName: "DEPOT- DAR ROAD", sortOrder: 8 },
  { locationCategory: "DEPOTS", locationName: "DEPOT- ELDORET", sortOrder: 9 },
  { locationCategory: "DEPOTS", locationName: "DEPOT - KISUMU (Juakali Godown)", sortOrder: 10 },
  { locationCategory: "DEPOTS", locationName: "SHOWROOM - NEW- KISUMU", sortOrder: 11 },
  { locationCategory: "DEPOTS", locationName: "DEPOT, WAREHOUSE & HEADOFFICE- LIKONI", sortOrder: 12 },
  { locationCategory: "DEPOTS", locationName: "DEPOT -MERU", sortOrder: 13 },
  { locationCategory: "DEPOTS", locationName: "DEPOT - MOMBASA -MWANGEKA", sortOrder: 14 },
  { locationCategory: "DEPOTS", locationName: "SHOWROOM - MOMBASA- TOWN", sortOrder: 15 },
  { locationCategory: "DEPOTS", locationName: "DEPOT- NYERI", sortOrder: 16 },
  { locationCategory: "DEPOTS", locationName: "DEPOT- KENPOLY Godown & Warehouse", sortOrder: 17 },
  { locationCategory: "DEPOTS", locationName: "DEPOT- WESTLANDS (MUSTEK)", sortOrder: 18 },
  { locationCategory: "DEPOTS", locationName: "DEPOT - NAKURU", sortOrder: 19 },
  { locationCategory: "DEPOTS", locationName: "SHOWROOM - LAVINGTON", sortOrder: 20 },
  { locationCategory: "DEPOTS", locationName: "SHOWROOM - NAKURU", sortOrder: 21 },
  { locationCategory: "DEPOTS", locationName: "SHOWROOM - NYALI -NEW", sortOrder: 22 },
  { locationCategory: "DEPOTS", locationName: "DEPOT - MACHAKOS", sortOrder: 23 },
];
