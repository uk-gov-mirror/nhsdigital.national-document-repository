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
    });
};

export const formatDateWithDashes = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    return `${day}-${month}-${year}`;
};

export const getFormattedDateFromString = (dateString: string | undefined): string => {
    if (!dateString) {
        return '';
    }
    if (Number.isNaN(Number(dateString))) {
        return getFormattedDate(new Date(dateString));
    }
    return getFormattedDate(new Date(Number(dateString)));
};

export const getFormattedDateTimeFromString = (dateString: string | undefined): string => {
    if (!dateString) {
        return '';
    }
    if (Number.isNaN(Number(dateString))) {
        return getFormattedDateTime(new Date(dateString));
    }
    return getFormattedDateTime(new Date(Number(dateString)));
};
