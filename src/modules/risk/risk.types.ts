import { z } from "zod";

export const RiskLevelSchema = z.enum(["Low", "Medium", "High", "Critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export interface RiskMatrix {
  id: string;
  name: string;
  description?: string;
  likelihoodScale: Record<number, string>;
  severityScale: Record<number, string>;
  levels: Array<{
    label: string;
    minLikelihood: number;
    maxLikelihood: number;
    minSeverity: number;
    maxSeverity: number;
    color: string;
  }>;
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface RiskRegister {
  id: string;
  title: string;
  location: string;
  department: string;
  activity: string;
  hazard: string;
  existingControls: string;
  likelihood: number;
  severity: number;
  riskRating: number;
  riskLevel: RiskLevel;
  additionalControls?: string;
  residualLikelihood?: number;
  residualSeverity?: number;
  residualRiskRating?: number;
  residualRiskLevel?: RiskLevel;
  reviewDate?: string;
  reviewedBy?: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BowTie {
  id: string;
  title: string;
  topEvent: string;
  threats?: string;
  preventiveBarriers?: string;
  consequences?: string;
  recoveryBarriers?: string;
  location: string;
  department: string;
  createdBy: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateRiskMatrixSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  likelihoodScale: z.record(z.number(), z.string()),
  severityScale: z.record(z.number(), z.string()),
  levels: z.array(z.object({
    label: z.string().min(1).max(50),
    minLikelihood: z.number().min(1).max(5),
    maxLikelihood: z.number().min(1).max(5),
    minSeverity: z.number().min(1).max(5),
    maxSeverity: z.number().min(1).max(5),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  })),
  isDefault: z.boolean().default(false),
  createdBy: z.string().min(1).max(200),
});
export type CreateRiskMatrixInput = z.infer<typeof CreateRiskMatrixSchema>;

export const CreateRiskRegisterSchema = z.object({
  title: z.string().min(1).max(200),
  location: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  activity: z.string().min(1).max(500),
  hazard: z.string().min(1).max(500),
  existingControls: z.string().min(1).max(2000),
  likelihood: z.number().min(1).max(5),
  severity: z.number().min(1).max(5),
  additionalControls: z.string().max(2000).optional(),
  residualLikelihood: z.number().min(1).max(5).optional(),
  residualSeverity: z.number().min(1).max(5).optional(),
  reviewDate: z.string().optional(),
  reviewedBy: z.string().optional(),
  status: z.string().default("Active"),
  createdBy: z.string().min(1).max(200),
});
export type CreateRiskRegisterInput = z.infer<typeof CreateRiskRegisterSchema>;

export const UpdateRiskRegisterSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  location: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(100).optional(),
  activity: z.string().min(1).max(500).optional(),
  hazard: z.string().min(1).max(500).optional(),
  existingControls: z.string().min(1).max(2000).optional(),
  likelihood: z.number().min(1).max(5).optional(),
  severity: z.number().min(1).max(5).optional(),
  additionalControls: z.string().max(2000).optional(),
  residualLikelihood: z.number().min(1).max(5).optional(),
  residualSeverity: z.number().min(1).max(5).optional(),
  reviewDate: z.string().optional(),
  reviewedBy: z.string().optional(),
  status: z.string().optional(),
}).partial();
export type UpdateRiskRegisterInput = z.infer<typeof UpdateRiskRegisterSchema>;

export const CreateBowTieSchema = z.object({
  title: z.string().min(1).max(200),
  topEvent: z.string().min(1).max(500),
  threats: z.string().optional(),
  preventiveBarriers: z.string().optional(),
  consequences: z.string().optional(),
  recoveryBarriers: z.string().optional(),
  location: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  createdBy: z.string().min(1).max(200),
  status: z.string().default("Active"),
});
export type CreateBowTieInput = z.infer<typeof CreateBowTieSchema>;

export interface RiskDashboard {
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
}
