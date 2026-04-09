import formatSmartcardNumber from './formatSmartcardNumber';

describe('formatSmartcardNumber', () => {
    it('should format a 12-digit smartcard number correctly', () => {
        const input = '123456789012';
        const expectedOutput = '1234 5678 9012';
        expect(formatSmartcardNumber(input)).toBe(expectedOutput);
    });
});
