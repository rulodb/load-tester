import { Client, r } from '@rulodb/rulodb';

import { RuloDBAdapter } from '../../adapters';
import { generateRandomString } from '../../utils/random';
import { type OperationResult, Scenario } from '../scenario';

type Document = {
  id: string;
  name: string;
  timestamp?: string;
};

export class RuloDBBasicInsertScenario extends Scenario {
  protected tableName = 'users';
  protected insertedIds: string[] = [];

  constructor() {
    super('basic-insert', new RuloDBAdapter());
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
    const documentId = generateRandomString(16);

    await this.adapter.run(async (client) => {
      await r
        .db()
        .table(this.tableName)
        .insert({
          id: documentId,
          name: `User-${documentId}`,
          timestamp: new Date().toISOString()
        })
        .run(client as Client);
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
    await this.adapter.run(async (client) => {
      result = await r
        .db()
        .table(this.tableName)
        .get(lastId)
        .run<Document>(client as Client);
    });

    return result?.id === lastId;
  }
}
