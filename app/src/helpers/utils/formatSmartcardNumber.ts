const formatSmartcardNumber = (input: string): string => {
    return input.substring(0, 4) + ' ' + input.substring(4, 8) + ' ' + input.substring(8, 12);
};

export default formatSmartcardNumber;
