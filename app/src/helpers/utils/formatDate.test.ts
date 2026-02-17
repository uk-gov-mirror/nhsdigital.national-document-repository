import { describe, expect, it } from 'vitest';
import {
    getFormattedDate,
    getFormattedDateTime,
    formatDateWithDashes,
    getFormattedDateFromString,
    getFormattedDateTimeFromString,
} from './formatDate';

describe('formatDate.ts', () => {
    describe('getFormattedDate', () => {
        it('formats date in en-GB locale', () => {
            expect(getFormattedDate(new Date('2024-01-15T00:00:00Z'))).toBe('15 January 2024');
            expect(getFormattedDate(new Date('2024-02-29T00:00:00Z'))).toBe('29 February 2024');
            expect(getFormattedDate(new Date('2025-12-31T23:59:59Z'))).toBe('31 December 2025');
        });
    });

    describe('getFormattedDateTime', () => {
        it('formats date and time in en-GB locale', () => {
            const result = getFormattedDateTime(new Date('2024-06-20T13:05:00Z'));
            expect(result).toContain('20 June 2024');
            expect(/\d{1,2}:[0-5][0-9]/.test(result)).toBe(true);
        });
    });

    describe('formatDateWithDashes', () => {
        it('formats date as DD-MM-YYYY with zero padding', () => {
            expect(formatDateWithDashes(new Date('2025-01-05T00:00:00Z'))).toBe('05-01-2025');
            expect(formatDateWithDashes(new Date('2025-12-18T10:30:00Z'))).toBe('18-12-2025');
            expect(formatDateWithDashes(new Date('2024-02-29T00:00:00Z'))).toBe('29-02-2024');
        });
    });

    describe('getFormattedDateFromString', () => {
        it('returns empty string for undefined or empty input', () => {
            expect(getFormattedDateFromString(undefined)).toBe('');
            expect(getFormattedDateFromString('')).toBe('');
        });

        it('formats ISO date strings', () => {
            expect(getFormattedDateFromString('2025-12-18T10:30:00Z')).toBe('18 December 2025');
            expect(getFormattedDateFromString('2025-01-15')).toBe('15 January 2025');
            expect(getFormattedDateFromString('2024-02-29')).toBe('29 February 2024');
        });

        it('formats numeric timestamp strings', () => {
            expect(getFormattedDateFromString('0')).toBe('1 January 1970');
            expect(getFormattedDateFromString('1735689600000')).toBe('1 January 2025');
        });
    });

    describe('getFormattedDateTimeFromString', () => {
        it('returns empty string for undefined input', () => {
            expect(getFormattedDateTimeFromString(undefined)).toBe('');
        });

        it('formats ISO date strings with time', () => {
            const result = getFormattedDateTimeFromString('2022-11-11T18:45:00');
            expect(result).toContain('11 November 2022');
            expect(/\d{1,2}:[0-5][0-9]/.test(result)).toBe(true);
        });

        it('formats numeric timestamp strings with time', () => {
            const ts = String(new Date('2024-07-21T09:30:00Z'));
            const result = getFormattedDateTimeFromString(ts);
            expect(result).toContain('21 July 2024');
            expect(/\d{1,2}:[0-5][0-9]/.test(result)).toBe(true);
        });
    });

    describe('format epoch dates in seconds', () => {
        it('getFormattedDateTimeFromString formats numeric timestamp strings in seconds', () => {
            const result = getFormattedDateTimeFromString('1735689600');
            expect(result).toContain('1 January 2025');
        });

        it('getFormattedDateFromString formats numeric timestamp strings in seconds', () => {
            const result = getFormattedDateFromString('1735689600');
            expect(result).toBe('1 January 2025');
        });
    });

    describe('format epoch dates in milliseconds', () => {
        it('getFormattedDateTimeFromString formats numeric timestamp strings in milliseconds', () => {
            const result = getFormattedDateTimeFromString('1735689600000');
            expect(result).toContain('1 January 2025');
        });

        it('getFormattedDateFromString formats numeric timestamp strings in milliseconds', () => {
            const result = getFormattedDateFromString('1735689600000');
            expect(result).toBe('1 January 2025');
        });
    });

    describe('formats date strings and large epoch seconds', () => {
        it('getFormattedDateTimeFromString formats date string', () => {
            const result = getFormattedDateTimeFromString('Saturday, November 20, 2286 5:46:40 PM');
            expect(result).toContain('20 November 2286');
        });

        it('getFormattedDateFromString formats epoch value 100000000000', () => {
            const result = getFormattedDateFromString('100000000000');
            expect(result).toBe('16 November 5138');
        });

        it('getFormattedDateTimeFromString formats epoch value', () => {
            const result = getFormattedDateTimeFromString('100000000000');
            expect(result).toBe('16 November 5138 at 09:46 am');
        });
    });

    describe('formats very large epoch values in seconds', () => {
        const epochSecondCases = [
            {
                epoch: '10000000000',
                expectedDate: '20 November 2286',
                expectedDateTime: '20 November 2286 at 05:46 pm',
            },
            {
                epoch: '100000000000',
                expectedDate: '16 November 5138',
                expectedDateTime: '16 November 5138 at 09:46 am',
            },
            {
                epoch: '999999999999',
                expectedDate: '27 September 33658',
                expectedDateTime: '27 September 33658 at 02:46 am',
            },
        ];

        it.each(epochSecondCases)(
            'getFormattedDateFromString formats epoch as seconds',
            ({ epoch, expectedDate }) => {
                const result = getFormattedDateFromString(epoch);
                expect(result).toBe(expectedDate);
            },
        );

        it.each(epochSecondCases)(
            'getFormattedDateTimeFromString formats epoch as seconds',
            ({ epoch, expectedDateTime }) => {
                const result = getFormattedDateTimeFromString(epoch);
                expect(result).toBe(expectedDateTime);
            },
        );
    });
});
