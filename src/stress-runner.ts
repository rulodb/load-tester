import minimist from 'minimist';

import {
  compareConfigs,
  generateRunnerCommand,
  getRecommendedProgression,
  listStressConfigs,
  STRESS_TEST_CONFIGS
} from './utils/stress-config';

const argv = minimist(process.argv.slice(2), {
  string: ['config', 'compare'],
  boolean: ['list', 'recommended', 'help'],
  alias: {
    c: 'config',
    l: 'list',
    r: 'recommended',
    h: 'help'
  }
});

function showHelp() {
  console.log(`
Stress Test Runner

Usage:
  npm run stress -- [options]

Options:
  -c, --config <name>     Run a specific stress test configuration
  -l, --list             List all available stress test configurations
  -r, --recommended      Show recommended stress test progression
  --compare <configs>    Compare multiple configurations (comma-separated)
  -h, --help            Show this help message

Examples:
  npm run stress -- --list
  npm run stress -- --config light-bulk
  npm run stress -- --config balanced-medium
  npm run stress -- --compare light-bulk,medium-bulk,heavy-bulk
  npm run stress -- --recommended

Available configurations:
${Object.keys(STRESS_TEST_CONFIGS).join(', ')}
`);
}

async function main() {
  if (argv.help) {
    showHelp();
    return;
  }

  if (argv.list) {
    listStressConfigs();
    return;
  }

  if (argv.recommended) {
    console.log('\nRecommended stress test progression:\n');
    const progression = getRecommendedProgression();
    progression.forEach((configName, index) => {
      const config = STRESS_TEST_CONFIGS[configName];
      console.log(`${index + 1}. ${configName}`);
      console.log(`   ${config.description}`);
      console.log(`   Command: npm run stress -- --config ${configName}`);
      console.log('');
    });
    return;
  }

  if (argv.compare) {
    const configNames = argv.compare.split(',').map((name: string) => name.trim());
    try {
      compareConfigs(configNames);
    } catch (error) {
      console.error('Error comparing configs:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
    return;
  }

  if (argv.config) {
    const configName = argv.config;

    if (!STRESS_TEST_CONFIGS[configName]) {
      console.error(`Unknown stress test configuration: ${configName}`);
      console.error(`Available configurations: ${Object.keys(STRESS_TEST_CONFIGS).join(', ')}`);
      process.exit(1);
    }

    const config = STRESS_TEST_CONFIGS[configName];
    console.log(`\nRunning stress test: ${configName}`);
    console.log(`Description: ${config.description}`);
    console.log('');

    // Generate and execute the command
    const command = generateRunnerCommand(configName);
    console.log(`Executing: ${command}\n`);

    // Use Bun's built-in process spawning
    const proc = Bun.spawn(command.split(' '), {
      stdio: ['inherit', 'inherit', 'inherit']
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      console.error(`\nStress test failed with exit code ${exitCode}`);
      process.exit(exitCode);
    }

    console.log(`\nStress test '${configName}' completed successfully!`);
    console.log(`Results saved to results/${configName}-report.json`);
    return;
  }

  // No specific action provided, show help
  console.log('No action specified. Use --help for usage information.');
  showHelp();
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
