export declare class AiRepository {
    savePrediction(feature: string, inputHash: string, output: any, modelVersion: string, confidence: number, userId?: string): Promise<string>;
    getPrediction(id: string): Promise<any>;
    listPredictions(filters?: {
        feature?: string;
        userId?: string;
        limit?: number;
    }): Promise<any[]>;
    saveChatSession(input: {
        conversationId: string;
        userId: string;
        history: Array<{
            role: string;
            content: string;
        }>;
        latestResponse?: unknown;
        title?: string;
        pinned?: boolean;
    }): Promise<string>;
    getLatestChatSession(userId: string): Promise<{
        conversationId: string;
        userId: string;
        title: string;
        pinned: boolean;
        history: any;
        result: any;
        createdAt: string;
        updatedAt: string;
    } | null>;
    getChatSession(userId: string, conversationId: string): Promise<{
        conversationId: string;
        userId: string;
        history: any;
        result: any;
        createdAt: string;
        updatedAt: string;
    } | null>;
    listChatSessions(userId: string, limit?: number): Promise<{
        conversationId: string;
        userId: string;
        title: string;
        pinned: boolean;
        preview: string | undefined;
        sourceCount: any;
        hasSources: boolean;
        messageCount: number;
        createdAt: string;
        updatedAt: string;
    }[]>;
    updateChatSessionTitle(userId: string, conversationId: string, title: string): Promise<boolean>;
    updateChatSessionPinned(userId: string, conversationId: string, pinned: boolean): Promise<boolean>;
    deleteChatSession(userId: string, conversationId: string): Promise<boolean>;
    saveDocument(document: {
        title: string;
        content: string;
        category: string;
        source: string;
        embedding?: string;
    }): Promise<string>;
    listDocuments(filters?: {
        category?: string;
        limit?: number;
    }): Promise<any[]>;
    saveKnowledgeChunk(chunk: {
        chunkText: string;
        embedding?: string;
        sourceDocumentId?: string;
        section?: string;
    }): Promise<string>;
    listKnowledgeChunks(filters?: {
        sourceDocumentId?: string;
        limit?: number;
    }): Promise<any[]>;
    saveFeedback(feedback: {
        feature: string;
        predictionId?: string;
        userId: string;
        rating: number;
        feedbackText?: string;
    }): Promise<string>;
    getFeedbackStats(feature?: string): Promise<{
        feature: any;
        avgRating: number;
        count: number;
    }[]>;
    getGuardrailSettings(): Promise<any>;
    updateGuardrailSettings(data: Record<string, any>, updatedBy?: string): Promise<any>;
    savePromptAudit(input: {
        userId?: string;
        userEmail?: string;
        userRole?: string;
        feature: string;
        prompt: string;
        responseSummary?: string;
        modelVersion: string;
        confidence?: number;
        sources?: string[];
        warnings?: string[];
        denied?: boolean;
        denialReason?: string;
    }): Promise<string>;
    listPromptAudit(filters?: {
        feature?: string;
        userId?: string;
        limit?: number;
    }): Promise<any[]>;
}
