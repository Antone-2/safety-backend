declare const router: import("express-serve-static-core").Router;
declare function broadcastReport(report: any): void;
declare function broadcastStats(stats: any): void;
export { broadcastReport, broadcastStats };
export default router;
