import { describe, expect, it, beforeAll } from 'vitest';
import './string-extensions';

describe('String.prototype.toSentenceCase', () => {
    beforeAll(() => {
        // Ensure the extension is loaded
        import('./string-extensions');
    });

    describe('Basic functionality', () => {
        it('converts first letter to uppercase and rest to lowercase', () => {
            const result = 'hello world'.toSentenceCase();
            expect(result).toBe('Hello world');
        });

        it('converts all uppercase string to sentence case', () => {
            const result = 'HELLO WORLD'.toSentenceCase();
            expect(result).toBe('Hello world');
        });

        it('converts mixed case string to sentence case', () => {
            const result = 'hELLo WoRLd'.toSentenceCase();
            expect(result).toBe('Hello world');
        });

        it('handles already correctly formatted sentence case', () => {
            const result = 'Hello world'.toSentenceCase();
            expect(result).toBe('Hello world');
        });

        it('converts lowercase string to sentence case', () => {
            const result = 'test string'.toSentenceCase();
            expect(result).toBe('Test string');
        });
    });

    describe('Edge cases', () => {
        it('handles empty string', () => {
            const result = ''.toSentenceCase();
            expect(result).toBe('');
        });

        it('handles single character lowercase', () => {
            const result = 'a'.toSentenceCase();
            expect(result).toBe('A');
        });

        it('handles single character uppercase', () => {
            const result = 'A'.toSentenceCase();
            expect(result).toBe('A');
        });

        it('handles string with only spaces', () => {
            const result = '   '.toSentenceCase();
            expect(result).toBe('   ');
        });

        it('handles string starting with space', () => {
            const result = ' hello'.toSentenceCase();
            expect(result).toBe(' hello');
        });
    });

    describe('Special characters', () => {
        it('handles string with numbers', () => {
            const result = '123 hello'.toSentenceCase();
            expect(result).toBe('123 hello');
        });

        it('handles string starting with number', () => {
            const result = '1st place'.toSentenceCase();
            expect(result).toBe('1st place');
        });

        it('handles string with punctuation', () => {
            const result = 'hello, world!'.toSentenceCase();
            expect(result).toBe('Hello, world!');
        });

        it('handles string with special characters', () => {
            const result = 'hello@world'.toSentenceCase();
            expect(result).toBe('Hello@world');
        });

        it('handles string with hyphens', () => {
            const result = 'hello-world'.toSentenceCase();
            expect(result).toBe('Hello-world');
        });

        it('handles string with underscores', () => {
            const result = 'hello_world'.toSentenceCase();
            expect(result).toBe('Hello_world');
        });
    });

    describe('Multi-word strings', () => {
        it('handles multiple words correctly', () => {
            const result = 'the quick brown fox'.toSentenceCase();
            expect(result).toBe('The quick brown fox');
        });

        it('handles sentence with multiple capital letters', () => {
            const result = 'NHS PATIENT RECORD'.toSentenceCase();
            expect(result).toBe('Nhs patient record');
        });

        it('handles medical terminology', () => {
            const result = 'LLOYD GEORGE RECORD'.toSentenceCase();
            expect(result).toBe('Lloyd george record');
        });

        it('handles long sentences', () => {
            const result = 'THIS IS A VERY LONG SENTENCE WITH MANY WORDS'.toSentenceCase();
            expect(result).toBe('This is a very long sentence with many words');
        });
    });

    describe('Unicode and international characters', () => {
        it('handles string with accented characters', () => {
            const result = 'CAFÉ'.toSentenceCase();
            expect(result).toBe('Café');
        });

        it('handles string with unicode characters', () => {
            const result = 'HËLLÖ WÖRLD'.toSentenceCase();
            expect(result).toBe('Hëllö wörld');
        });

        it('handles string with emoji', () => {
            const result = '😀 HELLO'.toSentenceCase();
            expect(result).toBe('😀 hello');
        });
    });

    describe('Real-world use cases', () => {
        it('formats document type names', () => {
            const result = 'LLOYD GEORGE'.toSentenceCase();
            expect(result).toBe('Lloyd george');
        });

        it('formats status messages', () => {
            const result = 'UPLOAD SUCCESSFUL'.toSentenceCase();
            expect(result).toBe('Upload successful');
        });

        it('formats error messages', () => {
            const result = 'FILE NOT FOUND'.toSentenceCase();
            expect(result).toBe('File not found');
        });

        it('formats user-entered text', () => {
            const result = 'JOHN SMITH'.toSentenceCase();
            expect(result).toBe('John smith');
        });
    });

    describe('Method chaining', () => {
        it('can be chained with other string methods', () => {
            const result = 'HELLO WORLD'.toSentenceCase().trim();
            expect(result).toBe('Hello world');
        });

        it('can be called multiple times', () => {
            const result = 'HELLO'.toSentenceCase().toSentenceCase();
            expect(result).toBe('Hello');
        });

        it('works with template literals', () => {
            const name = 'JOHN';
            const result = `${name.toSentenceCase()} DOE`.toSentenceCase();
            expect(result).toBe('John doe');
        });
    });

    describe('Type safety', () => {
        it('returns string type', () => {
            const result = 'test'.toSentenceCase();
            expect(typeof result).toBe('string');
        });

        it('preserves string length for non-empty strings', () => {
            const input = 'HELLO';
            const result = input.toSentenceCase();
            expect(result.length).toBe(input.length);
        });

        it('returns empty string for empty input', () => {
            const result = ''.toSentenceCase();
            expect(result).toBe('');
            expect(result.length).toBe(0);
        });
    });
});
