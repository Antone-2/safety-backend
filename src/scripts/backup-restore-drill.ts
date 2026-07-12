import "dotenv/config";
import { spawnSync } from "child_process";
import { logger } from "../shared/utils/logger.js";

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.status}`,
    );
  }
}

async function main() {
  const backupFile = process.argv[2];
  const drillDatabaseUrl = process.env.RESTORE_DRILL_DATABASE_URL;
  if (!backupFile) {
    throw new Error(
      "Usage: npm run db:restore:drill -- <backup.sql.gz|backup.sql.gz.enc>",
    );
  }
  if (!drillDatabaseUrl) {
    throw new Error(
      "Set RESTORE_DRILL_DATABASE_URL to a disposable database before running a restore drill.",
    );
  }

  logger.info({ backupFile }, "Starting backup restore drill");
  run("npm", ["run", "db:restore", "--", backupFile], {
    ...process.env,
    DATABASE_URL: drillDatabaseUrl,
  });
  run("npm", ["run", "db:migrate:dry"], {
    ...process.env,
    DATABASE_URL: drillDatabaseUrl,
  });
  logger.info("Backup restore drill completed successfully");
}

main().catch((error) => {
  logger.error({ err: error as Error }, "Backup restore drill failed");
  process.exit(1);
});
