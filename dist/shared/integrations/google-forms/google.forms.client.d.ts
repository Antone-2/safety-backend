export interface IGoogleFormsClient {
    submit(params: {
        formId: string;
        data: Record<string, unknown>;
    }): Promise<{
        success: boolean;
    }>;
}
export declare class GoogleFormsClient implements IGoogleFormsClient {
    submit(params: {
        formId: string;
        data: Record<string, unknown>;
    }): Promise<{
        success: boolean;
    }>;
}
export declare class MockGoogleFormsClient implements IGoogleFormsClient {
    submit(params: {
        formId: string;
        data: Record<string, unknown>;
    }): Promise<{
        success: boolean;
    }>;
}
export declare function getGoogleFormsClient(): IGoogleFormsClient;
