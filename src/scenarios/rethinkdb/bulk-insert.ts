import { type Connection, r } from 'rethinkdb-ts';

import { RethinkDBAdapter } from '../../adapters';
import { generateRandomString } from '../../utils/random';
import { type OperationResult, Scenario } from '../scenario';

type Document = {
  id: string;
  name: string;
  timestamp?: string;
};

export class RethinkDBBulkInsertScenario extends Scenario {
  protected tableName = 'users_bulk';
  protected insertedIds: string[] = [];

  constructor(batchSize: number = 250) {
    super('bulk-insert', new RethinkDBAdapter());
    this.batchSize = batchSize;
  }

  async setup(): Promise<void> {
    await this.adapter.connect();
    // Ensure table exists
    try {
      await this.adapter.run(async (conn) => {
        await r.tableCreate(this.tableName).run(conn as Connection);
      });
    } catch {
      // Table might already exist, ignore error
    }
  }

  async teardown(): Promise<void> {
    // Clean up all inserted documents
    if (this.insertedIds.length > 0) {
      try {
        await this.adapter.run(async (conn) => {
          await r
            .table(this.tableName)
            .getAll(...this.insertedIds)
            .delete()
            .run(conn as Connection);
        });
      } catch {
        // Ignore cleanup errors
      }
    }
    await this.adapter.disconnect();
  }

  async test(): Promise<OperationResult> {
    const documents: Document[] = [];
    const batchIds: string[] = [];

    // Generate batch of documents
    for (let i = 0; i < this.batchSize; i++) {
      const documentId = generateRandomString(16);
      documents.push({
        id: documentId,
        name: `User-${documentId}`,
        timestamp: new Date().toISOString()
      });
      batchIds.push(documentId);
    }

    // Insert all documents in a single batch
    await this.adapter.run(async (conn) => {
      await r
        .table<Document>(this.tableName)
        .insert(documents)
        .run(conn as Connection);
    });

    this.insertedIds.push(...batchIds);

    return {
      documentsAffected: this.batchSize,
      operationsCount: 1,
      bytesProcessed: JSON.stringify(documents).length
    };
  }

  async validate(): Promise<boolean> {
    if (this.insertedIds.length === 0) return false;

    // Validate that the last batch was inserted correctly
    const lastBatchIds = this.insertedIds.slice(-this.batchSize);
    let count = 0;

    await this.adapter.run(async (conn) => {
      count = await r
        .table<Document>(this.tableName)
        .getAll(...lastBatchIds)
        .count()
        .run(conn as Connection);
    });

    return count === this.batchSize;
  }
}
