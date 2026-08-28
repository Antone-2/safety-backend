import type { AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { MocRepository } from "./moc.repository.js";
import type { CreateMocInput, MocTransitionInput, UpdateMocInput } from "./moc.types.js";
export declare class MocService {
    private repository;
    constructor(repository: MocRepository);
    getRecords(filters?: Record<string, unknown>): Promise<import("./moc.types.js").MocRecord[]>;
    getById(id: string): Promise<import("./moc.types.js").MocRecord | null>;
    create(data: CreateMocInput): Promise<import("./moc.types.js").MocRecord>;
    update(id: string, data: UpdateMocInput): Promise<import("./moc.types.js").MocRecord | null>;
    delete(id: string): Promise<boolean>;
    transition(id: string, input: MocTransitionInput, actor: AuthRequest["user"]): Promise<import("./moc.types.js").MocRecord | null>;
    getStats(): Promise<import("./moc.types.js").MocStats>;
}
