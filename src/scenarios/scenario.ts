import type { DatabaseAdapter } from '../adapters';

export interface OperationResult {
  documentsAffected?: number;
  operationsCount?: number;
  bytesProcessed?: number;
  metadata?: Record<string, unknown>;
}

export abstract class Scenario {
  public name: string;
  protected adapter: DatabaseAdapter;
  public batchSize: number = 1;

  constructor(name: string, adapter: DatabaseAdapter) {
    this.name = name;
    this.adapter = adapter;
  }

  abstract setup(): Promise<void>;
  abstract teardown(): Promise<void>;
  abstract test(): Promise<OperationResult>;
  abstract validate(): Promise<boolean>;

  getOperationMultiplier(): number {
    return this.batchSize;
  }
}
