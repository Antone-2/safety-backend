import { z } from "zod";
export declare class BaseService {
    protected tableName: string;
    protected schema: z.ZodObject<any>;
    constructor(tableName: string, schema: z.ZodObject<any>);
    protected validate(data: any): {
        [x: string]: any;
    };
    private buildFilters;
    getAll(filters?: Record<string, any>): Promise<any[]>;
    getById(id: string): Promise<any | null>;
    create(data: Record<string, any>): Promise<any>;
    update(id: string, data: Record<string, any>): Promise<any>;
    delete(id: string): Promise<boolean>;
    count(filters?: Record<string, any>): Promise<number>;
}
