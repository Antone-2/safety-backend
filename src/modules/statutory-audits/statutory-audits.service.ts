import { StatutoryAuditRepository } from "./statutory-audits.repository.js";
import type {
  StatutoryAuditMatrixResponse,
  AuditLocationCategory,
  AuditTypeEnum,
  StatutoryAuditRecord,
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

  async upsertRecord(input: {
    locationCategory: AuditLocationCategory;
    locationName: string;
    sortOrder: number;
    auditType: AuditTypeEnum;
    dateDone?: string;
    remarks?: string;
    referenceNo?: string;
  }): Promise<StatutoryAuditRecord> {
    await this.repository.upsertRecord(
      input.locationCategory,
      input.locationName,
      input.sortOrder,
      input.auditType,
      {
        dateDone: normalizeOptionalText(input.dateDone),
        remarks: normalizeOptionalText(input.remarks),
        referenceNo: normalizeOptionalText(input.referenceNo),
      },
    );

    const records = await this.repository.findAll({
      locationCategory: input.locationCategory,
      locationName: input.locationName,
    });

    const record = records.find((item) => item.auditType === input.auditType);
    if (!record) {
      throw new Error("Statutory audit record could not be loaded after save");
    }
    return record;
  }

  async deleteLocation(locationCategory: AuditLocationCategory, locationName: string): Promise<boolean> {
    const exists = await this.repository.existsByLocation(locationCategory, locationName);
    if (!exists) return false;
    await this.repository.deleteByLocation(locationCategory, locationName);
    return true;
  }
}

function normalizeOptionalText(value?: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

