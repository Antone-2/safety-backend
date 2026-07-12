import { createHash, randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { allRows, getDb, saveDb } from "../lib/database.js";
const now = () => new Date().toISOString();
function hash(value) {
    return createHash("sha256").update(value).digest("hex");
}
function actorName(actor) {
    return actor?.name || actor?.email || "System";
}
export class DocumentControlService {
    async createVersion(documentId, data, actor) {
        const db = await getDb();
        const id = uuidv4();
        const version = String(data.version || "1.0");
        const createdAt = now();
        db.prepare(`INSERT INTO document_versions
        (id, documentId, version, changeSummary, content, fileUrl, fileName, fileSize, checksum, createdBy, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run([
            id,
            documentId,
            version,
            data.changeSummary || "Controlled document version created",
            data.content || null,
            data.fileUrl || null,
            data.fileName || null,
            data.fileSize || null,
            data.checksum ||
                hash(`${documentId}:${version}:${data.content || data.fileUrl || ""}`),
            actorName(actor),
            createdAt,
        ]);
        const updates = {
            version,
            status: data.status || "Draft",
            updatedAt: createdAt,
        };
        for (const key of ["content", "fileUrl", "fileName", "fileSize"]) {
            if (data[key] !== undefined)
                updates[key] = data[key];
        }
        await this.updateDocument(db, documentId, updates);
        await saveDb(db);
        return { id, documentId, version, createdAt, ...data };
    }
    async listVersions(documentId) {
        const db = await getDb();
        return allRows(db, "SELECT * FROM document_versions WHERE documentId = ? ORDER BY createdAt DESC", [documentId]);
    }
    async submitForReview(documentId, data, actor) {
        const db = await getDb();
        const document = await this.getDocument(db, documentId);
        const version = String(data.version || document?.version || "1.0");
        const createdAt = now();
        const approval = {
            id: uuidv4(),
            documentId,
            version,
            step: "review",
            status: "Pending",
            approverId: data.reviewerId || null,
            approverName: data.reviewerName || data.reviewer || null,
            comments: data.comments || null,
            decidedAt: null,
            createdAt,
        };
        db.prepare(`INSERT INTO document_approvals
       (id, documentId, version, step, status, approverId, approverName, comments, decidedAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(Object.values(approval));
        await this.updateDocument(db, documentId, {
            status: "Under Review",
            reviewer: data.reviewerName ||
                data.reviewer ||
                document?.reviewer ||
                actorName(actor),
            reviewDate: createdAt,
            updatedAt: createdAt,
        });
        await saveDb(db);
        return approval;
    }
    async approve(documentId, data, actor) {
        const db = await getDb();
        const document = await this.getDocument(db, documentId);
        const version = String(data.version || document?.version || "1.0");
        const decidedAt = now();
        const approval = {
            id: uuidv4(),
            documentId,
            version,
            step: "approval",
            status: data.status || "Approved",
            approverId: actor?.id || data.approverId || null,
            approverName: actorName(actor),
            comments: data.comments || null,
            decidedAt,
            createdAt: decidedAt,
        };
        db.prepare(`INSERT INTO document_approvals
       (id, documentId, version, step, status, approverId, approverName, comments, decidedAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(Object.values(approval));
        const effectiveDate = data.effectiveDate || decidedAt;
        const reviewCycleDays = Number(data.reviewCycleDays || document?.reviewCycleDays || 365);
        const nextReviewDate = new Date(new Date(effectiveDate).getTime() + reviewCycleDays * 86400000).toISOString();
        await this.updateDocument(db, documentId, {
            status: approval.status === "Rejected" ? "Draft" : "Approved",
            approver: actorName(actor),
            approvalDate: decidedAt,
            effectiveDate,
            reviewCycleDays,
            nextReviewDate,
            updatedAt: decidedAt,
        });
        await saveDb(db);
        return approval;
    }
    async markObsolete(documentId, data, actor) {
        const db = await getDb();
        const updatedAt = now();
        await this.updateDocument(db, documentId, {
            status: "Obsolete",
            obsoleteReason: data.reason || data.obsoleteReason || "Superseded or withdrawn",
            updatedAt,
        });
        db.prepare(`INSERT INTO document_approvals
       (id, documentId, version, step, status, approverName, comments, decidedAt, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run([
            uuidv4(),
            documentId,
            String(data.version || "current"),
            "obsolete",
            "Approved",
            actorName(actor),
            data.reason || null,
            updatedAt,
            updatedAt,
        ]);
        await saveDb(db);
        return {
            documentId,
            status: "Obsolete",
            obsoleteReason: data.reason || data.obsoleteReason,
        };
    }
    async acknowledge(documentId, documentVersion, actor, requestMeta) {
        const db = await getDb();
        const acknowledgement = {
            id: uuidv4(),
            documentId,
            documentVersion,
            userId: actor.id || actor.email || "unknown",
            userEmail: actor.email || "unknown",
            userName: actorName(actor),
            acknowledgedAt: now(),
            ipAddress: requestMeta?.ip || null,
            userAgent: requestMeta?.userAgent || null,
        };
        db.prepare(`INSERT OR REPLACE INTO document_acknowledgements
       (id, documentId, documentVersion, userId, userEmail, userName, acknowledgedAt, ipAddress, userAgent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(Object.values(acknowledgement));
        await saveDb(db);
        return acknowledgement;
    }
    async listAcknowledgements(documentId) {
        const db = await getDb();
        return allRows(db, "SELECT * FROM document_acknowledgements WHERE documentId = ? ORDER BY acknowledgedAt DESC", [documentId]);
    }
    async acknowledgementReport() {
        const db = await getDb();
        return allRows(db, `SELECT d.id, d.title, d.code, d.documentNo, d.version, d.status,
              COUNT(a.id) AS acknowledgements,
              MAX(a.acknowledgedAt) AS lastAcknowledgedAt
       FROM documents d
       LEFT JOIN document_acknowledgements a ON a.documentId = d.id AND a.documentVersion = d.version
       WHERE d.status = 'Approved'
       GROUP BY d.id, d.title, d.code, d.documentNo, d.version, d.status
       ORDER BY d.title ASC`);
    }
    async createAccessLink(documentId, data, actor) {
        const db = await getDb();
        const token = randomBytes(24).toString("hex");
        const createdAt = now();
        const expiresAt = data.expiresAt ||
            new Date(Date.now() + Number(data.ttlHours || 24) * 3600000).toISOString();
        const link = {
            id: uuidv4(),
            documentId,
            tokenHash: hash(token),
            purpose: data.purpose || "download",
            createdBy: actorName(actor),
            expiresAt,
            downloadCount: 0,
            createdAt,
        };
        db.prepare(`INSERT INTO document_access_links
       (id, documentId, tokenHash, purpose, createdBy, expiresAt, downloadCount, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(Object.values(link));
        await saveDb(db);
        return {
            ...link,
            token: undefined,
            signedUrl: `/api/documents/${documentId}/download?token=${token}`,
        };
    }
    async getDocument(db, documentId) {
        return allRows(db, "SELECT * FROM documents WHERE id = ?", [documentId])[0];
    }
    async updateDocument(db, documentId, updates) {
        const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
        if (!entries.length)
            return;
        db.prepare(`UPDATE documents SET ${entries.map(([key]) => `${key} = ?`).join(", ")} WHERE id = ?`).run([...entries.map(([, value]) => value), documentId]);
    }
}
