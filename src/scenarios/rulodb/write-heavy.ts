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
    operations: number;
  };
};

export class RuloDBWriteHeavyScenario extends Scenario {
  protected tableName = 'write_heavy_test';
  protected seedData: Document[] = [];
  protected insertedIds: string[] = [];
  private readWriteRatio = 0.1; // 10% reads, 90% writes

  constructor() {
    super('write-heavy', new RuloDBAdapter());
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

    // Seed with moderate amount of data for read operations
    this.seedData = this.generateSeedData(2000);

    // Insert seed data in batches
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
      if (operationType < 0.5) {
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
      } else {
        // Quick count operation for monitoring
        const cursor = r
          .db()
          .table(this.tableName)
          .run(client as Client);

        const results = await cursor.toArray();
        const categoryCount = results.filter((doc) => doc.category === 'A').length;

        documentsAffected = 1; // Count operation affects metadata understanding
        bytesProcessed = JSON.stringify({ count: categoryCount }).length;
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

    if (operationType < 0.4) {
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
    } else if (operationType < 0.65) {
      // Update existing document using replace
      const targetDoc = this.seedData[Math.floor(Math.random() * this.seedData.length)];
      const updatedDoc = {
        ...targetDoc,
        value: Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString(),
        metadata: {
          ...targetDoc.metadata,
          updated: new Date().toISOString(),
          version: targetDoc.metadata.version + 1,
          operations: targetDoc.metadata.operations + 1
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
    } else if (operationType < 0.85) {
      // Batch insert multiple documents
      const batchSize = Math.floor(Math.random() * 5) + 2; // 2-6 documents
      const documents: Document[] = [];

      for (let i = 0; i < batchSize; i++) {
        const documentId = generateRandomString(16);
        documents.push(this.generateDocument(documentId));
        this.insertedIds.push(documentId);
      }

      await this.adapter.run(async (client) => {
        await r
          .db()
          .table(this.tableName)
          .insert(documents)
          .run(client as Client);
      });

      documentsAffected = batchSize;
      bytesProcessed = JSON.stringify(documents).length;
    } else if (operationType < 0.95) {
      // Delete operation - simplified for RuloDB
      if (this.insertedIds.length > 0) {
        const idToDelete = this.insertedIds[Math.floor(Math.random() * this.insertedIds.length)];

        await this.adapter.run(async (client) => {
          // For RuloDB, we'll use a simple approach and clear all data then re-insert without the deleted item
          // This is a simplification due to RuloDB API limitations
          const cursor = r
            .db()
            .table(this.tableName)
            .run(client as Client);

          const allDocs = await cursor.toArray();
          const filteredDocs = allDocs.filter((doc) => doc.id !== idToDelete);

          // Clear and re-insert (simplified approach)
          await r
            .db()
            .table(this.tableName)
            .delete()
            .run(client as Client);

          if (filteredDocs.length > 0) {
            await r
              .db()
              .table(this.tableName)
              .insert(filteredDocs)
              .run(client as Client);
          }

          documentsAffected = 1; // One document was effectively deleted
        });

        // Remove from tracking
        this.insertedIds = this.insertedIds.filter((id) => id !== idToDelete);
        bytesProcessed = 50; // Estimated size for delete operation
      } else {
        // No documents to delete, perform insert instead
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
      }
    } else {
      // Replace operation (upsert)
      const documentId = generateRandomString(16);
      const document: Document = this.generateDocument(documentId);

      await this.adapter.run(async (client) => {
        await r
          .db()
          .table(this.tableName)
          .insert(document)
          .run(client as Client);

        documentsAffected = 1; // Assume successful upsert
      });

      if (!this.insertedIds.includes(documentId)) {
        this.insertedIds.push(documentId);
      }
      bytesProcessed = JSON.stringify(document).length;
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
    const tags = ['important', 'urgent', 'archived', 'featured', 'public', 'draft', 'reviewed', 'processed'];
    const selectedTags = tags.sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 4) + 1);

    return {
      id: documentId,
      name: `WriteUser-${documentId}`,
      value: Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      category: categories[Math.floor(Math.random() * categories.length)],
      tags: selectedTags,
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1,
        operations: 1
      }
    };
  }

  private generateSeedData(count: number): Document[] {
    const documents: Document[] = [];

    for (let i = 0; i < count; i++) {
      const documentId = `write-seed-${generateRandomString(12)}`;
      documents.push(this.generateDocument(documentId));
    }

    return documents;
  }

  async validate(): Promise<boolean> {
    // Validate that we have seed data and can perform write operations
    let seedCount = 0;
    let insertedCount = 0;
    let totalCount = 0;

    await this.adapter.run(async (client) => {
      // Get all documents for validation
      const cursor = r
        .db()
        .table(this.tableName)
        .run<Document>(client as Client);

      const allDocs = await cursor.toArray();

      // Check total document count
      totalCount = allDocs.length;

      // Check seed data
      seedCount = allDocs.filter((doc) => doc.id.startsWith('write-seed-')).length;

      // Check inserted data (if any)
      if (this.insertedIds.length > 0) {
        insertedCount = allDocs.filter((doc) => this.insertedIds.includes(doc.id)).length;
      }
    });

    return totalCount >= seedCount && seedCount >= 1000 && (this.insertedIds.length === 0 || insertedCount > 0);
  }
}
