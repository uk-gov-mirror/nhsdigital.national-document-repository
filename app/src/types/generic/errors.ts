import { ErrorResponse } from './errorResponse';

class DownloadManifestError extends Error {
    response: { data: ErrorResponse };

    constructor(message: string) {
        super(message);
        this.name = 'DownloadManifestError';
        this.response = {
            data: {
                message,
                err_code: 'DMS_2001',
            },
        };
    }
}

export { DownloadManifestError };

class StitchRecordError extends Error {
    response: { data: ErrorResponse };

    constructor(message: string) {
        super(message);
        this.name = 'StitchRecordError';
        this.response = {
            data: {
                message,
                err_code: 'LGS_5000',
            },
        };
    }
}

export { StitchRecordError };

export enum UIErrorCode {
    USER_PATIENT_RESTRICTIONS_SELF_ADD = 'UPR01',
    PATIENT_NOT_REGISTERED_AT_YOUR_PRACTICE = 'PA001',
    PATIENT_ACCESS_RESTRICTED = 'PA002',
}

export type UIErrorContent = {
    title: string;
    messageParagraphs: string[];
};

export const UIErrors: Record<UIErrorCode, UIErrorContent> = {
    // self add restriction error
    [UIErrorCode.USER_PATIENT_RESTRICTIONS_SELF_ADD]: {
        title: 'You cannot add a restriction on your own NHS smartcard number',
        messageParagraphs: [
            'If you need to add a patient restriction on your own NHS smartcard number, another member of staff at your practice will need to do this.',
        ],
    },
    // patient not registered at your practice error
    [UIErrorCode.PATIENT_NOT_REGISTERED_AT_YOUR_PRACTICE]: {
        title: 'The patient is not registered at your practice',
        messageParagraphs: [
            "You cannot perform this action because this patient is not registered at your practice. The patient's current practice can access and manage this record.",
        ],
    },
    // patient access restricted error
    [UIErrorCode.PATIENT_ACCESS_RESTRICTED]: {
        title: 'You cannot access this patient record',
        messageParagraphs: [
            "A member of staff at your practice has restricted your access to this patient's record.",
            'You cannot remove this restriction. If you think this is a mistake, speak to your practice manager.',
        ],
    },
};
