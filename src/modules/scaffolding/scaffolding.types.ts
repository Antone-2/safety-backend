import { z } from "zod";

export const ScaffoldStatusSchema = z.enum(["Erected", "In Use", "Under Inspection", "Dismantled", "Tagged Out"]);
export type ScaffoldStatus = z.infer<typeof ScaffoldStatusSchema>;

export interface Scaffold {
  id: string;
  scaffoldNo?: string;
  location: string;
  building: string;
  floor?: string;
  room?: string;
  type: string;
  height: number;
  length?: number;
  width?: number;
  erectedBy: string;
  erectedDate?: string;
  inspectedBy?: string;
  inspectedDate?: string;
  nextInspectionDate?: string;
  status: ScaffoldStatus;
  tagNumber?: string;
  photos: string[];
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateScaffoldSchema = z.object({
  location: z.string().min(1).max(200),
  building: z.string().min(1).max(100),
  floor: z.string().max(50).optional(),
  room: z.string().max(100).optional(),
  type: z.string().min(1).max(100),
  height: z.number().min(0),
  length: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  erectedBy: z.string().min(1).max(200),
  erectedDate: z.string().optional(),
  inspectedBy: z.string().max(200).optional(),
  inspectedDate: z.string().optional(),
  nextInspectionDate: z.string().optional(),
  status: ScaffoldStatusSchema.default("Erected"),
  tagNumber: z.string().max(50).optional(),
  photos: z.array(z.string()).optional().default([]),
  notes: z.string().max(2000).optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateScaffoldInput = z.infer<typeof CreateScaffoldSchema>;

export const UpdateScaffoldSchema = z.object({
  location: z.string().min(1).max(200).optional(),
  building: z.string().min(1).max(100).optional(),
  floor: z.string().max(50).optional().nullable(),
  room: z.string().max(100).optional().nullable(),
  type: z.string().min(1).max(100).optional(),
  height: z.number().min(0).optional(),
  length: z.number().min(0).optional().nullable(),
  width: z.number().min(0).optional().nullable(),
  erectedBy: z.string().min(1).max(200).optional(),
  erectedDate: z.string().optional().nullable(),
  inspectedBy: z.string().max(200).optional().nullable(),
  inspectedDate: z.string().optional().nullable(),
  nextInspectionDate: z.string().optional().nullable(),
  status: ScaffoldStatusSchema.optional(),
  tagNumber: z.string().max(50).optional().nullable(),
  photos: z.array(z.string()).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type UpdateScaffoldInput = z.infer<typeof UpdateScaffoldSchema>;

export interface ScaffoldStats {
  total: number;
  inUse: number;
  needsInspection: number;
  taggedOut: number;
}
