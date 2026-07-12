import { createHash, randomBytes } from "crypto";
import { NotFoundError } from "../../shared/domain/errors/index.js";
function hash(value) {
    return createHash("sha256").update(value).digest("hex");
}
function actorName(actor) {
    return actor?.name || actor?.email || "System";
}
export class DocumentsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getDocuments(filters) {
        return this.repository.findAll(filters);
    }
    async getDocumentById(id) {
        return this.repository.findById(id);
    }
    async createDocument(data) {
        const documentNo = `DOC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
        return this.repository.create({ ...data, documentNo });
    }
    async updateDocument(id, data) {
        const existing = await this.repository.findById(id);
        if (!existing)
            throw new NotFoundError("Document");
        return this.repository.update(id, data);
    }
    async deleteDocument(id) {
        const existing = await this.repository.findById(id);
        if (!existing)
            return false;
        return this.repository.delete(id);
    }
    async createVersion(documentId, data, createdBy) {
        const existing = await this.repository.findById(documentId);
        if (!existing)
            throw new NotFoundError("Document");
        return this.repository.createVersion(data, documentId, createdBy);
    }
    async getVersions(documentId) {
        return this.repository.findVersions(documentId);
    }
    async submitForReview(documentId, data, actor) {
        const existing = await this.repository.findById(documentId);
        if (!existing)
            throw new NotFoundError("Document");
        const version = String(data.version || existing.version || "1.0");
        const approval = {
            documentId,
            version,
            step: "review",
            status: "Pending",
            approverId: undefined,
            approverName: data.reviewerName ||
                data.reviewer ||
                existing.reviewer ||
                actorName(actor),
            comments: data.comments || undefined,
            decidedAt: undefined,
        };
        await this.repository.createApproval(approval);
        const updated = await this.repository.update(documentId, {
            status: "Under Review",
            reviewer: approval.approverName,
            reviewDate: new Date().toISOString(),
        });
        return updated;
    }
    async approve(documentId, data, actor) {
        const existing = await this.repository.findById(documentId);
        if (!existing)
            throw new NotFoundError("Document");
        const version = String(data.version || existing.version || "1.0");
        const decidedAt = new Date().toISOString();
        const approval = {
            documentId,
            version,
            step: "approval",
            status: data.status || "Approved",
            approverId: actor?.id || undefined,
            approverName: actorName(actor),
            comments: data.comments || undefined,
            decidedAt,
        };
        await this.repository.createApproval(approval);
        const effectiveDate = data.effectiveDate || decidedAt;
        const reviewCycleDays = data.reviewCycleDays || existing.reviewCycleDays || 365;
        const nextReviewDate = new Date(new Date(effectiveDate).getTime() + reviewCycleDays * 86400000).toISOString();
        const updated = await this.repository.update(documentId, {
            status: approval.status === "Rejected" ? "Draft" : "Approved",
            approver: approval.approverName,
            approvalDate: decidedAt,
            effectiveDate,
            reviewCycleDays,
            nextReviewDate,
        });
        return updated;
    }
    async markObsolete(documentId, data, actor) {
        const existing = await this.repository.findById(documentId);
        if (!existing)
            throw new NotFoundError("Document");
        const updatedAt = new Date().toISOString();
        await this.repository.update(documentId, {
            status: "Obsolete",
            obsoleteReason: data.reason || existing.obsoleteReason || "Superseded or withdrawn",
        });
        await this.repository.createApproval({
            documentId,
            version: String(data.version || "current"),
            step: "obsolete",
            status: "Approved",
            approverName: actorName(actor),
            comments: data.reason || undefined,
            decidedAt: updatedAt,
        });
        return {
            documentId,
            status: "Obsolete",
            obsoleteReason: data.reason || existing.obsoleteReason,
        };
    }
    async acknowledge(documentId, documentVersion, actor, requestMeta) {
        const existing = await this.repository.findById(documentId);
        if (!existing)
            throw new NotFoundError("Document");
        return this.repository.createAcknowledgement({
            documentId,
            documentVersion,
            userId: actor.id || actor.email || "unknown",
            userEmail: actor.email || "unknown",
            userName: actorName(actor),
            ipAddress: requestMeta?.ip ?? undefined,
            userAgent: requestMeta?.userAgent ?? undefined,
        });
    }
    async getAcknowledgements(documentId) {
        return this.repository.findAcknowledgements(documentId);
    }
    async getAcknowledgementReport() {
        const docs = await this.repository.findAll({ status: "Approved" });
        const report = [];
        for (const doc of docs) {
            const acks = await this.repository.findAcknowledgements(doc.id);
            const lastAck = acks.length > 0 ? acks[0].acknowledgedAt : undefined;
            report.push({
                ...doc,
                acknowledgements: acks.length,
                lastAcknowledgedAt: lastAck,
            });
        }
        return report.sort((a, b) => a.title.localeCompare(b.title));
    }
    async createAccessLink(documentId, data, actor) {
        const existing = await this.repository.findById(documentId);
        if (!existing)
            throw new NotFoundError("Document");
        const token = randomBytes(24).toString("hex");
        const expiresAt = data.expiresAt ||
            new Date(Date.now() + (data.ttlHours || 24) * 3600000).toISOString();
        const link = await this.repository.createAccessLink({
            documentId,
            tokenHash: hash(token),
            purpose: data.purpose || "download",
            createdBy: actorName(actor),
            expiresAt,
        });
        return {
            ...link,
            signedUrl: `/api/documents/${documentId}/download?token=${token}`,
        };
    }
    async getStats() {
        return this.repository.getStats();
    }
}
