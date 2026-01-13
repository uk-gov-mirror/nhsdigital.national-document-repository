import { describe, expect, it } from 'vitest';
import { getFormattedDate, formatDateWithDashes, getFormattedDateFromString } from './formatDate';

describe('getFormattedDate', () => {
    it('formats date in en-GB locale with full month name', () => {
        const date = new Date('2025-12-18T10:30:00Z');
        const result = getFormattedDate(date);
        expect(result).toBe('18 December 2025');
    });

    it('formats date on 1st of month', () => {
        const date = new Date('2025-01-01T00:00:00Z');
        const result = getFormattedDate(date);
        expect(result).toBe('1 January 2025');
    });

    it('formats date at end of month', () => {
        const date = new Date('2025-12-31T23:59:59Z');
        const result = getFormattedDate(date);
        expect(result).toBe('31 December 2025');
    });

    it('formats date in February', () => {
        const date = new Date('2025-02-14T12:00:00Z');
        const result = getFormattedDate(date);
        expect(result).toBe('14 February 2025');
    });

    it('formats date with single digit day', () => {
        const date = new Date('2025-03-05T08:00:00Z');
        const result = getFormattedDate(date);
        expect(result).toBe('5 March 2025');
    });

    it('formats leap year date', () => {
        const date = new Date('2024-02-29T00:00:00Z');
        const result = getFormattedDate(date);
        expect(result).toBe('29 February 2024');
    });

    it('formats different months correctly', () => {
        const months = [
            { date: new Date('2025-01-15'), expected: '15 January 2025' },
            { date: new Date('2025-02-15'), expected: '15 February 2025' },
            { date: new Date('2025-03-15'), expected: '15 March 2025' },
            { date: new Date('2025-04-15'), expected: '15 April 2025' },
            { date: new Date('2025-05-15'), expected: '15 May 2025' },
            { date: new Date('2025-06-15'), expected: '15 June 2025' },
            { date: new Date('2025-07-15'), expected: '15 July 2025' },
            { date: new Date('2025-08-15'), expected: '15 August 2025' },
            { date: new Date('2025-09-15'), expected: '15 September 2025' },
            { date: new Date('2025-10-15'), expected: '15 October 2025' },
            { date: new Date('2025-11-15'), expected: '15 November 2025' },
            { date: new Date('2025-12-15'), expected: '15 December 2025' },
        ];

        months.forEach(({ date, expected }) => {
            expect(getFormattedDate(date)).toBe(expected);
        });
    });

    it('formats date in different years', () => {
        const date1900 = new Date('1900-01-01');
        const date2000 = new Date('2000-06-15');
        const date2099 = new Date('2099-12-31');

        expect(getFormattedDate(date1900)).toBe('1 January 1900');
        expect(getFormattedDate(date2000)).toBe('15 June 2000');
        expect(getFormattedDate(date2099)).toBe('31 December 2099');
    });
});

