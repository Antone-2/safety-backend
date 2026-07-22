export interface IGoogleFormsClient {
  submit(params: { formId: string; data: Record<string, unknown> }): Promise<{ success: boolean }>;
}

export class GoogleFormsClient implements IGoogleFormsClient {
  async submit(params: { formId: string; data: Record<string, unknown> }): Promise<{ success: boolean }> {
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
    } catch (error) {
      console.error("Google Forms submission failed:", error);
      return { success: false };
    }
  }
}

export function getGoogleFormsClient(): IGoogleFormsClient {
  return new GoogleFormsClient();
}
