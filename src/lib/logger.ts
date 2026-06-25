const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
type LogLevel = typeof LOG_LEVELS[number];

function getLogLevel(): LogLevel {
  return (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");
}

const currentLevel = getLogLevel();
const levelIndex = LOG_LEVELS.indexOf(currentLevel);

function log(level: LogLevel, args: unknown[]) {
  if (levelIndex < LOG_LEVELS.indexOf(level)) return;
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  switch (level) {
    case "debug":
      console.debug(prefix, ...args);
      break;
    case "info":
      console.info(prefix, ...args);
      break;
    case "warn":
      console.warn(prefix, ...args);
      break;
    case "error":
      console.error(prefix, ...args);
      break;
  }
}

export const logger = {
  debug: (...args: unknown[]) => log("debug", args),
  info: (...args: unknown[]) => log("info", args),
  warn: (...args: unknown[]) => log("warn", args),
  error: (...args: unknown[]) => log("error", args),
};
