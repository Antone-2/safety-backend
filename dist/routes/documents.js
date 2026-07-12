import { Router } from "express";
import { authenticateUser, requireRole, } from "../middleware/auth.js";
import { DocumentService } from "../services/document.service.js";
import { DocumentControlService } from "../services/document-control.service.js";
const router = Router();
const documentService = new DocumentService();
const documentControl = new DocumentControlService();
const documentManagers = [
    "super-admin",
    "EHS-manager",
    "hse-officer",
    "plant-manager",
    "factory-manager",
];
router.get("/", authenticateUser, async (_req, res) => {
    try {
        const documents = await documentService.getAll();
        res.json(documents);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch documents" });
    }
});
router.get("/stats", authenticateUser, async (_req, res) => {
    try {
        const stats = await documentService.getStats();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch document stats" });
    }
});
router.get("/acknowledgements/report", authenticateUser, requireRole(documentManagers), async (_req, res) => {
    try {
        const report = await documentControl.acknowledgementReport();
        res.json(report);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch acknowledgement report" });
    }
});
router.get("/:id", authenticateUser, async (req, res) => {
    try {
        const document = await documentService.getById(String(req.params.id));
        if (!document)
            return res.status(404).json({ error: "Document not found" });
        res.json(document);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch document" });
    }
});
router.post("/", authenticateUser, requireRole(documentManagers), async (req, res) => {
    try {
        const document = await documentService.createDocument({
            ...req.body,
            createdBy: req.user?.name || "System",
        });
        res.status(201).json(document);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create document" });
    }
});
router.patch("/:id", authenticateUser, requireRole(documentManagers), async (req, res) => {
    try {
        const document = await documentService.update(String(req.params.id), req.body);
        res.json(document);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update document" });
    }
});
router.get("/:id/versions", authenticateUser, async (req, res) => {
    try {
        const versions = await documentControl.listVersions(String(req.params.id));
        res.json(versions);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch document versions" });
    }
});
router.post("/:id/versions", authenticateUser, requireRole(documentManagers), async (req, res) => {
    try {
        const version = await documentControl.createVersion(String(req.params.id), req.body, req.user);
        res.status(201).json(version);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create document version" });
    }
});
router.post("/:id/submit-review", authenticateUser, requireRole(documentManagers), async (req, res) => {
    try {
        const approval = await documentControl.submitForReview(String(req.params.id), req.body, req.user);
        res.status(201).json(approval);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to submit document for review" });
    }
});
router.post("/:id/approve", authenticateUser, requireRole([
    "super-admin",
    "EHS-manager",
    "plant-manager",
    "factory-manager",
]), async (req, res) => {
    try {
        const approval = await documentControl.approve(String(req.params.id), req.body, req.user);
        res.status(201).json(approval);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to approve document" });
    }
});
router.post("/:id/obsolete", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await documentControl.markObsolete(String(req.params.id), req.body, req.user);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to obsolete document" });
    }
});
router.post("/:id/acknowledge", authenticateUser, async (req, res) => {
    try {
        const document = await documentService.getById(String(req.params.id));
        if (!document)
            return res.status(404).json({ error: "Document not found" });
        const acknowledgement = await documentControl.acknowledge(String(req.params.id), String(req.body.version || document.version || "current"), req.user || {}, { ip: req.ip, userAgent: req.get("user-agent") });
        res.status(201).json(acknowledgement);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to acknowledge document" });
    }
});
router.get("/:id/acknowledgements", authenticateUser, requireRole(documentManagers), async (req, res) => {
    try {
        const acknowledgements = await documentControl.listAcknowledgements(String(req.params.id));
        res.json(acknowledgements);
    }
    catch (error) {
        res
            .status(500)
            .json({ error: "Failed to fetch document acknowledgements" });
    }
});
router.post("/:id/access-link", authenticateUser, requireRole(documentManagers), async (req, res) => {
    try {
        const link = await documentControl.createAccessLink(String(req.params.id), req.body, req.user);
        res.status(201).json(link);
    }
    catch (error) {
        res
            .status(500)
            .json({ error: "Failed to create signed document access link" });
    }
});
router.delete("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    try {
        const result = await documentService.delete(String(req.params.id));
        res.json({ success: result });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete document" });
    }
});
export default router;
