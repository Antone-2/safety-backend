import { randomUUID } from "crypto";
import { sendTestEmail } from "../lib/email.js";
import { getDbClient } from "../shared/infrastructure/database/postgres.client.js";
import { logger } from "../shared/utils/logger.js";
const DAY_MS = 24 * 60 * 60 * 1000;
export function reporterPointsForSeverity(severity) {
    if (severity === "Critical")
        return 3;
    if (severity === "Low")
        return 1;
    return 2;
}
export function leaderboardMonth(value) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
export async function awardReporterPoints(input) {
    const reporter = input.reporter.trim();
    if (input.anonymous || !reporter || reporter.toLowerCase() === "anonymous")
        return;
    const client = await getDbClient();
    try {
        await client.query(`INSERT INTO reporter_points (month, reporter, report_count, points, updated_at)
       VALUES ($1, $2, 1, $3, NOW())
       ON CONFLICT (month, reporter) DO UPDATE SET
         report_count = reporter_points.report_count + 1,
         points = reporter_points.points + EXCLUDED.points,
         updated_at = NOW()`, [leaderboardMonth(input.date), reporter, reporterPointsForSeverity(input.severity)]);
    }
    finally {
        client.release();
    }
}
export async function runMonthlyLeaderboard(now = new Date(), topN = 3) {
    const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const month = leaderboardMonth(previousMonthDate);
    const client = await getDbClient();
    try {
        const winners = await client.query(`SELECT reporter, report_count, points
       FROM reporter_points
       WHERE month = $1
       ORDER BY points DESC, report_count DESC, reporter ASC
       LIMIT $2`, [month, topN]);
        const awarded = [];
        for (const [index, winner] of winners.rows.entries()) {
            const rank = index + 1;
            const inserted = await client.query(`INSERT INTO leaderboard_awards (month, reporter, rank, report_count, points)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (month, reporter, rank) DO NOTHING
         RETURNING id`, [month, winner.reporter, rank, winner.report_count, winner.points]);
            if (!inserted.rows[0])
                continue;
            awarded.push({ reporter: winner.reporter, rank, points: winner.points });
            const subject = `Crown EHS monthly safety award - Rank #${rank}`;
            const message = `Congratulations ${winner.reporter}! You ranked #${rank} for ${month} with ${winner.points} points from ${winner.report_count} safety reports. Thank you for helping make every workplace safer.`;
            const userResult = await client.query(`SELECT email FROM users
         WHERE active = TRUE AND (lower(email) = lower($1) OR lower(name) = lower($1))
         LIMIT 1`, [winner.reporter]);
            await client.query(`INSERT INTO notification_jobs
         (id, event_key, workflow, resource_type, resource_id, payload, status, created_by)
         VALUES ($1, 'leaderboard.monthly_award', 'monthly-leaderboard', 'leaderboard', $2, $3, 'completed', 'system')`, [randomUUID(), `${month}:${rank}`, JSON.stringify({ month, rank, ...winner, subject, message })]);
            if (userResult.rows[0]?.email) {
                try {
                    await sendTestEmail({ to: userResult.rows[0].email, subject, message });
                }
                catch (error) {
                    logger.warn({ err: error, reporter: winner.reporter }, "Leaderboard award email failed");
                }
            }
        }
        return { month, winners: winners.rows, awarded };
    }
    finally {
        client.release();
    }
}
export function startMonthlyLeaderboardScheduler() {
    if (!process.env.DATABASE_URL)
        return;
    const execute = () => runMonthlyLeaderboard().catch((error) => logger.warn({ err: error }, "Monthly leaderboard job failed"));
    setTimeout(execute, 15_000);
    const timer = setInterval(execute, DAY_MS);
    timer.unref();
}
