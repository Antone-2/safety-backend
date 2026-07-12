export class GoogleFormsClient {
    async submit(params) {
        const baseUrl = process.env.GOOGLE_FORMS_API_BASE_URL || process.env.GOOGLE_SHEETS_API_BASE_URL;
        if (!baseUrl) {
            console.warn("Google Forms API base URL not configured");
            return { success: false };
        }
        try {
            const response = await fetch(`${baseUrl}/forms/${params.formId}/responses`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params.data),
            });
            return { success: response.ok };
        }
        catch (error) {
            console.error("Google Forms submission failed:", error);
            return { success: false };
        }
    }
}
export class MockGoogleFormsClient {
    async submit(params) {
        console.log(`[Mock Google Forms] Form ${params.formId}:`, params.data);
        return { success: true };
    }
}
export function getGoogleFormsClient() {
    if (process.env.GOOGLE_FORMS_API_BASE_URL || process.env.GOOGLE_SHEETS_API_BASE_URL) {
        return new GoogleFormsClient();
    }
    return new MockGoogleFormsClient();
}
