/**
 * PheromonePool - The Hive Mind's shared knowledge
 *
 * Implements a pheromone-based communication system where agents
 * deposit and read quality signals about code solutions.
 *
 * Inspired by ant colony optimization and Tyranid Hive Mind.
 */

import type { Pheromone, PheromoneFilter, CodeFragment } from './types.js';

export class PheromonePool {
  /** In-memory pheromone storage (Map for O(1) lookups) */
  private store: Map<string, Pheromone> = new Map();

  /**
   * Deposit a pheromone into the pool
   *
   * If a pheromone with the same ID already exists, it will be reinforced:
   * - Quality is increased by 0.1 (capped at 1.0)
   * - Depositors list is merged
   *
   * This implements pheromone reinforcement from ant colony optimization.
   */
  async deposit(pheromone: Pheromone): Promise<void> {
    const existing = this.store.get(pheromone.id);

    if (existing) {
      // Reinforce existing pheromone
      existing.quality = Math.min(1.0, existing.quality + 0.1);

      // Merge depositors (avoid duplicates)
      const newDepositors = pheromone.depositors.filter(
        (d) => !existing.depositors.includes(d)
      );
      existing.depositors.push(...newDepositors);

      // Update timestamp
      existing.timestamp = pheromone.timestamp;

      // Merge metadata
      if (pheromone.metadata) {
        existing.metadata = {
          ...existing.metadata,
          ...pheromone.metadata,
        };
      }
    } else {
      // New pheromone
      this.store.set(pheromone.id, { ...pheromone });
    }
  }

  /**
   * Read pheromones from the pool with optional filtering
   *
   * Returns pheromones sorted by quality (highest first)
   */
  async read(filter?: PheromoneFilter): Promise<Pheromone[]> {
    let pheromones = Array.from(this.store.values());

    // Apply filters
    if (filter) {
      if (filter.minQuality !== undefined) {
        pheromones = pheromones.filter((p) => p.quality >= filter.minQuality!);
      }

      if (filter.filePath) {
        pheromones = pheromones.filter(
          (p) => p.codeFragment.filePath === filter.filePath
        );
      }

      if (filter.since !== undefined) {
        pheromones = pheromones.filter((p) => p.timestamp >= filter.since!);
      }
    }

    // Sort by quality (descending)
    pheromones.sort((a, b) => b.quality - a.quality);

    // Apply limit
    if (filter?.limit) {
      pheromones = pheromones.slice(0, filter.limit);
    }

    return pheromones;
  }

  /**
   * Get the top N pheromones by quality
   */
  getTop(n: number): Pheromone[] {
    return Array.from(this.store.values())
      .sort((a, b) => b.quality - a.quality)
      .slice(0, n);
  }

  /**
   * Get pheromones near a specific code fragment
   *
   * "Near" is defined as:
   * - Same file path
   * - Within `radius` lines of the target
   *
   * This implements spatial locality in the pheromone space.
   */
  getNearby(fragment: CodeFragment, radius: number = 50): Pheromone[] {
    const pheromones = Array.from(this.store.values());

    return pheromones.filter((p) => {
      // Must be same file
      if (p.codeFragment.filePath !== fragment.filePath) {
        return false;
      }

      // If line ranges are available, check distance
      if (p.codeFragment.lineRange && fragment.lineRange) {
        const distance = Math.abs(
          p.codeFragment.lineRange.start - fragment.lineRange.start
        );
        return distance <= radius;
      }

      // If no line range info, include it (conservative)
      return true;
    });
  }

  /**
   * Get all pheromones (for testing/debugging)
   */
  getAll(): Pheromone[] {
    return Array.from(this.store.values());
  }

  /**
   * Clear all pheromones (for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the number of pheromones in the pool
   */
  size(): number {
    return this.store.size;
  }

  /**
   * Calculate convergence metric
   *
   * Returns the ratio of agents supporting the top pheromone
   * to the total number of unique depositors.
   *
   * High convergence (>0.8) indicates swarm agreement.
   */
  calculateConvergence(): number {
    if (this.store.size === 0) return 0;

    const top = this.getTop(1)[0];
    if (!top) return 0;

    // Get all unique depositors
    const allDepositors = new Set<string>();
    for (const p of this.store.values()) {
      p.depositors.forEach((d) => allDepositors.add(d));
    }

    if (allDepositors.size === 0) return 0;

    return top.depositors.length / allDepositors.size;
  }

  /**
   * Get statistics about the pheromone pool
   */
  getStats(): {
    count: number;
    avgQuality: number;
    maxQuality: number;
    minQuality: number;
    convergence: number;
  } {
    const pheromones = this.getAll();

    if (pheromones.length === 0) {
      return {
        count: 0,
        avgQuality: 0,
        maxQuality: 0,
        minQuality: 0,
        convergence: 0,
      };
    }

    const qualities = pheromones.map((p) => p.quality);
    const avgQuality = qualities.reduce((sum, q) => sum + q, 0) / qualities.length;
    const maxQuality = Math.max(...qualities);
    const minQuality = Math.min(...qualities);

    return {
      count: pheromones.length,
      avgQuality,
      maxQuality,
      minQuality,
      convergence: this.calculateConvergence(),
    };
  }
}
