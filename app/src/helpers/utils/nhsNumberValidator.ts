const validateNhsNumber = (value: string): boolean | string => {
    if (
        !/^\s*(\d{10})\s*$/.test(value) && // 1234567890
        !/^\s*(\d{3}\s\d{3}\s\d{4})\s*$/.test(value) && // 123 456 7890
        !/^\s*(\d{3}-\d{3}-\d{4})\s*$/.test(value) // 123-456-7890
    ) {
        return false;
    }

    const digitsOnlyValue = value.replaceAll(/\s|-/g, '');
    let modulus = 0;
    for (let i = 0; i < 9; i++) {
        modulus += Number(digitsOnlyValue.charAt(i)) * (10 - i);
    }

    const expectedCheckChar = 11 - (modulus % 11);

    const checkChar = Number(digitsOnlyValue.charAt(9));
    return expectedCheckChar === 11 ? checkChar === 0 : expectedCheckChar === checkChar;
};

export default validateNhsNumber;
