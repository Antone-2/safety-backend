import { DEFAULT_WIBA_CLAIMS } from "./wiba.seed.js";
const now = () => new Date().toISOString();
function mapRow(row) {
    return {
        id: String(row.id),
        claimNo: String(row.claim_no),
        dateOfInjury: String(row.date_of_injury),
        natureOfInjury: String(row.nature_of_injury),
        claimantName: String(row.claimant_name),
        status: String(row.status),
        stage: String(row.stage ?? "None"),
        amountAwardedKes: row.amount_awarded_kes == null ? undefined : Number(row.amount_awarded_kes),
        companyClaimKes: row.company_claim_kes == null ? undefined : Number(row.company_claim_kes),
        outstandingDocuments: Array.isArray(row.outstanding_documents)
            ? row.outstanding_documents
            : [],
        remarks: row.remarks ? String(row.remarks) : undefined,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
export class WibaRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async seedDefaultsIfEmpty() {
        const countResult = await this.pool.query("SELECT COUNT(*)::int AS count FROM wiba_claims");
        const count = Number(countResult.rows[0]?.count ?? 0);
        if (count > 0)
            return;
        const insertedAt = now();
        for (const claim of DEFAULT_WIBA_CLAIMS) {
            await this.pool.query(`INSERT INTO wiba_claims (
          id,
          claim_no,
          date_of_injury,
          nature_of_injury,
          claimant_name,
          status,
          stage,
          amount_awarded_kes,
          company_claim_kes,
          outstanding_documents,
          remarks,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid()::text,
          $1,
          $2::date,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9::jsonb,
          $10,
          $11,
          $12
        )`, [
                claim.claimNo,
                claim.dateOfInjury,
                claim.natureOfInjury,
                claim.claimantName,
                claim.status,
                claim.stage,
                claim.amountAwardedKes ?? null,
                claim.companyClaimKes ?? null,
                JSON.stringify(claim.outstandingDocuments ?? []),
                claim.remarks ?? null,
                insertedAt,
                insertedAt,
            ]);
        }
    }
    async findAll() {
        const result = await this.pool.query(`
      SELECT *
      FROM wiba_claims
      ORDER BY date_of_injury DESC, created_at DESC
    `);
        return result.rows.map((row) => mapRow(row));
    }
    async findById(id) {
        const result = await this.pool.query("SELECT * FROM wiba_claims WHERE id = $1", [id]);
        return result.rows[0] ? mapRow(result.rows[0]) : null;
    }
    async create(data) {
        const result = await this.pool.query(`INSERT INTO wiba_claims (
        id,
        claim_no,
        date_of_injury,
        nature_of_injury,
        claimant_name,
        status,
        stage,
        amount_awarded_kes,
        company_claim_kes,
        outstanding_documents,
        remarks,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid()::text,
        $1,
        $2::date,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9::jsonb,
        $10,
        $11,
        $12
      )
      RETURNING *`, [
            data.claimNo,
            data.dateOfInjury,
            data.natureOfInjury,
            data.claimantName,
            data.status,
            data.stage,
            data.amountAwardedKes ?? null,
            data.companyClaimKes ?? null,
            JSON.stringify(data.outstandingDocuments ?? []),
            data.remarks ?? null,
            now(),
            now(),
        ]);
        return mapRow(result.rows[0]);
    }
    async update(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        const push = (column, value) => {
            fields.push(`${column} = $${idx}`);
            params.push(value);
            idx++;
        };
        if (data.claimNo !== undefined)
            push("claim_no", data.claimNo);
        if (data.dateOfInjury !== undefined)
            push("date_of_injury", data.dateOfInjury);
        if (data.natureOfInjury !== undefined)
            push("nature_of_injury", data.natureOfInjury);
        if (data.claimantName !== undefined)
            push("claimant_name", data.claimantName);
        if (data.status !== undefined)
            push("status", data.status);
        if (data.stage !== undefined)
            push("stage", data.stage);
        if (data.amountAwardedKes !== undefined)
            push("amount_awarded_kes", data.amountAwardedKes);
        if (data.companyClaimKes !== undefined)
            push("company_claim_kes", data.companyClaimKes);
        if (data.outstandingDocuments !== undefined) {
            push("outstanding_documents", JSON.stringify(data.outstandingDocuments));
        }
        if (data.remarks !== undefined)
            push("remarks", data.remarks);
        if (fields.length === 0) {
            const current = await this.pool.query("SELECT * FROM wiba_claims WHERE id = $1", [id]);
            return current.rows[0] ? mapRow(current.rows[0]) : null;
        }
        push("updated_at", now());
        params.push(id);
        const result = await this.pool.query(`UPDATE wiba_claims
       SET ${fields.join(", ")}
       WHERE id = $${idx}
       RETURNING *`, params);
        return result.rows[0] ? mapRow(result.rows[0]) : null;
    }
    async delete(id) {
        const result = await this.pool.query("DELETE FROM wiba_claims WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
}
