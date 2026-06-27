
import { saveDb } from "./database.js";

const MIGRATIONS_TABLE = `CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  appliedAt TEXT NOT NULL
)`;

const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: "001_create_reports",
    sql: `CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      location TEXT NOT NULL,
      reporter TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('Low','Medium','High','Critical')),
      status TEXT NOT NULL DEFAULT 'Open' CHECK(status IN ('Open','In Progress','Closed')),
      category TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Unsafe Act','Unsafe Condition')),
      resolutionDays INTEGER,
      slaHours INTEGER NOT NULL,
      dueAt TEXT NOT NULL,
      assignedTo TEXT,
      isNearMiss INTEGER NOT NULL DEFAULT 0,
      anonymous INTEGER NOT NULL DEFAULT 0,
      department TEXT NOT NULL,
      shift TEXT NOT NULL,
      complianceRequired INTEGER NOT NULL DEFAULT 0,
      complianceDueAt TEXT,
      photoUrl TEXT NOT NULL
    )`,
  },
  {
    name: "002_create_comments",
    sql: `CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      reportId TEXT NOT NULL,
      author TEXT NOT NULL,
      at TEXT NOT NULL,
      text TEXT NOT NULL
    )`,
  },
  {
    name: "003_create_capa",
    sql: `CREATE TABLE IF NOT EXISTS capa (
      id TEXT PRIMARY KEY,
      incidentId TEXT NOT NULL,
      rootCause TEXT NOT NULL,
      action TEXT NOT NULL,
      owner TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Pending' CHECK(status IN ('Pending','In Progress','Completed','Verified')),
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low','Medium','High','Critical'))
    )`,
  },
  {
    name: "004_create_settings",
    sql: `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  },
  {
    name: "005_create_users",
    sql: `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('sheq-manager','gm','plant-manager','factory-manager','depot-admin')),
      createdAt TEXT NOT NULL
    )`,
  },
  {
    name: "006_migrate_legacy_user_roles",
    sql: `UPDATE users SET role = 'sheq-manager' WHERE role IN ('admin','manager');
          UPDATE users SET role = 'factory-manager' WHERE role = 'supervisor';
          UPDATE users SET role = 'depot-admin' WHERE role = 'user';`,
  },
{
    name: "007_alter_users_role_constraint",
    sql: `CREATE TABLE IF NOT EXISTS users_new (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            passwordHash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('super-admin','sheq-manager','gm','plant-manager','factory-manager','depot-admin')),
            createdAt TEXT NOT NULL
          );
          INSERT OR IGNORE INTO users_new (id, email, passwordHash, name, role, createdAt)
          SELECT id, email, passwordHash, name, role, createdAt FROM users;
          DROP TABLE users;
          ALTER TABLE users_new RENAME TO users;
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  },
  {
    name: "008_create_indexes",
    sql: `CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
          CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity);
          CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(location);
          CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(date);
          CREATE INDEX IF NOT EXISTS idx_comments_reportId ON comments(reportId);
          CREATE INDEX IF NOT EXISTS idx_capa_incidentId ON capa(incidentId);
          CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  },
  {
    name: "009_create_notifications",
    sql: `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      reportId TEXT NOT NULL,
      channel TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      delivered INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      read INTEGER NOT NULL DEFAULT 0
    )`,
  },
  {
    name: "010_create_report_audit",
    sql: `CREATE TABLE IF NOT EXISTS report_audit (
      id TEXT PRIMARY KEY,
      reportId TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      detail TEXT,
      createdAt TEXT NOT NULL
    )`,
  },
  {
    name: "011_add_report_source",
    sql: `ALTER TABLE reports ADD COLUMN source TEXT NOT NULL DEFAULT 'google-sheets'`,
  },
  {
    name: "012_create_reporter_points",
    sql: `CREATE TABLE IF NOT EXISTS reporter_points (
      month TEXT NOT NULL,
      reporter TEXT NOT NULL,
      reportCount INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 0,
      updatedAt TEXT NOT NULL,
      PRIMARY KEY (month, reporter)
    )`,
  },
  {
    name: "013_create_leaderboard_awards",
    sql: `CREATE TABLE IF NOT EXISTS leaderboard_awards (
      id TEXT PRIMARY KEY,
      month TEXT NOT NULL,
      reporter TEXT NOT NULL,
      rank INTEGER NOT NULL,
      reportCount INTEGER NOT NULL,
      points INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(month, reporter, rank)
    )`,
  },
  {
    name: "014_create_leaderboard_indexes",
    sql: `CREATE INDEX IF NOT EXISTS idx_reporter_points_month ON reporter_points(month);
          CREATE INDEX IF NOT EXISTS idx_reporter_points_reporter ON reporter_points(reporter);
          CREATE INDEX IF NOT EXISTS idx_leaderboard_awards_month ON leaderboard_awards(month);
          CREATE INDEX IF NOT EXISTS idx_leaderboard_awards_reporter ON leaderboard_awards(reporter);`,
  },
  {
    name: "015_add_assigned_to_copy",
    sql: `ALTER TABLE reports ADD COLUMN assignedToCopy TEXT`,
  },
];

export async function seedAdminUsers(db: any) {
  const countRow = db.prepare("SELECT COUNT(*) as c FROM users").getAsObject() as { c: number | string | null };
  const count = Number(countRow.c ?? 0);

  if (count === 0) {
    const { v4: uuidv4 } = await import("uuid");
    const bcrypt = await import("bcryptjs");

    const superAdminId = uuidv4();
    const sheqManagerId = uuidv4();

    const superAdminPassword = await bcrypt.hash("admin123", 10);
    const sheqManagerPassword = await bcrypt.hash("sheq123", 10);

    db.prepare("INSERT INTO users (id, email, passwordHash, name, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run([
      superAdminId,
      "admin@crownpaints.co.ke",
      superAdminPassword,
      "Super Admin",
      "super-admin",
      new Date().toISOString(),
    ]);

    db.prepare("INSERT INTO users (id, email, passwordHash, name, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run([
      sheqManagerId,
      "sheq@crownpaints.co.ke",
      sheqManagerPassword,
      "SHEQ Manager",
      "sheq-manager",
      new Date().toISOString(),
    ]);

    await saveDb(db);
    console.log("Seeded default users: super-admin@crownpaints.co.ke / sheq-manager@crownpaints.co.ke");
  }
}

export async function runMigrations(db: any) {

  db.run(MIGRATIONS_TABLE);

  for (const migration of MIGRATIONS) {
    const stmt = db.prepare("SELECT id FROM migrations WHERE name = ?");
    const applied = stmt.getAsObject([migration.name]);
    stmt.free();
    if (!applied.id) {
      db.run(migration.sql);
      const insert = db.prepare("INSERT INTO migrations (name, appliedAt) VALUES (?, ?)");
      insert.run([migration.name, new Date().toISOString()]);
      insert.free();
      console.log(`Migration ${migration.name} applied`);
    }
  }

}

export async function ensureSchema(db: any) {
  db.run(MIGRATIONS_TABLE);

  for (const migration of MIGRATIONS) {
    const stmt = db.prepare("SELECT id FROM migrations WHERE name = ?");
    const applied = stmt.getAsObject([migration.name]);
    stmt.free();
    if (!applied.id) {
      db.run(migration.sql);
      const insert = db.prepare("INSERT INTO migrations (name, appliedAt) VALUES (?, ?)");
      insert.run([migration.name, new Date().toISOString()]);
      insert.free();
    }
  }
}

export function addMigration(name: string, sql: string) {
  MIGRATIONS.push({ name, sql });
}
