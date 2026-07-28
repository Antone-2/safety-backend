import { WibaRepository } from "./wiba.repository.js";
import type { WibaClaimInput, WibaClaimPatch } from "./wiba.types.js";
export declare class WibaService {
    private repository;
    constructor(repository: WibaRepository);
    getClaims(): Promise<{
        status: "Closed" | "Open" | "Pending" | "Unknown";
        id: string;
        stage: string;
        createdAt: string;
        updatedAt: string;
        claimNo: string;
        dateOfInjury: string;
        natureOfInjury: string;
        claimantName: string;
        outstandingDocuments: string[];
        remarks?: string | undefined;
        amountAwardedKes?: number | null | undefined;
        companyClaimKes?: number | null | undefined;
    }[]>;
    createClaim(data: WibaClaimInput): Promise<{
        status: "Closed" | "Open" | "Pending" | "Unknown";
        id: string;
        stage: string;
        createdAt: string;
        updatedAt: string;
        claimNo: string;
        dateOfInjury: string;
        natureOfInjury: string;
        claimantName: string;
        outstandingDocuments: string[];
        remarks?: string | undefined;
        amountAwardedKes?: number | null | undefined;
        companyClaimKes?: number | null | undefined;
    }>;
    updateClaim(id: string, data: WibaClaimPatch): Promise<{
        status: "Closed" | "Open" | "Pending" | "Unknown";
        id: string;
        stage: string;
        createdAt: string;
        updatedAt: string;
        claimNo: string;
        dateOfInjury: string;
        natureOfInjury: string;
        claimantName: string;
        outstandingDocuments: string[];
        remarks?: string | undefined;
        amountAwardedKes?: number | null | undefined;
        companyClaimKes?: number | null | undefined;
    } | null>;
    deleteClaim(id: string): Promise<{
        status: "Closed" | "Open" | "Pending" | "Unknown";
        id: string;
        stage: string;
        createdAt: string;
        updatedAt: string;
        claimNo: string;
        dateOfInjury: string;
        natureOfInjury: string;
        claimantName: string;
        outstandingDocuments: string[];
        remarks?: string | undefined;
        amountAwardedKes?: number | null | undefined;
        companyClaimKes?: number | null | undefined;
    } | null>;
}
