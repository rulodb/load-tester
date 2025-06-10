import { type Connection, r } from 'rethinkdb-ts';

import { RethinkDBAdapter } from '../../adapters';
import { generateRandomString } from '../../utils/random';
import { type OperationResult, Scenario } from '../scenario';

type Document = {
  id: string;
  name: string;
  timestamp?: string;
};

export class RethinkDBBasicInsertScenario extends Scenario {
  protected tableName = 'users';
  protected insertedIds: string[] = [];

  constructor() {
    super('basic-insert', new RethinkDBAdapter());
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
    const documentId = generateRandomString(16);

    await this.adapter.run(async (conn) => {
      await r
        .table<Document>(this.tableName)
        .insert({
          id: documentId,
          name: `User-${documentId}`,
          timestamp: new Date().toISOString()
        })
        .run(conn as Connection);
    });

    this.insertedIds.push(documentId);

    return {
      documentsAffected: 1,
      operationsCount: 1,
      bytesProcessed: JSON.stringify({
        id: documentId,
        name: `User-${documentId}`,
        timestamp: new Date().toISOString()
      }).length
    };
  }

  async validate(): Promise<boolean> {
    if (this.insertedIds.length === 0) return false;
    const lastId = this.insertedIds[this.insertedIds.length - 1];
    let result: Document | undefined;

    await this.adapter.run(async (conn) => {
      result = (await r
        .table<Document>(this.tableName)
        .get(lastId)
        .run(conn as Connection)) as Document;
    });

    return result?.id === lastId;
  }
}
