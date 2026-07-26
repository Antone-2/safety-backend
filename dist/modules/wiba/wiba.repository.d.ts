import { Pool } from "pg";
import type { WibaClaim, WibaClaimInput, WibaClaimPatch } from "./wiba.types.js";
export declare class WibaRepository {
    private pool;
    constructor(pool: Pool);
    seedDefaultsIfEmpty(): Promise<void>;
    findAll(): Promise<WibaClaim[]>;
    create(data: WibaClaimInput): Promise<WibaClaim>;
    update(id: string, data: WibaClaimPatch): Promise<WibaClaim | null>;
}
