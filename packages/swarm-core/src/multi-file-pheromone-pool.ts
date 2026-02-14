/**
 * MultiFilePheromonePool - Storage for multi-file solutions
 *
 * Similar to PheromonePool but handles MultiFilePheromone
 */

import type { MultiFilePheromone } from './types.js';

export class MultiFilePheromonePool {
  private store: Map<string, MultiFilePheromone> = new Map();

  /**
   * Deposit a multi-file pheromone
   */
  async deposit(pheromone: MultiFilePheromone): Promise<void> {
    const existing = this.store.get(pheromone.id);

    if (existing) {
      // Merge depositors and boost quality
      const mergedDepositors = Array.from(
        new Set([...existing.depositors, ...pheromone.depositors])
      );

      this.store.set(pheromone.id, {
        ...pheromone,
        depositors: mergedDepositors,
        quality: Math.min(1.0, existing.quality * 1.1), // 10% boost
      });
    } else {
      this.store.set(pheromone.id, pheromone);
    }
  }

  /**
   * Read all pheromones sorted by quality
   */
  async read(filter?: { minQuality?: number }): Promise<MultiFilePheromone[]> {
    const allPheromones = Array.from(this.store.values());

    let filtered = allPheromones;

    if (filter?.minQuality !== undefined) {
      filtered = allPheromones.filter(p => p.quality >= filter.minQuality!);
    }

    // Sort by quality descending
    return filtered.sort((a, b) => b.quality - a.quality);
  }

  /**
   * Get top N pheromones
   */
  getTop(n: number): MultiFilePheromone[] {
    const sorted = Array.from(this.store.values()).sort((a, b) => b.quality - a.quality);
    return sorted.slice(0, n);
  }

  /**
   * Get pheromone by ID
   */
  getById(id: string): MultiFilePheromone | undefined {
    return this.store.get(id);
  }

  /**
   * Get total count
   */
  getCount(): number {
    return this.store.size;
  }

  /**
   * Calculate diversity (Shannon entropy)
   */
  calculateDiversity(): number {
    const pheromones = Array.from(this.store.values());
    if (pheromones.length === 0) return 0;

    const totalQuality = pheromones.reduce((sum, p) => sum + p.quality, 0);
    if (totalQuality === 0) return 0;

    const entropy = pheromones.reduce((h, p) => {
      const prob = p.quality / totalQuality;
      return h - prob * Math.log2(prob);
    }, 0);

    return entropy / Math.log2(pheromones.length);
  }

  /**
   * Calculate convergence (ratio of agents on top solution)
   */
  calculateConvergence(totalAgents: number): number {
    const top = this.getTop(1)[0];
    if (!top) return 0;

    return top.depositors.length / totalAgents;
  }

  /**
   * Clear all pheromones
   */
  clear(): void {
    this.store.clear();
  }
}
