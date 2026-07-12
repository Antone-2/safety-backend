import { Scaffold, CreateScaffoldInput, UpdateScaffoldInput, ScaffoldStats } from "./scaffolding.types.js";
import { ScaffoldRepository } from "./scaffolding.repository.js";
export declare class ScaffoldService {
    private repository;
    constructor(repository: ScaffoldRepository);
    getAll(filters?: Record<string, unknown>): Promise<Scaffold[]>;
    getById(id: string): Promise<Scaffold | null>;
    create(data: CreateScaffoldInput): Promise<Scaffold>;
    update(id: string, data: UpdateScaffoldInput): Promise<Scaffold | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<ScaffoldStats>;
}
