import { Client, r } from '@rulodb/rulodb';

import { RuloDBAdapter } from '../../adapters';
import { generateRandomString } from '../../utils/random';
import { type OperationResult, Scenario } from '../scenario';

type Document = {
  id: string;
  name: string;
  value: number;
  timestamp: string;
  category: string;
};

export class RuloDBBalancedReadWriteScenario extends Scenario {
  protected tableName = 'balanced_test';
  protected seedData: Document[] = [];
  protected insertedIds: string[] = [];
  private readWriteRatio = 0.7; // 70% reads, 30% writes

  constructor() {
    super('balanced-read-write', new RuloDBAdapter());
  }

  async setup(): Promise<void> {
    await this.adapter.connect();

    // Create table
    await this.adapter.run(async (client) => {
      await r
        .db()
        .createTable(this.tableName)
        .run(client as Client);
    });

    // Seed the table with initial data for reads
    this.seedData = this.generateSeedData(1000);

    await this.adapter.run(async (client) => {
      await r
        .db()
        .table(this.tableName)
        .insert(this.seedData)
        .run(client as Client);
    });
  }

  async teardown(): Promise<void> {
    // Clean up all data
    try {
      await this.adapter.run(async (client) => {
        await r
          .db()
          .table(this.tableName)
          .delete()
          .run(client as Client);
      });
    } catch {
      // Ignore cleanup errors
    }
    await this.adapter.disconnect();
  }

  async test(): Promise<OperationResult> {
    const isRead = Math.random() < this.readWriteRatio;

    if (isRead) {
      return await this.performRead();
    } else {
      return await this.performWrite();
    }
  }

  private async performRead(): Promise<OperationResult> {
    const operationType = Math.random();
    let documentsAffected = 0;
    let bytesProcessed = 0;

    await this.adapter.run(async (client) => {
      if (operationType < 0.4) {
        // Single document read by ID - simplified to get first document
        const cursor = r
          .db()
          .table(this.tableName)
          .run(client as Client);

        const results = await cursor.toArray();
        const result = results[0];

        if (result) {
          documentsAffected = 1;
          bytesProcessed = JSON.stringify(result).length;
        }
      } else {
        // Get multiple documents - simplified approach
        const cursor = r
          .db()
          .table(this.tableName)
          .run(client as Client);

        const results = await cursor.toArray();
        const limitedResults = results.slice(0, 10); // Limit to 10 documents

        documentsAffected = limitedResults.length;
        bytesProcessed = JSON.stringify(limitedResults).length;
      }
    });

    return {
      documentsAffected,
      operationsCount: 1,
      bytesProcessed,
      metadata: { operationType: 'read' }
    };
  }

  private async performWrite(): Promise<OperationResult> {
    const operationType = Math.random();
    let documentsAffected = 0;
    let bytesProcessed = 0;

    if (operationType < 0.6) {
      // Insert new document
      const documentId = generateRandomString(16);
      const document: Document = {
        id: documentId,
        name: `User-${documentId}`,
        value: Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        category: ['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)]
      };

      await this.adapter.run(async (client) => {
        await r
          .db()
          .table(this.tableName)
          .insert(document)
          .run(client as Client);
      });

      this.insertedIds.push(documentId);
      documentsAffected = 1;
      bytesProcessed = JSON.stringify(document).length;
    } else {
      // For simplicity, just insert another document instead of update/delete
      const documentId = generateRandomString(16);
      const document: Document = {
        id: documentId,
        name: `UpdateUser-${documentId}`,
        value: Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        category: ['A', 'B', 'C', 'D', 'E'][Math.floor(Math.random() * 5)]
      };

      await this.adapter.run(async (client) => {
        await r
          .db()
          .table(this.tableName)
          .insert(document)
          .run(client as Client);
      });

      this.insertedIds.push(documentId);
      documentsAffected = 1;
      bytesProcessed = JSON.stringify(document).length;
    }

    return {
      documentsAffected,
      operationsCount: 1,
      bytesProcessed,
      metadata: { operationType: 'write' }
    };
  }

  private generateSeedData(count: number): Document[] {
    const documents: Document[] = [];
    const categories = ['A', 'B', 'C', 'D', 'E'];

    for (let i = 0; i < count; i++) {
      const documentId = `seed-${generateRandomString(12)}`;
      documents.push({
        id: documentId,
        name: `SeedUser-${i}`,
        value: Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        category: categories[Math.floor(Math.random() * categories.length)]
      });
    }

    return documents;
  }

  async validate(): Promise<boolean> {
    // Validate that we have seed data and can perform basic operations
    let seedCount = 0;
    let insertedCount = 0;

    await this.adapter.run(async (client) => {
      // Check seed data by counting total documents (since we can't easily filter by ID prefix in RuloDB)
      const cursor = r
        .db()
        .table(this.tableName)
        .run<Document>(client as Client);

      const allDocs = await cursor.toArray();
      seedCount = allDocs.filter((doc) => doc.id.startsWith('seed-')).length;

      // Check inserted data
      if (this.insertedIds.length > 0) {
        insertedCount = allDocs.filter((doc) => this.insertedIds.includes(doc.id)).length;
      }
    });

    return seedCount > 0 && (this.insertedIds.length === 0 || insertedCount > 0);
  }
}
