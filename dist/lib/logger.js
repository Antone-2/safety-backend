const LOG_LEVELS = ["debug", "info", "warn", "error"];
function getLogLevel() {
    return process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug");
}
const currentLevel = getLogLevel();
const levelIndex = LOG_LEVELS.indexOf(currentLevel);
function log(level, args) {
    if (levelIndex < LOG_LEVELS.indexOf(level))
        return;
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
    debug: (...args) => log("debug", args),
    info: (...args) => log("info", args),
    warn: (...args) => log("warn", args),
    error: (...args) => log("error", args),
};
