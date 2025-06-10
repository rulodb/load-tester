import { AdapterType } from '../adapters';

export interface StressTestConfig {
  scenario: string;
  adapters: string[];
  batchSize: number;
  requests: number;
  concurrency: number;
  description: string;
}

export const STRESS_TEST_CONFIGS: Record<string, StressTestConfig> = {
  'light-bulk': {
    scenario: 'bulk-insert',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 50,
    requests: 100,
    concurrency: 5,
    description: 'Light bulk insert test - 5,000 documents total'
  },
  'medium-bulk': {
    scenario: 'bulk-insert',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 250,
    requests: 200,
    concurrency: 10,
    description: 'Medium bulk insert test - 50,000 documents total'
  },
  'heavy-bulk': {
    scenario: 'bulk-insert',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 500,
    requests: 500,
    concurrency: 20,
    description: 'Heavy bulk insert test - 250,000 documents total'
  },
  'extreme-bulk': {
    scenario: 'bulk-insert',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1000,
    requests: 1000,
    concurrency: 50,
    description: 'Extreme bulk insert test - 1,000,000 documents total'
  },
  'single-vs-bulk': {
    scenario: 'basic-insert',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 10000,
    concurrency: 20,
    description: 'Single insert comparison test - 10,000 individual inserts'
  },
  'memory-stress': {
    scenario: 'bulk-insert',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 2000,
    requests: 100,
    concurrency: 5,
    description: 'Memory stress test - Large batches with low concurrency'
  },
  'concurrency-stress': {
    scenario: 'bulk-insert',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 100,
    requests: 500,
    concurrency: 100,
    description: 'Concurrency stress test - High parallel load'
  },
  'balanced-light': {
    scenario: 'balanced-read-write',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 1000,
    concurrency: 10,
    description: 'Light balanced read-write test - 70% reads, 30% writes'
  },
  'balanced-medium': {
    scenario: 'balanced-read-write',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 5000,
    concurrency: 20,
    description: 'Medium balanced read-write test - Mixed workload'
  },
  'balanced-heavy': {
    scenario: 'balanced-read-write',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 10000,
    concurrency: 50,
    description: 'Heavy balanced read-write test - High concurrency mixed workload'
  },
  'read-heavy-balanced': {
    scenario: 'balanced-read-write',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 8000,
    concurrency: 30,
    description: 'Read-heavy workload test using balanced scenario - 70% reads, 30% writes'
  },
  'read-heavy': {
    scenario: 'read-heavy',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 2000,
    concurrency: 15,
    description: 'Pure read-heavy workload test - 90% reads, 10% writes with complex queries'
  },
  'read-intensive': {
    scenario: 'read-heavy',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 5000,
    concurrency: 25,
    description: 'Intensive read workload test - High-volume read operations'
  },
  'read-extreme': {
    scenario: 'read-heavy',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 10000,
    concurrency: 40,
    description: 'Extreme read workload test - Maximum read throughput testing'
  },
  'write-heavy': {
    scenario: 'write-heavy',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 2000,
    concurrency: 15,
    description: 'Pure write-heavy workload test - 90% writes, 10% reads with mixed operations'
  },
  'write-intensive': {
    scenario: 'write-heavy',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 5000,
    concurrency: 25,
    description: 'Intensive write workload test - High-volume write operations'
  },
  'write-extreme': {
    scenario: 'write-heavy',
    adapters: [AdapterType.RETHINKDB, AdapterType.RULODB],
    batchSize: 1,
    requests: 8000,
    concurrency: 35,
    description: 'Extreme write workload test - Maximum write throughput testing'
  }
};

export function generateRunnerCommand(configName: string): string {
  const config = STRESS_TEST_CONFIGS[configName];
  if (!config) {
    throw new Error(`Unknown stress test config: ${configName}`);
  }

  const adaptersFlag =
    config.adapters.length > 1 ? `--adapter ${config.adapters.join(',')}` : `--adapter ${config.adapters[0]}`;

  return `npm run test -- --scenario ${config.scenario} ${adaptersFlag} --batch-size ${config.batchSize} --requests ${config.requests} --concurrency ${config.concurrency} --out ${configName}-report.json`;
}

