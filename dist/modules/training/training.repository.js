function toSnake(key) {
    return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}
const now = () => new Date().toISOString();
function asCourse(row) {
    return {
        id: String(row.id),
        title: String(row.title),
        code: String(row.code),
        category: String(row.category),
        description: row.description ? String(row.description) : undefined,
        duration: Number(row.duration),
        frequency: String(row.frequency),
        validityMonths: row.validity_months != null ? Number(row.validity_months) : undefined,
        competencyRequired: row.competency_required ? String(row.competency_required) : undefined,
        passingScore: Number(row.passing_score),
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
function asRecord(row) {
    return {
        id: String(row.id),
        recordNo: row.record_no ? String(row.record_no) : undefined,
        courseId: String(row.course_id),
        employeeId: String(row.employee_id),
        employeeName: String(row.employee_name),
        department: String(row.department),
        site: String(row.site),
        status: String(row.status),
        scheduledDate: String(row.scheduled_date),
        completedDate: row.completed_date ? String(row.completed_date) : undefined,
        trainer: row.trainer ? String(row.trainer) : undefined,
        score: row.score != null ? Number(row.score) : undefined,
        passed: row.passed != null ? Boolean(row.passed) : undefined,
        certificateUrl: row.certificate_url ? String(row.certificate_url) : undefined,
        expiryDate: row.expiry_date ? String(row.expiry_date) : undefined,
        feedback: row.feedback ? String(row.feedback) : undefined,
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
function asMatrix(row) {
    return {
        id: String(row.id),
        role: String(row.role),
        department: String(row.department),
        courseId: String(row.course_id),
        frequency: String(row.frequency),
        mandatory: Boolean(row.mandatory),
        createdBy: String(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}
export class TrainingRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async findCourses() {
        const result = await this.pool.query("SELECT * FROM training_courses ORDER BY created_at DESC");
        return result.rows.map(asCourse);
    }
    async findCourseById(id) {
        const result = await this.pool.query("SELECT * FROM training_courses WHERE id = $1", [id]);
        return result.rows[0] ? asCourse(result.rows[0]) : null;
    }
    async createCourse(data) {
        const result = await this.pool.query(`INSERT INTO training_courses (id, title, code, category, description, duration, frequency, validity_months, competency_required, passing_score, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`, [
            data.title,
            data.code,
            data.category,
            data.description ?? null,
            data.duration,
            data.frequency,
            data.validityMonths ?? null,
            data.competencyRequired ?? null,
            data.passingScore ?? 80,
            data.createdBy,
            now(),
            now(),
        ]);
        return asCourse(result.rows[0]);
    }
    async updateCourse(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        const map = {
            title: "title",
            code: "code",
            category: "category",
            description: "description",
            duration: "duration",
            frequency: "frequency",
            validityMonths: "validity_months",
            competencyRequired: "competency_required",
            passingScore: "passing_score",
            createdBy: "created_by",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && map[key]) {
                fields.push(`${map[key]} = $${idx}`);
                params.push(value);
                idx++;
            }
        });
        if (fields.length === 0)
            return this.findCourseById(id);
        fields.push(`updated_at = $${idx}`);
        params.push(now());
        params.push(id);
        const sql = `UPDATE training_courses SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
        const result = await this.pool.query(sql, params);
        return result.rows[0] ? asCourse(result.rows[0]) : null;
    }
    async deleteCourse(id) {
        const result = await this.pool.query("DELETE FROM training_courses WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async findRecords(filters) {
        const where = [];
        const params = [];
        let idx = 1;
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    const pgKey = toSnake(key);
                    where.push(`${pgKey} = $${idx}`);
                    params.push(value);
                    idx++;
                }
            });
        }
        const sql = `SELECT * FROM training_records ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
        const result = await this.pool.query(sql, params);
        return result.rows.map(asRecord);
    }
    async findRecordById(id) {
        const result = await this.pool.query("SELECT * FROM training_records WHERE id = $1", [id]);
        return result.rows[0] ? asRecord(result.rows[0]) : null;
    }
    async createRecord(data) {
        const recordNo = `TRN-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
        const result = await this.pool.query(`INSERT INTO training_records (id, record_no, course_id, employee_id, employee_name, department, site, status, scheduled_date, completed_date, trainer, score, passed, certificate_url, expiry_date, feedback, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`, [
            recordNo,
            data.courseId,
            data.employeeId,
            data.employeeName,
            data.department,
            data.site,
            data.status ?? "Scheduled",
            data.scheduledDate,
            data.completedDate ?? null,
            data.trainer ?? null,
            data.score ?? null,
            data.passed ?? null,
            data.certificateUrl ?? null,
            data.expiryDate ?? null,
            data.feedback ?? null,
            data.createdBy,
            now(),
            now(),
        ]);
        return asRecord(result.rows[0]);
    }
    async updateRecord(id, data) {
        const fields = [];
        const params = [];
        let idx = 1;
        const map = {
            courseId: "course_id",
            employeeId: "employee_id",
            employeeName: "employee_name",
            department: "department",
            site: "site",
            status: "status",
            scheduledDate: "scheduled_date",
            completedDate: "completed_date",
            trainer: "trainer",
            score: "score",
            passed: "passed",
            certificateUrl: "certificate_url",
            expiryDate: "expiry_date",
            feedback: "feedback",
        };
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && map[key]) {
                fields.push(`${map[key]} = $${idx}`);
                params.push(value);
                idx++;
            }
        });
        if (fields.length === 0)
            return this.findRecordById(id);
        fields.push(`updated_at = $${idx}`);
        params.push(now());
        params.push(id);
        const sql = `UPDATE training_records SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
        const result = await this.pool.query(sql, params);
        return result.rows[0] ? asRecord(result.rows[0]) : null;
    }
    async deleteRecord(id) {
        const result = await this.pool.query("DELETE FROM training_records WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async findMatrix(filters) {
        const where = [];
        const params = [];
        let idx = 1;
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    const pgKey = toSnake(key);
                    where.push(`${pgKey} = $${idx}`);
                    params.push(value);
                    idx++;
                }
            });
        }
        const sql = `SELECT * FROM training_matrices ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
        const result = await this.pool.query(sql, params);
        return result.rows.map(asMatrix);
    }
    async createMatrix(data) {
        const result = await this.pool.query(`INSERT INTO training_matrices (id, role, department, course_id, frequency, mandatory, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`, [
            data.role,
            data.department,
            data.courseId,
            data.frequency,
            data.mandatory,
            data.createdBy,
            now(),
            now(),
        ]);
        return asMatrix(result.rows[0]);
    }
    async deleteMatrix(id) {
        const result = await this.pool.query("DELETE FROM training_matrices WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async countRecords(filters) {
        const where = [];
        const params = [];
        let idx = 1;
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") {
                    const pgKey = toSnake(key);
                    where.push(`${pgKey} = $${idx}`);
                    params.push(value);
                    idx++;
                }
            });
        }
        const sql = `SELECT COUNT(*) as count FROM training_records ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""}`;
        const result = await this.pool.query(sql, params);
        return parseInt(result.rows[0]?.count ?? "0", 10);
    }
}