describe('formatDateWithDashes', () => {
    it('formats date with DD-MM-YYYY format', () => {
        const date = new Date('2025-12-18T10:30:00Z');
        const result = formatDateWithDashes(date);
        expect(result).toBe('18-12-2025');
    });

    it('pads single digit day with leading zero', () => {
        const date = new Date('2025-01-05T00:00:00Z');
        const result = formatDateWithDashes(date);
        expect(result).toBe('05-01-2025');
    });

    it('pads single digit month with leading zero', () => {
        const date = new Date('2025-09-18T00:00:00Z');
        const result = formatDateWithDashes(date);
        expect(result).toBe('18-09-2025');
    });

    it('formats date on 1st of month with leading zero', () => {
        const date = new Date('2025-03-01T00:00:00Z');
        const result = formatDateWithDashes(date);
        expect(result).toBe('01-03-2025');
    });

    it('formats date at end of month without leading zero', () => {
        const date = new Date('2025-12-31T23:59:59Z');
        const result = formatDateWithDashes(date);
        expect(result).toBe('31-12-2025');
    });

    it('formats February dates correctly', () => {
        const date = new Date('2025-02-14T12:00:00Z');
        const result = formatDateWithDashes(date);
        expect(result).toBe('14-02-2025');
    });

    it('formats leap year date', () => {
        const date = new Date('2024-02-29T00:00:00Z');
        const result = formatDateWithDashes(date);
        expect(result).toBe('29-02-2024');
    });

    it('formats all months correctly', () => {
        const months = [
            { date: new Date('2025-01-15'), expected: '15-01-2025' },
            { date: new Date('2025-02-15'), expected: '15-02-2025' },
            { date: new Date('2025-03-15'), expected: '15-03-2025' },
            { date: new Date('2025-04-15'), expected: '15-04-2025' },
            { date: new Date('2025-05-15'), expected: '15-05-2025' },
            { date: new Date('2025-06-15'), expected: '15-06-2025' },
            { date: new Date('2025-07-15'), expected: '15-07-2025' },
            { date: new Date('2025-08-15'), expected: '15-08-2025' },
            { date: new Date('2025-09-15'), expected: '15-09-2025' },
            { date: new Date('2025-10-15'), expected: '15-10-2025' },
            { date: new Date('2025-11-15'), expected: '15-11-2025' },
            { date: new Date('2025-12-15'), expected: '15-12-2025' },
        ];

        months.forEach(({ date, expected }) => {
            expect(formatDateWithDashes(date)).toBe(expected);
        });
    });

    it('formats dates with single digit day and month', () => {
        const date = new Date('2025-01-01T00:00:00Z');
        const result = formatDateWithDashes(date);
        expect(result).toBe('01-01-2025');
    });

    it('formats dates in different years', () => {
        const date1900 = new Date('1900-01-01');
        const date2000 = new Date('2000-06-05');
        const date2099 = new Date('2099-12-09');

        expect(formatDateWithDashes(date1900)).toBe('01-01-1900');
        expect(formatDateWithDashes(date2000)).toBe('05-06-2000');
        expect(formatDateWithDashes(date2099)).toBe('09-12-2099');
    });

    it('handles dates with different times consistently', () => {
        // Use local date construction to avoid timezone issues
        const midnight = new Date(2025, 5, 15, 0, 0, 0);
        const noon = new Date(2025, 5, 15, 12, 0, 0);
        const endOfDay = new Date(2025, 5, 15, 23, 59, 59);

        expect(formatDateWithDashes(midnight)).toBe('15-06-2025');
        expect(formatDateWithDashes(noon)).toBe('15-06-2025');
        expect(formatDateWithDashes(endOfDay)).toBe('15-06-2025');
    });
});

