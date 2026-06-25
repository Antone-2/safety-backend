import { Router, type Request, type Response, type NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { isFirebaseAvailable, getFirebase } from "../lib/firebase.js";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { LoginSchema, CreateUserSchema } from "../lib/types.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("FATAL: JWT_SECRET environment variable is required");
  process.exit(1);
}
const JWT_SECRET_VALUE = JWT_SECRET;
const RegisterSchema = CreateUserSchema.refine(
  (data) => data.role !== "sheq-manager",
  { message: "SHEQ Manager accounts must be created by an existing SHEQ Manager", path: ["role"] },
).refine(
  (data) => data.role !== "super-admin",
  { message: "Super Admin accounts must be created by an existing Super Admin", path: ["role"] },
);

function generateToken(user: { id: string; email: string; name: string; role: string }) {
  return jwt.sign({ userId: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET_VALUE, { expiresIn: "7d" });
}

function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else if (typeof req.query.token === "string" && req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET_VALUE) as { userId: string; email: string; name: string; role: string };
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

router.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const userSnap = await db.collection("users").where("email", "==", parsed.data.email).limit(1).get();
    if (userSnap.empty) return res.status(401).json({ error: "Invalid credentials" });
    const user = userSnap.docs[0].data();
    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    const token = generateToken({ id: userSnap.docs[0].id, email: user.email, name: user.name, role: user.role });
    return res.json({ token, user: { id: userSnap.docs[0].id, email: user.email, name: user.name, role: user.role } });
  }

  // SQLite fallback
  const db = await getDb();
  const user = (allRows(db, "SELECT * FROM users WHERE email = ?", [parsed.data.email])[0]) as any | undefined;
  if (!user) return res.status(401).json({ error: "Invalid credentials" });
  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });
  const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post("/register", async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const existing = await db.collection("users").where("email", "==", parsed.data.email).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: "Email already registered" });
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await db.collection("users").doc(id).set({ email: parsed.data.email, passwordHash, name: parsed.data.name, role: parsed.data.role, createdAt: new Date().toISOString() });
    const token = generateToken({ id, email: parsed.data.email, name: parsed.data.name, role: parsed.data.role });
    return res.status(201).json({ token, user: { id, email: parsed.data.email, name: parsed.data.name, role: parsed.data.role } });
  }

  // SQLite fallback
  const db = await getDb();
  const existing = allRows(db, "SELECT id FROM users WHERE email = ?", [parsed.data.email]);
  if (existing.length > 0) return res.status(409).json({ error: "Email already registered" });
  const id = uuidv4();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  db.prepare("INSERT INTO users (id, email, passwordHash, name, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run([id, parsed.data.email, passwordHash, parsed.data.name, parsed.data.role, new Date().toISOString()]);
  await saveDb(db);
  const token = generateToken({ id, email: parsed.data.email, name: parsed.data.name, role: parsed.data.role });
  res.status(201).json({ token, user: { id, email: parsed.data.email, name: parsed.data.name, role: parsed.data.role } });
});

router.get("/me", authMiddleware, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ user });
});

router.post("/logout", authMiddleware, (_req: Request, res: Response) => {
  res.json({ ok: true });
});

router.post("/users", authMiddleware, requireRole("super-admin", "sheq-manager"), async (req: Request, res: Response) => {
  const parsed = CreateUserSchema.safeParse(req.body);
  const caller = (req as any).user as { role?: string };

  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  // Only a super-admin is allowed to create another super-admin.
  if (parsed.data.role === "super-admin" && caller?.role !== "super-admin") {
    return res.status(403).json({ error: "Only super-admin can create super-admin users" });
  }


  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const existing = await db.collection("users").where("email", "==", parsed.data.email).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: "Email already registered" });
    const id = uuidv4();
    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    await db.collection("users").doc(id).set({ email: parsed.data.email, passwordHash, name: parsed.data.name, role: parsed.data.role, createdAt: new Date().toISOString() });
    const userSnap = await db.collection("users").doc(id).get();
    const user = userSnap.data();
    return res.status(201).json({ id, ...user });
  }

  // SQLite fallback
  const db = await getDb();
  const existing = allRows(db, "SELECT id FROM users WHERE email = ?", [parsed.data.email]);
  if (existing.length > 0) return res.status(409).json({ error: "Email already registered" });
  const id = uuidv4();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  db.prepare("INSERT INTO users (id, email, passwordHash, name, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run([id, parsed.data.email, passwordHash, parsed.data.name, parsed.data.role, new Date().toISOString()]);
  await saveDb(db);
  const user = (allRows(db, "SELECT id, email, name, role, createdAt FROM users WHERE id = ?", [id])[0]);
  res.status(201).json(user);
});

router.get("/", authMiddleware, requireRole("super-admin", "sheq-manager"), async (_req: Request, res: Response) => {
  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const usersSnap = await db.collection("users").orderBy("createdAt", "desc").get();
    return res.json(usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  }
  const db = await getDb();
  const users = allRows(db, "SELECT id, email, name, role, createdAt FROM users ORDER BY createdAt DESC") as any[];
  res.json(users);
});

router.patch("/:id", authMiddleware, requireRole("super-admin", "sheq-manager"), async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const doc = await db.collection("users").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "User not found" });
    const { name, role, password } = req.body as { name?: string; role?: string; password?: string };
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (password !== undefined) updates.passwordHash = await bcrypt.hash(password, 10);
    await doc.ref.update(updates);
    const updated = await doc.ref.get();
    return res.json({ id, ...updated.data() });
  }

  const db = await getDb();
  const row = (allRows(db, "SELECT * FROM users WHERE id = ?", [id])[0]) as any | undefined;
  if (!row) return res.status(404).json({ error: "User not found" });
  const { name, role, password } = req.body as any;
  if (name !== undefined) db.prepare("UPDATE users SET name = ? WHERE id = ?").run([name, id]);
  if (role !== undefined) db.prepare("UPDATE users SET role = ? WHERE id = ?").run([role, id]);
  if (password !== undefined) {
    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare("UPDATE users SET passwordHash = ? WHERE id = ?").run([passwordHash, id]);
  }
  await saveDb(db);
  const updated = (allRows(db, "SELECT id, email, name, role, createdAt FROM users WHERE id = ?", [id])[0]);
  res.json(updated);
});

router.delete("/:id", authMiddleware, requireRole("super-admin", "sheq-manager"), async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const doc = await db.collection("users").doc(id).get();
    if (!doc.exists) return res.status(404).json({ error: "User not found" });
    await doc.ref.delete();
    return res.json({ ok: true, deleted: id });
  }

  const db = await getDb();
  const row = (allRows(db, "SELECT id FROM users WHERE id = ?", [id])[0]) as any | undefined;
  if (!row) return res.status(404).json({ error: "User not found" });
  db.prepare("DELETE FROM users WHERE id = ?").run([id]);
  await saveDb(db);
  res.json({ ok: true, deleted: id });
});

export { authMiddleware };
export default router;