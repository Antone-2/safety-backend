export declare function reporterPointsForSeverity(severity: string): number;
export declare function leaderboardMonth(value: Date | string): string;
export declare function awardReporterPoints(input: {
    date: Date | string;
    reporter: string;
    severity: string;
    anonymous?: boolean;
}): Promise<void>;
export declare function runMonthlyLeaderboard(now?: Date, topN?: number): Promise<{
    month: string;
    winners: {
        reporter: string;
        report_count: number;
        points: number;
    }[];
    awarded: {
        reporter: string;
        rank: number;
        points: number;
    }[];
}>;
export declare function startMonthlyLeaderboardScheduler(): void;
