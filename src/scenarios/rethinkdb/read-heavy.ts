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
  tags: string[];
  metadata: {
    created: string;
    updated: string;
    version: number;
  };
};

export class RethinkDBReadHeavyScenario extends Scenario {
  protected tableName = 'read_heavy_test';
  protected seedData: Document[] = [];
  protected insertedIds: string[] = [];
  private readWriteRatio = 0.9; // 90% reads, 10% writes

  constructor() {
    super('read-heavy', new RethinkDBAdapter());
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

    // Seed the table with a larger dataset for more realistic read testing
    this.seedData = this.generateSeedData(5000);

    // Insert seed data in batches for better performance
    const batchSize = 500;
    for (let i = 0; i < this.seedData.length; i += batchSize) {
      const batch = this.seedData.slice(i, i + batchSize);
      await this.adapter.run(async (conn) => {
        await r
          .table<Document>(this.tableName)
          .insert(batch)
          .run(conn as Connection);
      });
    }
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
      if (operationType < 0.25) {
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
      } else if (operationType < 0.45) {
        // Category-based read with ordering
        const categories = ['A', 'B', 'C', 'D', 'E'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];

        const docs = await r
          .table<Document>(this.tableName)
          .filter({ category: randomCategory })
          .orderBy(r.desc('value'))
          .limit(20)
          .run(conn as Connection);

        documentsAffected = docs.length;
        bytesProcessed = JSON.stringify(docs).length;
      } else if (operationType < 0.65) {
        // Range query with complex filtering
        const minValue = Math.floor(Math.random() * 500);
        const maxValue = minValue + 200;

        const docs = await r
          .table<Document>(this.tableName)
          .filter((doc) =>
            doc('value').ge(minValue).and(doc('value').le(maxValue)).and(doc('metadata')('version').gt(1))
          )
          .orderBy('timestamp')
          .limit(15)
          .run(conn as Connection);

        documentsAffected = docs.length;
        bytesProcessed = JSON.stringify(docs).length;
      } else if (operationType < 0.8) {
        // Tag-based search (array contains)
        const tags = ['important', 'urgent', 'archived', 'featured', 'public'];
        const randomTag = tags[Math.floor(Math.random() * tags.length)];

        const docs = await r
          .table<Document>(this.tableName)
          .filter((doc) => doc('tags').contains(randomTag))
          .limit(25)
          .run(conn as Connection);

        documentsAffected = docs.length;
        bytesProcessed = JSON.stringify(docs).length;
      } else {
        // Simple count query instead of aggregation
        const count = await r
          .table<Document>(this.tableName)
          .count()
          .run(conn as Connection);

        documentsAffected = 1;
        bytesProcessed = JSON.stringify({ totalCount: count }).length;
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

    if (operationType < 0.7) {
      // Insert new document
      const documentId = generateRandomString(16);
      const document: Document = this.generateDocument(documentId);

      await this.adapter.run(async (conn) => {
        await r
          .table<Document>(this.tableName)
          .insert(document)
          .run(conn as Connection);
      });

      this.insertedIds.push(documentId);
      documentsAffected = 1;
      bytesProcessed = JSON.stringify(document).length;
    } else {
      // Update existing document
      const randomDoc = this.seedData[Math.floor(Math.random() * this.seedData.length)];
      const updateData = {
        value: Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        metadata: {
          ...randomDoc.metadata,
          updated: new Date().toISOString(),
          version: randomDoc.metadata.version + 1
        }
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
    }

    return {
      documentsAffected,
      operationsCount: 1,
      bytesProcessed,
      metadata: { operationType: 'write' }
    };
  }

  private generateDocument(documentId: string): Document {
    const categories = ['A', 'B', 'C', 'D', 'E'];
    const tags = ['important', 'urgent', 'archived', 'featured', 'public', 'draft', 'reviewed'];
    const selectedTags = tags.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 4) + 1);

    return {
      id: documentId,
      name: `ReadUser-${documentId}`,
      value: Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      category: categories[Math.floor(Math.random() * categories.length)],
      tags: selectedTags,
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1
      }
    };
  }

  private generateSeedData(count: number): Document[] {
    const documents: Document[] = [];

    for (let i = 0; i < count; i++) {
      const documentId = `read-seed-${generateRandomString(12)}`;
      documents.push(this.generateDocument(documentId));
    }

    return documents;
  }

  async validate(): Promise<boolean> {
    // Validate that we have sufficient seed data and can perform complex queries
    let seedCount = 0;
    let categoryCount = 0;
    let taggedCount = 0;

    await this.adapter.run(async (conn) => {
      // Check seed data count
      seedCount = await r
        .table<Document>(this.tableName)
        .filter((doc) => doc('id').match('^read-seed-'))
        .count()
        .run(conn as Connection);

      // Test category filtering
      categoryCount = await r
        .table<Document>(this.tableName)
        .filter({ category: 'A' })
        .count()
        .run(conn as Connection);

      // Test tag search
      taggedCount = await r
        .table<Document>(this.tableName)
        .filter((doc) => doc('tags').contains('important'))
        .count()
        .run(conn as Connection);
    });

    return seedCount >= 4000 && categoryCount > 0 && taggedCount > 0;
  }
}
