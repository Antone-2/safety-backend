import { WibaRepository } from "./wiba.repository.js";
import type { WibaClaimInput, WibaClaimPatch } from "./wiba.types.js";

export class WibaService {
  constructor(private repository: WibaRepository) {}

  async getClaims() {
    await this.repository.seedDefaultsIfEmpty();
    return this.repository.findAll();
  }

  async createClaim(data: WibaClaimInput) {
    return this.repository.create(data);
  }

  async updateClaim(id: string, data: WibaClaimPatch) {
    return this.repository.update(id, data);
  }
}
