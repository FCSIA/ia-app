import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatePicker } from './date-picker';
import type { DatePickerProps } from './date-picker';

const date = new Date(2026, 10, 6);
const cases: DatePickerProps[] = [
  { defaultValue: date },
  { mode: 'range', defaultValue: { from: date, to: new Date(2026, 10, 7) } },
  { defaultValue: date, defaultTime: '09:30' },
  { defaultValue: date, defaultTimeRange: { start: '09:30', end: '10:30' } },
];

describe('DatePicker native form boundary', () => {
  test.each(cases)('forwards disabled to the serialized form control: %j', (props) => {
    const enabled = renderToStaticMarkup(<DatePicker {...props} name="meeting" />);
    const disabled = renderToStaticMarkup(<DatePicker {...props} name="meeting" disabled />);
    const field = (html: string) => html.match(/<input[^>]*type="hidden"[^>]*>/)?.[0];
    expect(field(enabled)).toContain('name="meeting"');
    expect(field(enabled)).toContain('value=');
    expect(field(enabled)).not.toContain('disabled=');
    expect(field(disabled)).toContain('disabled=""');
  });
});
