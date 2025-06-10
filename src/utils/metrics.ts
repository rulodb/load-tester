export interface Metrics {
  latencies: number[];
  startTime: number;
  endTime: number;
  throughput: Record<string, number>;
  histogram: Record<string, number>;
  errors: number;
  documentsAffected: number;
  operationsCount: number;
  bytesProcessed: number;
}

export interface CalculatedStats {
  total: number;
  min: number;
  average: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: Record<string, number>;
  histogram: Record<string, number>;
  errors: number;
  documentsAffected: number;
  operationsCount: number;
  bytesProcessed: number;
  documentsPerSecond: number;
  averageDocumentsPerOperation: number;
  averageBytesPerOperation: number;
}

export function calculateStats(
  latencies: number[],
  timestamps: number[],
  errors: number,
  documentsAffected: number = 0,
  operationsCount: number = 0,
  bytesProcessed: number = 0,
  duration: number = 0
): CalculatedStats {
  latencies.sort((a, b) => a - b);
  const total = latencies.length;
  const sum = latencies.reduce((a, b) => a + b, 0);
  const average = sum / total;

  const throughput: Record<string, number> = {};
  for (const ts of timestamps) {
    const sec = Math.floor(ts / 1000).toString();
    throughput[sec] = (throughput[sec] || 0) + 1;
  }

  const histogram: Record<string, number> = {};
  for (const latency of latencies) {
    const bucket = Math.floor(latency / 10) * 10;
    const label = `${bucket}-${bucket + 9}`;
    histogram[label] = (histogram[label] || 0) + 1;
  }

  const documentsPerSecond = duration > 0 ? documentsAffected / duration : 0;
  const averageDocumentsPerOperation = operationsCount > 0 ? documentsAffected / operationsCount : 0;
  const averageBytesPerOperation = operationsCount > 0 ? bytesProcessed / operationsCount : 0;

  return {
    total,
    min: latencies[0] || 0,
    average,
    max: latencies[total - 1] || 0,
    p50: latencies[Math.floor(0.5 * total)] || 0,
    p95: latencies[Math.floor(0.95 * total)] || 0,
    p99: latencies[Math.floor(0.99 * total)] || 0,
    throughput,
    histogram,
    errors,
    documentsAffected,
    operationsCount,
    bytesProcessed,
    documentsPerSecond,
    averageDocumentsPerOperation,
    averageBytesPerOperation
  };
}
