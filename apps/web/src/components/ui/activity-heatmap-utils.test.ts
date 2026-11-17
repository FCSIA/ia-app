import { expect, test } from 'vitest';
import { activityCells } from './activity-heatmap-utils';
test('inclusive leap and year boundaries, sparse counts', () => {
  expect(activityCells('2024-02-28', '2024-03-01', [{ date: '2024-02-29', messages: 2 }]).map((cell) => cell.messages)).toEqual([0, 2, 0]);
  expect(activityCells('2025-12-31', '2026-01-01', [])).toHaveLength(2);
  expect(activityCells('2025-02-29', '2025-03-01', [])).toEqual([]);
  expect(activityCells('2026-01-02', '2026-01-01', [])).toEqual([]);
});
