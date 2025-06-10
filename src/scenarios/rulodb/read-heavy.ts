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
  tags: string[];
  metadata: {
    created: string;
    updated: string;
    version: number;
  };
};

export class RuloDBReadHeavyScenario extends Scenario {
  protected tableName = 'read_heavy_test';
  protected seedData: Document[] = [];
  protected insertedIds: string[] = [];
  private readWriteRatio = 0.9; // 90% reads, 10% writes

  constructor() {
    super('read-heavy', new RuloDBAdapter());
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

    // Seed the table with a larger dataset for more realistic read testing
    this.seedData = this.generateSeedData(5000);

    // Insert seed data in batches for better performance
    const batchSize = 500;
    for (let i = 0; i < this.seedData.length; i += batchSize) {
      const batch = this.seedData.slice(i, i + batchSize);
      await this.adapter.run(async (client) => {
        await r
          .db()
          .table(this.tableName)
          .insert(batch)
          .run(client as Client);
      });
    }
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
      if (operationType < 0.3) {
        // Single document read - get first document
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
      } else if (operationType < 0.6) {
        // Category-based read - simplified filtering
        const cursor = r
          .db()
          .table(this.tableName)
          .run(client as Client);

        const results = await cursor.toArray();
        const categoryA = results.filter((doc) => doc.category === 'A').slice(0, 20);

        documentsAffected = categoryA.length;
        bytesProcessed = JSON.stringify(categoryA).length;
      } else if (operationType < 0.8) {
        // Value range filtering - client-side filtering
        const minValue = Math.floor(Math.random() * 500);
        const maxValue = minValue + 200;

        const cursor = r
          .db()
          .table(this.tableName)
          .run<Document>(client as Client);

        const results = await cursor.toArray();
        const filtered = results
          .filter((doc) => doc.value >= minValue && doc.value <= maxValue && doc.metadata.version > 1)
          .slice(0, 15);

        documentsAffected = filtered.length;
        bytesProcessed = JSON.stringify(filtered).length;
      } else {
        // Tag-based search - client-side filtering
        const tags = ['important', 'urgent', 'archived', 'featured', 'public'];
        const randomTag = tags[Math.floor(Math.random() * tags.length)];

        const cursor = r
          .db()
          .table(this.tableName)
          .run<Document>(client as Client);

        const results = await cursor.toArray();
        const tagged = results.filter((doc) => doc.tags.includes(randomTag)).slice(0, 25);

        documentsAffected = tagged.length;
        bytesProcessed = JSON.stringify(tagged).length;
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
      // Update existing document - use replace operation
      const randomDoc = this.seedData[Math.floor(Math.random() * this.seedData.length)];
      const updatedDoc = {
        ...randomDoc,
        value: Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        metadata: {
          ...randomDoc.metadata,
          updated: new Date().toISOString(),
          version: randomDoc.metadata.version + 1
        }
      };

      await this.adapter.run(async (client) => {
        await r
          .db()
          .table(this.tableName)
          .insert(updatedDoc)
          .run(client as Client);

        documentsAffected = 1; // Assume successful update
      });

      bytesProcessed = JSON.stringify(updatedDoc).length;
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
    // Validate that we have sufficient seed data and can perform queries
    let seedCount = 0;
    let categoryCount = 0;
    let taggedCount = 0;

    await this.adapter.run(async (client) => {
      // Get all documents and perform client-side filtering for validation
      const cursor = r
        .db()
        .table(this.tableName)
        .run<Document>(client as Client);

      const allDocs = await cursor.toArray();

      // Check seed data
      seedCount = allDocs.filter((doc) => doc.id.startsWith('read-seed-')).length;

      // Test category filtering
      categoryCount = allDocs.filter((doc) => doc.category === 'A').length;

      // Test tag search
      taggedCount = allDocs.filter((doc) => doc.tags.includes('important')).length;
    });

    return seedCount >= 4000 && categoryCount > 0 && taggedCount > 0;
  }
}
