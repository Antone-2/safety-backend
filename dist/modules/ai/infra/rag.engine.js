import { allRows, getDb } from "../../../lib/database.js";
export class RagEngine {
    async search(query, options) {
        const maxResults = options?.maxResults ?? 5;
        const db = await getDb();
        let sql = "SELECT title, content, category FROM ai_documents WHERE 1=1";
        const params = [];
        if (options?.category) {
            sql += ` AND category = ?`;
            params.push(options.category);
        }
        const rows = allRows(db, sql, params);
        const queryLower = query.toLowerCase();
        const scored = rows
            .map((row) => {
            const contentLower = row.content.toLowerCase();
            const titleLower = row.title.toLowerCase();
            const titleMatches = (titleLower.match(new RegExp(queryLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
            const contentMatches = (contentLower.match(new RegExp(queryLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
            const score = titleMatches * 2 + contentMatches * 1;
            return { ...row, score };
        })
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
        return scored.map((r) => {
            const idx2 = r.content.toLowerCase().indexOf(queryLower);
            const start = Math.max(0, idx2 - 120);
            const end = Math.min(r.content.length, idx2 + 180);
            const excerpt = (start > 0 ? "..." : "") + r.content.slice(start, end) + (end < r.content.length ? "..." : "");
            return { title: r.title, excerpt, score: r.score };
        });
    }
    async generateContext(query, maxChunks = 5) {
        const results = await this.search(query, { maxResults: maxChunks });
        if (results.length === 0)
            return "";
        return results.map((r, i) => `[Source ${i + 1}: ${r.title}]\n${r.excerpt}`).join("\n\n");
    }
}
