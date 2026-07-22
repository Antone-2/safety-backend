export declare function buildDriveFetchCandidates(fileId: string): string[];
export declare function buildReportPhotoStorageKey(reportId: string, contentType: string, originalName?: string): string;
export declare function storeReportPhotoFromDrive(reportId: string, sourceUrl: string, originalName?: string): Promise<boolean>;
export declare function getStoredReportPhoto(reportId: string): Promise<{
    data: Buffer;
    contentType: string;
} | null>;
