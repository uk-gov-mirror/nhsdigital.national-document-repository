import ServiceDeskLink from '../../components/generic/serviceDeskLink/ServiceDeskLink';
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
    PATIENT_DECEASED = 'PA003',
}

export type UIErrorContent = {
    title: string;
    messageParagraphs: () => React.JSX.Element;
};

export const UIErrors: Record<UIErrorCode, UIErrorContent> = {
    [UIErrorCode.USER_PATIENT_RESTRICTIONS_SELF_ADD]: {
        title: 'You cannot add a restriction on your own NHS smartcard number',
        messageParagraphs: () => (
            <p key={UIErrorCode.USER_PATIENT_RESTRICTIONS_SELF_ADD}>
                If you need to add a patient restriction on your own NHS smartcard number, another
                member of staff at your practice will need to do this.
            </p>
        ),
    },
    [UIErrorCode.PATIENT_NOT_REGISTERED_AT_YOUR_PRACTICE]: {
        title: 'The patient is not registered at your practice',
        messageParagraphs: () => (
            <p key={UIErrorCode.PATIENT_NOT_REGISTERED_AT_YOUR_PRACTICE}>
                You cannot perform this action because this patient is not registered at your
                practice. The patient's current practice can access and manage this record.
            </p>
        ),
    },
    [UIErrorCode.PATIENT_ACCESS_RESTRICTED]: {
        title: 'You cannot access this patient record',
        messageParagraphs: () => (
            <>
                <p key={UIErrorCode.PATIENT_ACCESS_RESTRICTED + '_1'}>
                    A member of staff at your practice has restricted your access to this patient's
                    record.
                </p>
                <p key={UIErrorCode.PATIENT_ACCESS_RESTRICTED + '_2'}>
                    You cannot remove this restriction. If you think this is a mistake, speak to
                    your practice manager.
                </p>
            </>
        ),
    },
    [UIErrorCode.PATIENT_DECEASED]: {
        title: "This patient's record is marked as deceased",
        messageParagraphs: () => (
            <p key={UIErrorCode.PATIENT_DECEASED}>
                You cannot perform this action for the patient because they are deceased. If you
                believe this is an error, please contact the {ServiceDeskLink()} or call 0300 303
                5045.
            </p>
        ),
    },
};