describe('getFormattedDateFromString', () => {
    describe('empty or undefined input', () => {
        it('returns empty string for undefined', () => {
            const result = getFormattedDateFromString(undefined);
            expect(result).toBe('');
        });

        it('returns empty string for empty string', () => {
            const result = getFormattedDateFromString('');
            expect(result).toBe('');
        });
    });

    describe('ISO date string format', () => {
        it('formats ISO date string correctly', () => {
            const result = getFormattedDateFromString('2025-12-18T10:30:00Z');
            expect(result).toBe('18 December 2025');
        });

        it('formats ISO date without time', () => {
            const result = getFormattedDateFromString('2025-01-15');
            expect(result).toBe('15 January 2025');
        });

        it('formats ISO date with timezone offset', () => {
            const result = getFormattedDateFromString('2025-06-15T14:30:00+01:00');
            expect(result).toBe('15 June 2025');
        });

        it('formats ISO date string with milliseconds', () => {
            const result = getFormattedDateFromString('2025-03-20T10:30:00.123Z');
            expect(result).toBe('20 March 2025');
        });
    });

    describe('numeric timestamp format', () => {
        it('formats numeric timestamp string (milliseconds)', () => {
            const timestamp = '1734523800000'; // December 18, 2024
            const result = getFormattedDateFromString(timestamp);
            expect(result).toContain('December');
            expect(result).toContain('2024');
        });

        it('formats timestamp at epoch start', () => {
            const result = getFormattedDateFromString('0');
            expect(result).toBe('1 January 1970');
        });

        it('formats recent timestamp', () => {
            // January 1, 2025 00:00:00 UTC
            const timestamp = '1735689600000';
            const result = getFormattedDateFromString(timestamp);
            expect(result).toBe('1 January 2025');
        });

        it('formats future timestamp', () => {
            // December 31, 2099 23:59:59 UTC
            const timestamp = String(new Date('2099-12-31T23:59:59Z').getTime());
            const result = getFormattedDateFromString(timestamp);
            expect(result).toBe('31 December 2099');
        });
    });

    describe('various date string formats', () => {
        it('formats US date format (MM/DD/YYYY)', () => {
            const result = getFormattedDateFromString('12/18/2025');
            expect(result).toContain('December');
            expect(result).toContain('2025');
        });

        it('formats date with full month name', () => {
            const result = getFormattedDateFromString('December 18, 2025');
            expect(result).toBe('18 December 2025');
        });

        it('formats short date format', () => {
            const result = getFormattedDateFromString('2025-12-18');
            expect(result).toBe('18 December 2025');
        });
    });

    describe('edge cases', () => {
        it('handles leap year date', () => {
            const result = getFormattedDateFromString('2024-02-29');
            expect(result).toBe('29 February 2024');
        });

        it('handles date at start of year', () => {
            const result = getFormattedDateFromString('2025-01-01T00:00:00Z');
            expect(result).toBe('1 January 2025');
        });

        it('handles date at end of year', () => {
            const result = getFormattedDateFromString('2025-12-31T23:59:59Z');
            expect(result).toBe('31 December 2025');
        });

        it('formats timestamp string with spaces (treated as NaN)', () => {
            const result = getFormattedDateFromString('  12345  ');
            // This will be treated as numeric timestamp
            expect(result).toBeTruthy();
        });

        it('handles various ISO formats', () => {
            const formats = [
                { input: '2025-06-15T12:00:00Z', expected: '15 June 2025' },
                { input: '2025-06-15T12:00:00.000Z', expected: '15 June 2025' },
                { input: '2025-06-15', expected: '15 June 2025' },
            ];

            formats.forEach(({ input, expected }) => {
                expect(getFormattedDateFromString(input)).toBe(expected);
            });
        });
    });

    describe('timestamp conversion logic', () => {
        it('distinguishes between numeric string and ISO string', () => {
            const numericTimestamp = '1735689600000';
            const isoString = '2025-01-01T00:00:00Z';

            const numericResult = getFormattedDateFromString(numericTimestamp);
            const isoResult = getFormattedDateFromString(isoString);

            expect(numericResult).toBe('1 January 2025');
            expect(isoResult).toBe('1 January 2025');
        });

        it('handles very large timestamp', () => {
            // Far future date
            const timestamp = String(new Date('2099-12-31').getTime());
            const result = getFormattedDateFromString(timestamp);
            expect(result).toContain('2099');
        });

        it('handles small timestamp (early 1970s)', () => {
            const timestamp = '86400000'; // 1 day after epoch
            const result = getFormattedDateFromString(timestamp);
            expect(result).toBe('2 January 1970');
        });
    });

    describe('consistency with getFormattedDate', () => {
        it('produces same output as getFormattedDate for ISO string', () => {
            const dateString = '2025-06-15T10:30:00Z';
            const date = new Date(dateString);

            const fromString = getFormattedDateFromString(dateString);
            const fromDate = getFormattedDate(date);

            expect(fromString).toBe(fromDate);
        });

        it('produces same output as getFormattedDate for numeric timestamp', () => {
            const timestamp = Date.now();
            const timestampString = String(timestamp);
            const date = new Date(timestamp);

            const fromString = getFormattedDateFromString(timestampString);
            const fromDate = getFormattedDate(date);

            expect(fromString).toBe(fromDate);
        });
    });
});
