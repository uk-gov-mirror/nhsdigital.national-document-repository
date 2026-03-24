import validateNhsNumber from './nhsNumberValidator';

describe('validateNhsNumber', () => {
    const validNhsNumbers = [
        '2234567890',
        '223 456 7890',
        '223-456-7890',
        '  2234567890  ',
        '  223 456 7890  ',
        '  223-456-7890  ',
        '2222222222',
    ];

    const invalidNhsNumbers = [
        '2234567891',
        '2222222220', // Invalid check digit
        '123456789', // Too short
        '12345678901', // Too long
        '1234 567890', // Incorrect spacing
        '123-45-67890', // Incorrect dashes
        'abcdefghij', // Non-numeric characters
        '', // Empty string
        '   ', // Only whitespace
    ];

    it.each(validNhsNumbers)(`should return true for valid NHS number: "%s"`, (nhsNumber) => {
        expect(validateNhsNumber(nhsNumber)).toBe(true);
    });

    it.each(invalidNhsNumbers)(`should return false for invalid NHS number: "%s"`, (nhsNumber) => {
        expect(validateNhsNumber(nhsNumber)).toBe(false);
    });
});
