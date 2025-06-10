import { Client, r } from '@rulodb/rulodb';

import { RuloDBAdapter } from '../../adapters';
import { generateRandomString } from '../../utils/random';
import { type OperationResult, Scenario } from '../scenario';

type Document = {
  id: string;
  name: string;
  timestamp?: string;
};

export class RuloDBBulkInsertScenario extends Scenario {
  protected tableName = 'users_bulk';
  protected insertedIds: string[] = [];

  constructor(batchSize: number = 250) {
    super('bulk-insert', new RuloDBAdapter());
    this.batchSize = batchSize;
  }

  async setup(): Promise<void> {
    await this.adapter.connect();
    await this.adapter.run(async (client) => {
      await r
        .db()
        .createTable(this.tableName)
        .run(client as Client);
    });
  }

  async teardown(): Promise<void> {
    // Clean up all inserted documents
    if (this.insertedIds.length > 0) {
      await this.adapter.run(async (client) => {
        await r
          .db()
          .table(this.tableName)
          .delete()
          .run(client as Client);
      });
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
    await this.adapter.run(async (client) => {
      await r
        .db()
        .table(this.tableName)
        .insert(documents)
        .run(client as Client);
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
    // TODO: use to get when getAll exists
    //  const lastBatchIds = this.insertedIds.slice(-this.batchSize);
    let count = 0;

    await this.adapter.run(async (conn) => {
      const cursor = r
        .db()
        .table(this.tableName)
        .run(conn as Client);

      count = (await cursor.toArray()).length;
    });

    return count === this.batchSize;
  }
}
