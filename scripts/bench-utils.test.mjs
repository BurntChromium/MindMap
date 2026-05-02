import { describe, expect, it } from 'vitest';
import {
  compareBenchmarkReports,
  normalizeBenchmarkReport,
  parseBenchmarkArgs
} from './bench-utils.mjs';

const rawReport = {
  files: [
    {
      filepath: '/repo/src/benchmarks/sample.bench.ts',
      groups: [
        {
          fullName: 'src/benchmarks/sample.bench.ts > sample group',
          benchmarks: [
            {
              name: 'thing',
              hz: 100,
              mean: 10,
              min: 8,
              max: 12,
              median: 10,
              p99: 12,
              p995: 12,
              p999: 12,
              rme: 4,
              sampleCount: 20
            }
          ]
        }
      ]
    }
  ]
};

describe('bench utils', () => {
  it('normalizes benchmark paths to repo-relative entries', () => {
    expect(normalizeBenchmarkReport(rawReport, '/repo')).toEqual({
      version: 1,
      files: [
        {
          filepath: 'src/benchmarks/sample.bench.ts',
          groups: [
            {
              name: 'src/benchmarks/sample.bench.ts > sample group',
              benchmarks: [
                expect.objectContaining({
                  name: 'thing',
                  hz: 100,
                  sampleCount: 20
                })
              ]
            }
          ]
        }
      ]
    });
  });

  it('compares benchmark reports and detects regressions', () => {
    const baseline = normalizeBenchmarkReport(rawReport, '/repo');
    const current = normalizeBenchmarkReport(
      {
        files: [
          {
            filepath: '/repo/src/benchmarks/sample.bench.ts',
            groups: [
              {
                fullName: 'src/benchmarks/sample.bench.ts > sample group',
                benchmarks: [
                  {
                    name: 'thing',
                    hz: 90,
                    mean: 11,
                    min: 8,
                    max: 12,
                    median: 10,
                    p99: 12,
                    p995: 12,
                    p999: 12,
                    rme: 4,
                    sampleCount: 20
                  }
                ]
              }
            ]
          }
        ]
      },
      '/repo'
    );

    expect(compareBenchmarkReports(baseline, current, 5)).toEqual(
      expect.objectContaining({
        passed: false,
        regressions: [
          expect.objectContaining({
            filepath: 'src/benchmarks/sample.bench.ts',
            groupName: 'src/benchmarks/sample.bench.ts > sample group',
            name: 'thing'
          })
        ],
        missing: [],
        extra: []
      })
    );
  });

  it('ignores diagnostic benchmarks by default', () => {
    const baseline = normalizeBenchmarkReport(
      {
        files: [
          {
            filepath: '/repo/src/benchmarks/sample.bench.ts',
            groups: [
              {
                fullName: 'src/benchmarks/sample.bench.ts > sample group',
                benchmarks: [
                  {
                    name: 'cached repeat probe',
                    hz: 100,
                    mean: 10,
                    min: 8,
                    max: 12,
                    median: 10,
                    p99: 12,
                    p995: 12,
                    p999: 12,
                    rme: 4,
                    sampleCount: 20
                  }
                ]
              }
            ]
          }
        ]
      },
      '/repo'
    );
    const current = normalizeBenchmarkReport(
      {
        files: [
          {
            filepath: '/repo/src/benchmarks/sample.bench.ts',
            groups: [
              {
                fullName: 'src/benchmarks/sample.bench.ts > sample group',
                benchmarks: [
                  {
                    name: 'cached repeat probe',
                    hz: 10,
                    mean: 100,
                    min: 8,
                    max: 12,
                    median: 10,
                    p99: 12,
                    p995: 12,
                    p999: 12,
                    rme: 4,
                    sampleCount: 20
                  }
                ]
              }
            ]
          }
        ]
      },
      '/repo'
    );

    expect(compareBenchmarkReports(baseline, current, 5)).toEqual(
      expect.objectContaining({
        passed: true,
        regressions: [],
        missing: [],
        extra: []
      })
    );
  });

  it('parses benchmark CLI arguments', () => {
    expect(parseBenchmarkArgs(['node', 'scripts/bench.mjs', 'compare', '--baseline', 'custom.json', '--budget', '7'])).toEqual({
      command: 'compare',
      baselinePath: 'custom.json',
      budgetPct: 7
    });
  });
});
