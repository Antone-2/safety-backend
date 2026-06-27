// import { randomUUID } from "crypto";
// (no direct sql.js types needed; db is treated as any)

const monthKeyFromDate = (date: Date) => {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
};

export type SeverityPoints = {
  Low: number;
  Medium: number;
  High: number;
  Critical: number;
};

const DEFAULT_SEVERITY_POINTS: SeverityPoints = {
  Low: 1,
  Medium: 2,
  High: 2,
  Critical: 3,
};

export function pointsForSeverity(severity: string, weights: SeverityPoints = DEFAULT_SEVERITY_POINTS) {
  if (severity in weights) return (weights as any)[severity] as number;
  return 1;
}

export function monthKeyFromIso(iso: string) {
  const d = new Date(iso);
  return monthKeyFromDate(d);
}

function upsertReporterPoints(db: any, month: string, reporter: string, additionalPoints: number) {
  const now = new Date().toISOString();

  const row = db
    .prepare("SELECT reportCount, points FROM reporter_points WHERE month = ? AND reporter = ?")
    .getAsObject([month, reporter]) as { reportCount?: number; points?: number } | undefined;

  if (!row) {
    db
      .prepare(
        "INSERT INTO reporter_points (month, reporter, reportCount, points, updatedAt) VALUES (?, ?, ?, ?, ?)",
      )
      .run([month, reporter, 1, additionalPoints, now]);
    return;
  }

  db
    .prepare(
      "UPDATE reporter_points SET reportCount = ?, points = ?, updatedAt = ? WHERE month = ? AND reporter = ?",
    )
    .run([
      Number(row.reportCount ?? 0) + 1,
      Number(row.points ?? 0) + additionalPoints,
      now,
      month,
      reporter,
    ]);
}

export async function awardPointsForReport(db: any, report: { date: string; reporter: string; severity: string }) {
  const month = monthKeyFromIso(report.date);
  const pts = pointsForSeverity(report.severity);
  upsertReporterPoints(db, month, report.reporter, pts);
}

export type MonthlyAwardOptions = {
  topN?: number;
  /** ISO date time range reference; used only for choosing previous month */
  now?: Date;
};

export async function runMonthlyLeaderboardJob(db: any, options: MonthlyAwardOptions = {}) {
  const topN = options.topN ?? 3;
  const now = options.now ?? new Date();

  // previous month based on current time
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  prev.setUTCMonth(prev.getUTCMonth() - 1);
  const prevMonth = monthKeyFromDate(prev);

  const winners = allRows(db, `
    SELECT reporter, reportCount, points
    FROM reporter_points
    WHERE month = ?
    ORDER BY points DESC, reportCount DESC, reporter ASC
    LIMIT ?
  `, [prevMonth, topN]) as { reporter: string; reportCount: number; points: number }[];

  for (let i = 0; i < winners.length; i++) {
    const w = winners[i];
    const rank = i + 1;

    const existing = db
      .prepare(
        "SELECT id FROM leaderboard_awards WHERE month = ? AND reporter = ? AND rank = ?",
      )
      .getAsObject([prevMonth, w.reporter, rank]) as { id?: string } | undefined;

    if (existing?.id) continue;

    const awardId = `AWD-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const createdAt = new Date().toISOString();

    db
      .prepare(
        "INSERT INTO leaderboard_awards (id, month, reporter, rank, reportCount, points, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run([awardId, prevMonth, w.reporter, rank, w.reportCount, w.points, createdAt]);

    // create a notification (internal) for the reporter name
    const notificationId = `NOTIF-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const subject = "Monthly Safety Leaderboard";
    const message = `Congratulations ${w.reporter}! You ranked #${rank} for ${prevMonth} with ${w.points} points (${w.reportCount} reports). Thank you!`;

    db
      .prepare(
        "INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run([
        notificationId,
        `LEADERBOARD-${prevMonth}`,
        "internal",
        w.reporter,
        subject,
        message,
        0,
        createdAt,
        0,
      ]);
  }
}

function allRows(db: any, sql: string, params?: any[]) {
  const stmt = db.prepare(sql, params);
  const rows: any[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  return rows;
}

export async function maybeRunMonthlyLeaderboardJob(db: any, settingsRow?: { value?: string }) {
  // stored as ISO string in settings key
  const settingsKey = "monthly_job_lastRunAt";
  const getLast = () => {
    const row =
      settingsRow ??
      (db
        .prepare("SELECT value FROM settings WHERE key = ?")
        .getAsObject([settingsKey]) as { value?: string } | undefined);
    const iso = row?.value ? String(row.value) : "";
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? d : null;
  };

  const lastRunAt = getLast();
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  if (lastRunAt && lastRunAt.toISOString().slice(0, 10) === todayKey) {
    return { ran: false, reason: "already ran today" };
  }

  await runMonthlyLeaderboardJob(db, { topN: 3, now });
  db
    .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
    .run([settingsKey, new Date().toISOString()]);

  return { ran: true };
}

