export const getFormattedDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const getFormattedDateTime = (date: Date): string => {
    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: 'numeric',
        hour12: true,
        timeZone: 'Europe/London',
    });
};

export const formatDateWithDashes = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
};

const getDateFromString = (dateString: string): Date => {
    const numericDate = Number(dateString);

    if (Number.isNaN(numericDate)) {
        return new Date(dateString);
    }

    const absoluteValue = Math.abs(numericDate);
    const milliseconds = absoluteValue < 1_000_000_000_000 ? numericDate * 1000 : numericDate;

    return new Date(milliseconds);
};

export const getFormattedDateFromString = (dateString: string | undefined): string => {
    if (!dateString) {
        return '';
    }

    return getFormattedDate(getDateFromString(dateString));
};

export const getFormattedDateTimeFromString = (dateString: string | undefined): string => {
    if (!dateString) {
        return '';
    }

    return getFormattedDateTime(getDateFromString(dateString));
};
