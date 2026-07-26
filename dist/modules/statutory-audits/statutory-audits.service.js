export class StatutoryAuditService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getMatrix(filters) {
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
    async upsertRecord(input) {
        await this.repository.upsertRecord(input.locationCategory, input.locationName, input.sortOrder, input.auditType, {
            dateDone: normalizeOptionalText(input.dateDone),
            remarks: normalizeOptionalText(input.remarks),
            referenceNo: normalizeOptionalText(input.referenceNo),
        });
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
    async deleteLocation(locationCategory, locationName) {
        const exists = await this.repository.existsByLocation(locationCategory, locationName);
        if (!exists)
            return false;
        await this.repository.deleteByLocation(locationCategory, locationName);
        return true;
    }
}
function normalizeOptionalText(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