export function listStressConfigs(): void {
  console.log('\nAvailable stress test configurations:\n');

  Object.entries(STRESS_TEST_CONFIGS).forEach(([name, config]) => {
    const totalDocs = config.batchSize * config.requests;
    console.log(`${name}:`);
    console.log(`  ${config.description}`);
    console.log(`  Scenario: ${config.scenario}`);
    console.log(`  Batch Size: ${config.batchSize.toLocaleString()}`);
    console.log(`  Requests: ${config.requests.toLocaleString()}`);
    console.log(`  Concurrency: ${config.concurrency}`);
    console.log(`  Total Documents: ${totalDocs.toLocaleString()}`);
    console.log(`  Command: ${generateRunnerCommand(name)}`);
    console.log('');
  });
}

export function runStressTest(configName: string): string {
  if (!STRESS_TEST_CONFIGS[configName]) {
    throw new Error(
      `Unknown stress test config: ${configName}. Available configs: ${Object.keys(STRESS_TEST_CONFIGS).join(', ')}`
    );
  }

  return generateRunnerCommand(configName);
}

export function compareConfigs(configNames: string[]): void {
  console.log('\nStress Test Configuration Comparison:\n');

  const configs = configNames.map((name) => {
    const config = STRESS_TEST_CONFIGS[name];
    if (!config) {
      throw new Error(`Unknown config: ${name}`);
    }
    return { name, ...config };
  });

  console.log(
    'Config Name'.padEnd(20) +
      'Batch Size'.padEnd(12) +
      'Requests'.padEnd(10) +
      'Concurrency'.padEnd(12) +
      'Total Docs'.padEnd(12) +
      'Est. Duration'
  );
  console.log('-'.repeat(80));

  configs.forEach((config) => {
    const totalDocs = config.batchSize * config.requests;
    const estimatedDuration = Math.ceil((config.requests / config.concurrency) * 0.1); // Rough estimate

    console.log(
      config.name.padEnd(20) +
        config.batchSize.toLocaleString().padEnd(12) +
        config.requests.toLocaleString().padEnd(10) +
        config.concurrency.toString().padEnd(12) +
        totalDocs.toLocaleString().padEnd(12) +
        `~${estimatedDuration}s`
    );
  });

  console.log('');
}

export function getRecommendedProgression(): string[] {
  return [
    'light-bulk',
    'medium-bulk',
    'single-vs-bulk',
    'balanced-light',
    'read-heavy',
    'write-heavy',
    'balanced-medium',
    'heavy-bulk',
    'read-intensive',
    'write-intensive',
    'read-heavy-balanced',
    'memory-stress',
    'concurrency-stress',
    'balanced-heavy',
    'read-extreme',
    'write-extreme',
    'extreme-bulk'
  ];
}

export function validateBatchSize(batchSize: number, scenario: string): boolean {
  const maxRecommended = scenario === 'bulk-insert' ? 5000 : 1;
  const minRecommended = scenario === 'bulk-insert' ? 10 : 1;

  // Read/write focused scenarios should use batch size 1
  if (['balanced-read-write', 'read-heavy', 'write-heavy'].includes(scenario) && batchSize !== 1) {
    console.warn(`Warning: ${scenario} scenarios should use batch size 1, got ${batchSize}`);
    return false;
  }

  if (batchSize < minRecommended || batchSize > maxRecommended) {
    console.warn(
      `Warning: Batch size ${batchSize} is outside recommended range for ${scenario} (${minRecommended}-${maxRecommended})`
    );
    return false;
  }

  return true;
}

export function estimateMemoryUsage(batchSize: number, concurrency: number): string {
  // Rough estimate: each document ~200 bytes, plus overhead
  const docSize = 250; // bytes
  const memoryPerBatch = batchSize * docSize;
  const totalMemory = memoryPerBatch * concurrency;

  if (totalMemory < 1024 * 1024) {
    return `~${Math.ceil(totalMemory / 1024)}KB`;
  } else {
    return `~${Math.ceil(totalMemory / (1024 * 1024))}MB`;
  }
}
