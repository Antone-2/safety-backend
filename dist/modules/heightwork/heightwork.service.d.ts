import { HeightWork, CreateHeightWorkInput, UpdateHeightWorkInput, HeightWorkStats } from "./heightwork.types.js";
import { HeightWorkRepository } from "./heightwork.repository.js";
export declare class HeightWorkService {
    private repository;
    constructor(repository: HeightWorkRepository);
    getAll(filters?: Record<string, unknown>): Promise<HeightWork[]>;
    getById(id: string): Promise<HeightWork | null>;
    create(data: CreateHeightWorkInput): Promise<HeightWork>;
    update(id: string, data: UpdateHeightWorkInput): Promise<HeightWork | null>;
    delete(id: string): Promise<boolean>;
    getStats(): Promise<HeightWorkStats>;
}
