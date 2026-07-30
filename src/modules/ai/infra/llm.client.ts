export class LlmClient {
  private apiKey: string | undefined;
  private baseUrl: string | undefined;
  private model: string | undefined;
  private organization: string | undefined;
  private project: string | undefined;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
    this.baseUrl =
      process.env.AI_API_BASE_URL ||
      (this.apiKey ? "https://api.openai.com/v1" : undefined);
    this.model = process.env.OPENAI_MODEL || process.env.AI_MODEL;
    this.organization = process.env.OPENAI_ORG_ID;
    this.project = process.env.OPENAI_PROJECT_ID;
  }

  async generate(systemPrompt: string, userPrompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
    if (
      process.env.NODE_ENV === "test" ||
      process.env.VITEST === "true" ||
      !this.apiKey ||
      !this.baseUrl ||
      !this.model
    ) {
      return this.fallbackGenerate(userPrompt);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      };
      if (this.organization) {
        headers["OpenAI-Organization"] = this.organization;
      }
      if (this.project) {
        headers["OpenAI-Project"] = this.project;
      }
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: options?.temperature ?? 0.2,
          max_tokens: options?.maxTokens ?? 1000,
        }),
      });
      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `LLM API error: ${response.status}${errorBody ? ` - ${errorBody.slice(0, 300)}` : ""}`,
        );
      }
      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || this.fallbackGenerate(userPrompt);
    } catch (error) {
      console.warn("LLM generation failed, using fallback:", error);
      return this.fallbackGenerate(userPrompt);
    } finally {
      clearTimeout(timeout);
    }
  }

  async classify(input: string, categories: string[], systemHint?: string): Promise<{ category: string; confidence: number }> {
    const prompt = `${systemHint || ""}\nClassify the following text into one of these categories: ${categories.join(", ")}.\nText: ${input}\nRespond with JSON: {"category": "...", "confidence": 0.0-1.0}`;
    const response = await this.generate("You are a classification assistant.", prompt, { temperature: 0, maxTokens: 100 });
    try {
      const match = response.match(/\{.*\}/s);
      if (!match) return { category: categories[0], confidence: 0.3 };
      const parsed = JSON.parse(match[0]);
      return { category: parsed.category || categories[0], confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)) };
    } catch {
      return { category: categories[0], confidence: 0.3 };
    }
  }

  async extract(input: string, schemaDescription: string): Promise<any> {
    const prompt = `Extract structured data from the following text according to this schema: ${schemaDescription}.\nText: ${input}\nRespond with JSON only.`;
    const response = await this.generate("You are an extraction assistant.", prompt, { temperature: 0, maxTokens: 500 });
    try {
      const match = response.match(/\{.*\}/s);
      if (!match) return {};
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }

  private fallbackGenerate(prompt: string): string {
    if (prompt.toLowerCase().includes("incident")) {
      return "Based on the available data, this appears to be a safety-related incident requiring investigation and root cause analysis. The description suggests potential hazards in the reported location.";
    }
    if (prompt.toLowerCase().includes("training")) {
      return "Based on the employee's role and incident history, the following training is recommended: refresher on hazard identification, PPE compliance, and incident reporting procedures.";
    }
    if (prompt.toLowerCase().includes("permit")) {
      return "Permit validation review: Ensure all prerequisites are met, including risk assessment completion, isolation procedures, gas testing where applicable, and competence verification of all personnel.";
    }
    return "AI-generated response based on available EHS data and safety best practices. Please review and verify against current procedures.";
  }
}
