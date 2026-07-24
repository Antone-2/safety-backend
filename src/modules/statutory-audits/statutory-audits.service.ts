import { StatutoryAuditRepository } from "./statutory-audits.repository.js";
import type {
  StatutoryAuditMatrixResponse,
  AuditLocationCategory,
  AuditTypeEnum,
} from "./statutory-audits.types.js";

export class StatutoryAuditService {
  constructor(private repository: StatutoryAuditRepository) {}

  async getMatrix(filters?: {
    locationCategory?: string;
    search?: string;
  }): Promise<StatutoryAuditMatrixResponse> {
    const { locations, auditTypes } = await this.repository.getMatrix(filters);
    const summary = await this.repository.getSummary();

    return {
      locations: locations.map((loc) => ({
        locationCategory: loc.locationCategory,
        locationName: loc.locationName,
        sortOrder: loc.sortOrder,
        audits: auditTypes.map((type) => ({
          auditType: type,
          dateDone: loc.audits[type]?.dateDone,
          remarks: loc.audits[type]?.remarks,
          referenceNo: loc.audits[type]?.referenceNo,
        })),
      })),
      auditTypes,
      summary,
    };
  }
}

