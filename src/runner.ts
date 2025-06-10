import { mkdirSync, writeFileSync } from 'fs';
import minimist from 'minimist';
import pLimit from 'p-limit';
import { join } from 'path';

import { createScenarios } from './scenarios/index';
import { calculateStats } from './utils/metrics';

const argv = minimist(process.argv.slice(2), {
  string: ['scenario', 'adapter', 'out'],
  alias: {
    s: 'scenario',
    a: 'adapter',
    c: 'concurrency',
    r: 'requests',
    o: 'out',
    b: 'batch-size'
  },
  default: {
    requests: 1000,
    concurrency: 20,
    out: 'report.json',
    'batch-size': 250
  }
});

if (!argv.scenario) {
  console.error('Error: --scenario is required');
  process.exit(1);
}

function getAdaptersToRun(): string[] {
  const scenarios = createScenarios(argv['batch-size']);

  if (!argv.adapter) {
    // If no adapter specified, run all available adapters for the scenario
    const scenario = scenarios[argv.scenario];
    if (!scenario) {
      throw new Error(`Unknown scenario: ${argv.scenario}`);
    }
    return Object.keys(scenario);
  }

  // Parse comma-separated list of adapters
  return argv.adapter.split(',').map((adapter: string) => adapter.trim());
}

async function runScenarioForAdapter(adapterType: string) {
  console.log(`Running scenario '${argv.scenario}' with adapter '${adapterType}'...`);

  const scenarios = createScenarios(argv['batch-size']);
  const scenarioInstance = scenarios[argv.scenario]?.[adapterType];
  if (!scenarioInstance) {
    throw new Error(`Scenario '${argv.scenario}' not available for adapter '${adapterType}'`);
  }

  await scenarioInstance.setup();

  const limit = pLimit(argv.concurrency);
  const latencies: number[] = [];
  const timestamps: number[] = [];
  let errors = 0;
  let totalDocumentsAffected = 0;
  let totalOperationsCount = 0;
  let totalBytesProcessed = 0;

  const tasks = [];
  const startTime = performance.now();

  for (let i = 0; i < argv.requests; i++) {
    const t = limit(async () => {
      const t1 = performance.now();
      try {
        // Run only the test portion for each request
        const result = await scenarioInstance.test();
        const t2 = performance.now();
        latencies.push(t2 - t1);
        timestamps.push(t1 - startTime);

        totalDocumentsAffected += result.documentsAffected || 0;
        totalOperationsCount += result.operationsCount || 0;
        totalBytesProcessed += result.bytesProcessed || 0;
      } catch (error) {
        errors++;
        if (errors <= 5) {
          console.error(`Request failed:`, error);
        }
      }
    });
    tasks.push(t);
  }

  await Promise.all(tasks);
  const endTime = performance.now();

  try {
    await scenarioInstance.teardown();
  } catch (error) {
    console.warn(`Teardown warning:`, error);
  }

  const duration = (endTime - startTime) / 1000;
  const stats = calculateStats(
    latencies,
    timestamps,
    errors,
    totalDocumentsAffected,
    totalOperationsCount,
    totalBytesProcessed,
    duration
  );
  const qps = argv.requests / duration;

  return {
    adapter: adapterType,
    scenario: argv.scenario,
    requests: argv.requests,
    concurrency: argv.concurrency,
    batchSize: argv['batch-size'],
    duration,
    ...stats,
    qps
  };
}

async function main() {
  try {
    const adaptersToRun = getAdaptersToRun();
    const results = [];

    for (const adapterType of adaptersToRun) {
      console.log(`\n--- Starting ${adapterType} ---`);
      const result = await runScenarioForAdapter(adapterType);
      results.push(result);
      console.log(
        `Completed ${adapterType}: QPS=${result.qps.toFixed(2)}, DPS=${result.documentsPerSecond.toFixed(2)}, Docs=${result.documentsAffected}, Errors=${result.errors}, Duration=${result.duration.toFixed(2)}s`
      );
    }

    // If running multiple adapters, save results as an array
    const output = results.length === 1 ? results[0] : results;

    const resultsDir = 'results';
    try {
      mkdirSync(resultsDir, { recursive: true });
    } catch {
      // Directory might already exist, ignore error
    }

    // Generate output filename based on scenario and adapters
    let outputFile = argv.out;
    if (outputFile === 'report.json') {
      const adapterSuffix = adaptersToRun.length === 1 ? `-${adaptersToRun[0]}` : '-all';
      outputFile = `${argv.scenario}${adapterSuffix}-report.json`;
    }

    const fullOutputPath = join(resultsDir, outputFile);
    writeFileSync(fullOutputPath, JSON.stringify(output, null, 2));
    console.log(`\nResults saved to ${fullOutputPath}`);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main().catch(console.error);
