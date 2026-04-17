declare global {
    interface String {
        toSentenceCase(): string;
    }
}

String.prototype.toSentenceCase = function (): string {
    if (this.length === 0) {
        return '';
    }
    const lowerCaseString = this.toLowerCase();
    return lowerCaseString.charAt(0).toUpperCase() + lowerCaseString.slice(1);
};

export {};
