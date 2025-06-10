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
    operations: number;
  };
};

export class RethinkDBWriteHeavyScenario extends Scenario {
  protected tableName = 'write_heavy_test';
  protected seedData: Document[] = [];
  protected insertedIds: string[] = [];
  private readWriteRatio = 0.1; // 10% reads, 90% writes

  constructor() {
    super('write-heavy', new RethinkDBAdapter());
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

    // Seed with moderate amount of data for read operations
    this.seedData = this.generateSeedData(2000);

    // Insert seed data in batches
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
      if (operationType < 0.5) {
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
      } else {
        // Quick category count for monitoring
        const categories = ['A', 'B', 'C', 'D', 'E'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];

        const count = await r
          .table<Document>(this.tableName)
          .filter({ category: randomCategory })
          .count()
          .run(conn as Connection);

        documentsAffected = 1; // Count operation affects metadata understanding
        bytesProcessed = JSON.stringify({ count }).length;
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

      await this.adapter.run(async (conn) => {
        await r
          .table<Document>(this.tableName)
          .insert(document)
          .run(conn as Connection);
      });

      this.insertedIds.push(documentId);
      documentsAffected = 1;
      bytesProcessed = JSON.stringify(document).length;
    } else if (operationType < 0.7) {
      // Update existing document
      const targetDoc =
        Math.random() < 0.5
          ? this.seedData[Math.floor(Math.random() * this.seedData.length)]
          : this.insertedIds.length > 0
            ? { id: this.insertedIds[Math.floor(Math.random() * this.insertedIds.length)] }
            : this.seedData[0];

      const updateData = {
        value: Math.floor(Math.random() * 1000),
        timestamp: new Date().toISOString()
      };

      await this.adapter.run(async (conn) => {
        const result = await r
          .table<Document>(this.tableName)
          .get(targetDoc.id)
          .update(updateData)
          .run(conn as Connection);

        documentsAffected = result.replaced || 0;
      });

      bytesProcessed = JSON.stringify(updateData).length;
    } else if (operationType < 0.85) {
      // Batch insert multiple documents
      const batchSize = Math.floor(Math.random() * 5) + 2; // 2-6 documents
      const documents: Document[] = [];

      for (let i = 0; i < batchSize; i++) {
        const documentId = generateRandomString(16);
        documents.push(this.generateDocument(documentId));
        this.insertedIds.push(documentId);
      }

      await this.adapter.run(async (conn) => {
        await r
          .table<Document>(this.tableName)
          .insert(documents)
          .run(conn as Connection);
      });

      documentsAffected = batchSize;
      bytesProcessed = JSON.stringify(documents).length;
    } else if (operationType < 0.95) {
      // Delete operation
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
      } else {
        // No documents to delete, perform insert instead
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
      }
    } else {
      // Replace operation (upsert)
      const documentId = generateRandomString(16);
      const document: Document = this.generateDocument(documentId);

      await this.adapter.run(async (conn) => {
        const result = await r
          .table<Document>(this.tableName)
          .insert(document, { conflict: 'replace' })
          .run(conn as Connection);

        documentsAffected = (result.inserted || 0) + (result.replaced || 0);
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

    await this.adapter.run(async (conn) => {
      // Check total document count
      totalCount = await r
        .table<Document>(this.tableName)
        .count()
        .run(conn as Connection);

      // Check seed data
      seedCount = await r
        .table<Document>(this.tableName)
        .filter((doc) => doc('id').match('^write-seed-'))
        .count()
        .run(conn as Connection);

      // Check inserted data (if any)
      if (this.insertedIds.length > 0) {
        insertedCount = await r
          .table<Document>(this.tableName)
          .getAll(...this.insertedIds.slice(0, Math.min(10, this.insertedIds.length)))
          .count()
          .run(conn as Connection);
      }
    });

    return totalCount >= seedCount && seedCount >= 1000 && (this.insertedIds.length === 0 || insertedCount > 0);
  }
}
