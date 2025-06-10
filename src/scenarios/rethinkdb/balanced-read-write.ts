import { type Connection, r } from 'rethinkdb-ts';

import { RethinkDBAdapter } from '../../adapters';
import { generateRandomString } from '../../utils/random';
import { type OperationResult, Scenario } from '../scenario';

type Document = {
  id: string;
  name: string;
  value: number;
  timestamp: string;
  category: string;
};

export class RethinkDBBalancedReadWriteScenario extends Scenario {
  protected tableName = 'balanced_test';
  protected seedData: Document[] = [];
  protected insertedIds: string[] = [];
  private readWriteRatio = 0.7; // 70% reads, 30% writes

  constructor() {
    super('balanced-read-write', new RethinkDBAdapter());
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

    // Seed the table with initial data for reads
    this.seedData = this.generateSeedData(1000);

    await this.adapter.run(async (conn) => {
      await r
        .table<Document>(this.tableName)
        .insert(this.seedData)
        .run(conn as Connection);
    });
  }

  async teardown(): Promise<void> {
    // Clean up all data
    try {
      await this.adapter.run(async (conn) => {
        await r
          .table(this.tableName)
          .delete()
          .run(conn as Connection);
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

    await this.adapter.run(async (conn) => {
      if (operationType < 0.4) {
        // Single document read by ID
        const randomDoc = this.seedData[Math.floor(Math.random() * this.seedData.length)];
        const doc = await r
          .table<Document>(this.tableName)
          .get(randomDoc.id)
          .run(conn as Connection);

        if (doc) {
          documentsAffected = 1;
          bytesProcessed = JSON.stringify(doc).length;
        }
      } else if (operationType < 0.7) {
        // Filter query - get documents by category
        const categories = ['A', 'B', 'C', 'D', 'E'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];

        const docs = await r
          .table<Document>(this.tableName)
          .filter({ category: randomCategory })
          .limit(10)
          .run(conn as Connection);

        documentsAffected = docs.length;
        bytesProcessed = JSON.stringify(docs).length;
      } else {
        // Range query - get documents with value in range
        const minValue = Math.floor(Math.random() * 500);
        const maxValue = minValue + 100;

        const docs = await r
          .table<Document>(this.tableName)
          .filter((doc) => doc('value').ge(minValue).and(doc('value').le(maxValue)))
          .limit(20)
          .run(conn as Connection);

        documentsAffected = docs.length;
        bytesProcessed = JSON.stringify(docs).length;
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

      await this.adapter.run(async (conn) => {
        await r
          .table<Document>(this.tableName)
          .insert(document)
          .run(conn as Connection);
      });

      this.insertedIds.push(documentId);
      documentsAffected = 1;
      bytesProcessed = JSON.stringify(document).length;
    } else if (operationType < 0.9) {
      // Update existing document
      const randomDoc = this.seedData[Math.floor(Math.random() * this.seedData.length)];
      const updateData = {
        value: Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString()
      };

      await this.adapter.run(async (conn) => {
        const result = await r
          .table<Document>(this.tableName)
          .get(randomDoc.id)
          .update(updateData)
          .run(conn as Connection);

        documentsAffected = result.replaced || 0;
      });

      bytesProcessed = JSON.stringify(updateData).length;
    } else {
      // Delete and re-insert (simulate replace)
      if (this.insertedIds.length > 0) {
        const idToDelete = this.insertedIds[Math.floor(Math.random() * this.insertedIds.length)];

        await this.adapter.run(async (conn) => {
          const result = await r
            .table<Document>(this.tableName)
            .get(idToDelete)
            .delete()
            .run(conn as Connection);

          documentsAffected = result.deleted || 0;
        });

        // Remove from tracking
        this.insertedIds = this.insertedIds.filter((id) => id !== idToDelete);
        bytesProcessed = 50; // Estimated size for delete operation
      }
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

    await this.adapter.run(async (conn) => {
      // Check seed data
      seedCount = await r
        .table<Document>(this.tableName)
        .filter((doc) => doc('id').match('^seed-'))
        .count()
        .run(conn as Connection);

      // Check inserted data
      if (this.insertedIds.length > 0) {
        insertedCount = await r
          .table<Document>(this.tableName)
          .getAll(...this.insertedIds.slice(0, Math.min(10, this.insertedIds.length)))
          .count()
          .run(conn as Connection);
      }
    });

    return seedCount > 0 && (this.insertedIds.length === 0 || insertedCount > 0);
  }
}
