import {
  LegalRegisterEntry,
  LegalObligation,
  ObligationReview,
  ObligationEvidence,
  ObligationAction,
  CreateLegalRegisterEntryInput,
  UpdateLegalRegisterEntryInput,
  CreateLegalObligationInput,
  UpdateLegalObligationInput,
  CreateObligationReviewInput,
  UpdateObligationReviewInput,
  CreateObligationEvidenceInput,
  CreateObligationActionInput,
  UpdateObligationActionInput,
  LegalRegisterDashboard,
} from "./legal-register.types.js";
import { LegalRegisterRepository } from "./legal-register.repository.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";

export class LegalRegisterService {
  constructor(private repository: LegalRegisterRepository) {}

  async getDashboard(): Promise<LegalRegisterDashboard> {
    return this.repository.getDashboard();
  }

  async getRegisterEntries(filters?: Record<string, unknown>): Promise<LegalRegisterEntry[]> {
    return this.repository.getRegisterEntries(filters);
  }

  async getRegisterEntryById(id: string): Promise<LegalRegisterEntry | null> {
    return this.repository.getRegisterEntryById(id);
  }

  async createRegisterEntry(data: CreateLegalRegisterEntryInput): Promise<LegalRegisterEntry> {
    return this.repository.createRegisterEntry(data);
  }

  async updateRegisterEntry(id: string, data: UpdateLegalRegisterEntryInput): Promise<LegalRegisterEntry | null> {
    const existing = await this.repository.getRegisterEntryById(id);
    if (!existing) throw new NotFoundError("Legal register entry");
    return this.repository.updateRegisterEntry(id, data);
  }

  async deleteRegisterEntry(id: string): Promise<boolean> {
    const existing = await this.repository.getRegisterEntryById(id);
    if (!existing) return false;
    return this.repository.deleteRegisterEntry(id);
  }

  async getObligations(filters?: Record<string, unknown>): Promise<LegalObligation[]> {
    return this.repository.getObligations(filters);
  }

  async getObligationById(id: string): Promise<LegalObligation | null> {
    return this.repository.getObligationById(id);
  }

  async createObligation(data: CreateLegalObligationInput): Promise<LegalObligation> {
    return this.repository.createObligation(data);
  }

  async updateObligation(id: string, data: UpdateLegalObligationInput): Promise<LegalObligation | null> {
    const existing = await this.repository.getObligationById(id);
    if (!existing) throw new NotFoundError("Legal obligation");
    return this.repository.updateObligation(id, data);
  }

  async deleteObligation(id: string): Promise<boolean> {
    const existing = await this.repository.getObligationById(id);
    if (!existing) return false;
    return this.repository.deleteObligation(id);
  }

  async getReviews(filters?: Record<string, unknown>): Promise<ObligationReview[]> {
    return this.repository.getReviews(filters);
  }

  async getReviewById(id: string): Promise<ObligationReview | null> {
    return this.repository.getReviewById(id);
  }

  async createReview(data: CreateObligationReviewInput): Promise<ObligationReview> {
    const obligation = await this.repository.getObligationById(data.obligationId);
    if (!obligation) throw new NotFoundError("Legal obligation");

    const review = await this.repository.createReview(data);

    if (data.followUpRequired && data.status === "Completed") {
      await this.repository.updateObligation(data.obligationId, {
        lastReviewDate: data.reviewDate,
        lifecycle: "Under Review",
      });
    }

    return review;
  }

  async updateReview(id: string, data: UpdateObligationReviewInput): Promise<ObligationReview | null> {
    const existing = await this.repository.getReviewById(id);
    if (!existing) throw new NotFoundError("Obligation review");
    return this.repository.updateReview(id, data);
  }

  async deleteReview(id: string): Promise<boolean> {
    const existing = await this.repository.getReviewById(id);
    if (!existing) return false;
    return this.repository.deleteReview(id);
  }

  async getEvidence(filters?: Record<string, unknown>): Promise<ObligationEvidence[]> {
    return this.repository.getEvidence(filters);
  }

  async createEvidence(data: CreateObligationEvidenceInput): Promise<ObligationEvidence> {
    const obligation = await this.repository.getObligationById(data.obligationId);
    if (!obligation) throw new NotFoundError("Legal obligation");

    if (data.reviewId) {
      const review = await this.repository.getReviewById(data.reviewId);
      if (!review) throw new NotFoundError("Obligation review");
    }

    const evidence = await this.repository.createEvidence(data);

    await this.repository.updateObligation(data.obligationId, {
      evidenceCount: (obligation.evidenceCount || 0) + 1,
    });

    return evidence;
  }

  async deleteEvidence(id: string): Promise<boolean> {
    return this.repository.deleteEvidence(id);
  }

  async getActions(filters?: Record<string, unknown>): Promise<ObligationAction[]> {
    return this.repository.getActions(filters);
  }

  async getActionById(id: string): Promise<ObligationAction | null> {
    return this.repository.getActionById(id);
  }

  async createAction(data: CreateObligationActionInput): Promise<ObligationAction> {
    const obligation = await this.repository.getObligationById(data.obligationId);
    if (!obligation) throw new NotFoundError("Legal obligation");

    if (data.reviewId) {
      const review = await this.repository.getReviewById(data.reviewId);
      if (!review) throw new NotFoundError("Obligation review");
    }

    const action = await this.repository.createAction(data);

    await this.repository.updateObligation(data.obligationId, {
      openActionsCount: (obligation.openActionsCount || 0) + 1,
      lifecycle: "Action Required",
    });

    return action;
  }

  async updateAction(id: string, data: UpdateObligationActionInput): Promise<ObligationAction | null> {
    const existing = await this.repository.getActionById(id);
    if (!existing) throw new NotFoundError("Obligation action");

    const updated = await this.repository.updateAction(id, data);

    if (data.status === "Completed" || data.status === "Verified" || data.status === "Closed") {
      const obligation = await this.repository.getObligationById(existing.obligationId);
      if (obligation) {
        const remainingOpen = await this.repository.getActions({
          obligationId: existing.obligationId,
          status: "Open",
        });
        const remainingInProgress = await this.repository.getActions({
          obligationId: existing.obligationId,
          status: "In Progress",
        });

        if (remainingOpen.length === 0 && remainingInProgress.length === 0) {
          const obligation = await this.repository.getObligationById(existing.obligationId);
          await this.repository.updateObligation(existing.obligationId, {
            openActionsCount: 0,
            lifecycle: obligation?.lifecycle === "Action Required" ? "Implemented" : (obligation?.lifecycle ?? "Action Required"),
          });
        } else {
          await this.repository.updateObligation(existing.obligationId, {
            openActionsCount: remainingOpen.length + remainingInProgress.length,
          });
        }
      }
    }

    return updated;
  }

  async deleteAction(id: string): Promise<boolean> {
    const existing = await this.repository.getActionById(id);
    if (!existing) return false;

    const deleted = await this.repository.deleteAction(id);

    if (deleted) {
      const obligation = await this.repository.getObligationById(existing.obligationId);
      if (obligation) {
        const remainingActions = await this.repository.getActions({
          obligationId: existing.obligationId,
        });
        const openCount = remainingActions.filter(
          (a) => a.status === "Open" || a.status === "In Progress"
        ).length;
        await this.repository.updateObligation(existing.obligationId, {
          openActionsCount: openCount,
        });
      }
    }

    return deleted;
  }
}
