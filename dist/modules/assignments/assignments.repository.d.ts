import type { PoolClient } from "pg";
import type { AssignmentRecord } from "./assignments.types.js";
type Queryable = Pick<PoolClient, "query">;
export declare function mapAssignment(row: Record<string, unknown>): AssignmentRecord;
export declare class AssignmentsRepository {
    transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T>;
    findById(id: string, client?: Queryable): Promise<AssignmentRecord | null>;
    list(filters: {
        email?: string;
        reportId?: string;
        status?: string;
        site?: string;
        department?: string;
    }): Promise<AssignmentRecord[]>;
    timeline(id: string): Promise<any[]>;
}
export declare const assignmentsRepository: AssignmentsRepository;
export {};
