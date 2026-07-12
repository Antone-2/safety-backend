export declare class LlmClient {
    private apiKey;
    private baseUrl;
    private model;
    constructor();
    generate(systemPrompt: string, userPrompt: string, options?: {
        temperature?: number;
        maxTokens?: number;
    }): Promise<string>;
    classify(input: string, categories: string[], systemHint?: string): Promise<{
        category: string;
        confidence: number;
    }>;
    extract(input: string, schemaDescription: string): Promise<any>;
    private fallbackGenerate;
}
