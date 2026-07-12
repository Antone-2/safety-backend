export declare class RagEngine {
    search(query: string, options?: {
        category?: string;
        maxResults?: number;
    }): Promise<Array<{
        title: string;
        excerpt: string;
        score: number;
    }>>;
    generateContext(query: string, maxChunks?: number): Promise<string>;
}
