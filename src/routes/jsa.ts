import { Router } from "express";
import { authenticateUser, requireRole, type AuthRequest } from "../middleware/auth.js";
import { JsaService } from "../services/jsa.service.js";

const router = Router();
const jsaService = new JsaService();

router.get("/", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const filters: Record<string, any> = {};
    if (String(String(req.query.status))) filters.status = String(String(String(req.query.status)));
    if (String(String(req.query.location))) filters.location = String(String(String(req.query.location)));
    if (String(String(req.query.department))) filters.department = String(String(String(req.query.department)));
    const jsas = await jsaService.getJsaList(filters);
    res.json(jsas);
  } catch (error) {
    console.error("Failed to fetch JSAs:", error);
    res.status(500).json({ error: "Failed to fetch JSAs" });
  }
});

router.get("/:id", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const jsa = await jsaService.getJsaById(String(String(req.params.id)));
    if (!jsa) return res.status(404).json({ error: "JSA not found" });
    res.json(jsa);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch JSA" });
  }
});

router.post("/", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager", "supervisor"]), async (req: AuthRequest, res) => {
  try {
    const jsa = await jsaService.createJsa(req.body);
    res.status(201).json(jsa);
  } catch (error) {
    res.status(500).json({ error: "Failed to create JSA" });
  }
});

router.patch("/:id", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req: AuthRequest, res) => {
  try {
    const jsa = await jsaService.updateJsa(String(String(req.params.id)), req.body);
    res.json(jsa);
  } catch (error) {
    res.status(500).json({ error: "Failed to update JSA" });
  }
});

router.post("/:id/submit", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const jsa = await jsaService.submitForReview(String(String(req.params.id)));
    res.json(jsa);
  } catch (error) {
    res.status(500).json({ error: "Failed to submit JSA for review" });
  }
});

router.post("/:id/approve", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), async (req: AuthRequest, res) => {
  try {
    const { reviewedBy } = req.body;
    const jsa = await jsaService.approveJsa(String(String(req.params.id)), reviewedBy || req.user?.name || "Unknown");
    res.json(jsa);
  } catch (error) {
    res.status(500).json({ error: "Failed to approve JSA" });
  }
});

router.post("/:id/steps", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const jsa = await jsaService.addStep(String(String(req.params.id)), req.body);
    res.json(jsa);
  } catch (error) {
    res.status(500).json({ error: "Failed to add step" });
  }
});

export default router;

