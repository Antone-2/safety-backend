declare const router: import("express-serve-static-core").Router;
export interface GoogleFormsErrorInfo {
    statusCode: number;
    message: string;
    details: string;
    hint: string;
}
export declare function classifyGoogleFormsError(error: unknown): GoogleFormsErrorInfo;
export default router;
