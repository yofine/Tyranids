/**
 * Tests for PheromonePool
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { PheromonePool } from './pheromone-pool.js';
import type { Pheromone } from './types.js';

describe('PheromonePool', () => {
  let pool: PheromonePool;

  beforeEach(() => {
    pool = new PheromonePool();
  });

  it('should start empty', () => {
    assert.strictEqual(pool.size(), 0);
  });

  it('should deposit and retrieve pheromones', async () => {
    const pheromone: Pheromone = {
      id: 'test-1',
      codeFragment: {
        filePath: 'test.ts',
        content: 'const x = 1;',
        intent: 'test',
      },
      quality: 0.8,
      depositors: ['agent-1'],
      timestamp: Date.now(),
    };

    await pool.deposit(pheromone);

    assert.strictEqual(pool.size(), 1);

    const results = await pool.read();
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'test-1');
    assert.strictEqual(results[0].quality, 0.8);
  });

  it('should reinforce existing pheromones', async () => {
    const pheromone1: Pheromone = {
      id: 'test-1',
      codeFragment: {
        filePath: 'test.ts',
        content: 'const x = 1;',
        intent: 'test',
      },
      quality: 0.5,
      depositors: ['agent-1'],
      timestamp: Date.now(),
    };

    const pheromone2: Pheromone = {
      id: 'test-1', // Same ID
      codeFragment: {
        filePath: 'test.ts',
        content: 'const x = 1;',
        intent: 'test',
      },
      quality: 0.5,
      depositors: ['agent-2'],
      timestamp: Date.now(),
    };

    await pool.deposit(pheromone1);
    await pool.deposit(pheromone2);

    assert.strictEqual(pool.size(), 1, 'Should not create duplicate');

    const results = await pool.read();
    assert.strictEqual(results[0].quality, 0.6, 'Quality should increase by 0.1');
    assert.strictEqual(
      results[0].depositors.length,
      2,
      'Should have both depositors'
    );
  });

  it('should filter by minimum quality', async () => {
    await pool.deposit({
      id: 'low',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.3,
      depositors: ['agent-1'],
      timestamp: Date.now(),
    });

    await pool.deposit({
      id: 'high',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.9,
      depositors: ['agent-2'],
      timestamp: Date.now(),
    });

    const results = await pool.read({ minQuality: 0.5 });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].id, 'high');
  });

  it('should sort by quality descending', async () => {
    await pool.deposit({
      id: 'medium',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.5,
      depositors: ['agent-1'],
      timestamp: Date.now(),
    });

    await pool.deposit({
      id: 'low',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.3,
      depositors: ['agent-2'],
      timestamp: Date.now(),
    });

    await pool.deposit({
      id: 'high',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.9,
      depositors: ['agent-3'],
      timestamp: Date.now(),
    });

    const results = await pool.read();
    assert.strictEqual(results[0].id, 'high');
    assert.strictEqual(results[1].id, 'medium');
    assert.strictEqual(results[2].id, 'low');
  });

  it('should get top N pheromones', () => {
    pool.deposit({
      id: 'p1',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.5,
      depositors: ['agent-1'],
      timestamp: Date.now(),
    });

    pool.deposit({
      id: 'p2',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.9,
      depositors: ['agent-2'],
      timestamp: Date.now(),
    });

    pool.deposit({
      id: 'p3',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.7,
      depositors: ['agent-3'],
      timestamp: Date.now(),
    });

    const top2 = pool.getTop(2);
    assert.strictEqual(top2.length, 2);
    assert.strictEqual(top2[0].id, 'p2');
    assert.strictEqual(top2[1].id, 'p3');
  });

  it('should calculate convergence', async () => {
    await pool.deposit({
      id: 'p1',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.9,
      depositors: ['agent-1', 'agent-2', 'agent-3'],
      timestamp: Date.now(),
    });

    await pool.deposit({
      id: 'p2',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.5,
      depositors: ['agent-4'],
      timestamp: Date.now(),
    });

    // 3 out of 4 unique agents support the top pheromone
    const convergence = pool.calculateConvergence();
    assert.strictEqual(convergence, 0.75);
  });

  it('should get nearby pheromones', async () => {
    await pool.deposit({
      id: 'p1',
      codeFragment: {
        filePath: 'test.ts',
        content: '',
        intent: '',
        lineRange: { start: 10, end: 20 },
      },
      quality: 0.8,
      depositors: ['agent-1'],
      timestamp: Date.now(),
    });

    await pool.deposit({
      id: 'p2',
      codeFragment: {
        filePath: 'test.ts',
        content: '',
        intent: '',
        lineRange: { start: 15, end: 25 },
      },
      quality: 0.7,
      depositors: ['agent-2'],
      timestamp: Date.now(),
    });

    await pool.deposit({
      id: 'p3',
      codeFragment: {
        filePath: 'test.ts',
        content: '',
        intent: '',
        lineRange: { start: 100, end: 110 },
      },
      quality: 0.9,
      depositors: ['agent-3'],
      timestamp: Date.now(),
    });

    const nearby = pool.getNearby(
      {
        filePath: 'test.ts',
        content: '',
        intent: '',
        lineRange: { start: 12, end: 18 },
      },
      10
    );

    // p1 and p2 are within 10 lines, p3 is not
    assert.strictEqual(nearby.length, 2);
    const ids = nearby.map((p) => p.id).sort();
    assert.deepStrictEqual(ids, ['p1', 'p2']);
  });

  it('should provide statistics', async () => {
    await pool.deposit({
      id: 'p1',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.5,
      depositors: ['agent-1'],
      timestamp: Date.now(),
    });

    await pool.deposit({
      id: 'p2',
      codeFragment: { filePath: 'test.ts', content: '', intent: '' },
      quality: 0.9,
      depositors: ['agent-2'],
      timestamp: Date.now(),
    });

    const stats = pool.getStats();
    assert.strictEqual(stats.count, 2);
    assert.strictEqual(stats.maxQuality, 0.9);
    assert.strictEqual(stats.minQuality, 0.5);
    assert.strictEqual(stats.avgQuality, 0.7);
  });
});
