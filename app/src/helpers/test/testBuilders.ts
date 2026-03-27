import {
    DOCUMENT_UPLOAD_STATE,
    DOCUMENT_UPLOAD_STATE as documentUploadStates,
    UploadDocument,
} from '../../types/pages/UploadDocumentsPage/types';
import { PatientDetails } from '../../types/generic/patientDetails';
import { SearchResult } from '../../types/generic/searchResult';
import { UserAuth } from '../../types/blocks/userAuth';
import { LloydGeorgeStitchResult } from '../requests/getLloydGeorgeRecord';
import { REPOSITORY_ROLE } from '../../types/generic/authRole';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { GlobalConfig, LocalFlags } from '../../providers/configProvider/ConfigProvider';
import { FeatureFlags } from '../../types/generic/featureFlags';
import { UploadSession } from '../../types/generic/uploadResult';
import {
    AccessAuditType,
    DeceasedAccessAuditReasons,
    PatientAccessAudit,
} from '../../types/generic/accessAudit';
import {
    DOCUMENT_TYPE,
    DOCUMENT_TYPE_CONFIG,
    DOCUMENT_TYPE_CONFIG_GENERIC,
    LGContentKeys,
} from '../utils/documentType';
import { ReviewsResponse } from '../../types/generic/reviews';
import { DocumentReference } from '../../types/pages/documentSearchResultsPage/types';
import { UserPatientRestriction } from '../../types/generic/userPatientRestriction';

const buildUserAuth = (userAuthOverride?: Partial<UserAuth>): UserAuth => {
    const auth: UserAuth = {
        role: REPOSITORY_ROLE.GP_ADMIN,
        authorisation_token:
            'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NzM3NDA1MjUsImlzcyI6Im5ocyByZXBvIiwic21hcnRfY2FyZF9yb2xlIjoiUjgwMTMiLCJzZWxlY3RlZF9vcmdhbmlzYXRpb24iOnsibmFtZSI6IkNBUEVMRklFTEQgU1VSR0VSWSIsIm9yZ19vZHNfY29kZSI6Ikg4MTEwOSIsInJvbGVfY29kZSI6IlJPNzYiLCJpY2Jfb2RzX2NvZGUiOiI5MkEifSwicmVwb3NpdG9yeV9yb2xlIjoiR1BfQURNSU4iLCJuZHJfc2Vzc2lvbl9pZCI6IjZjNmZjNWNlLTU1MzAtNGNmMS04MzcxLTM1M2E5OTZiYWM3NyIsIm5oc191c2VyX2lkIjoiMTIzNDU2Nzg5MDEyIn0.Nb0cIIFSNjL-zIAlYFnkFOWK3Ywh1X4XXfT8lcyWQGdFJ4x2_3K85u21Al-_xbO6xfTxHS29O6ggeaA_0nJ5EU2AE_xnIJnMs4E536avxDetHa3Hdg01ifsItzLgY8ET70I-C-7yn23GtcK8FSAYdz_1NN46m0Rg4ne_u6cI28GvzQRMZtQp2uANXcaOgB9yLMre5JC_su_oIylivmJGAQG3C7Akp-7w27thCRA1-OSMznC9LIQzMG4Ow-3c8QDrQeeqZiej-5yAlhquMe77S89oTCMcElREkChLqBpTgbzh9Ce84kR9RXFmeTNckL0_iRvU9XylMZnNKTho5Oiue0204DOrFMgAyRDxsxxUaUuIoh2XqeksNvjh5yNvimb7VBeDMYx4v77gfjYJIaHzRY-haHHDigR21na3DQeluiCYSRM-jSg1km3vTGmCyVRcZQTjvQ_lQ-XvKCG0VXzSHubKVbtZS_9UdkNM2gD4gnnxDxHPqe8EX917yE0pItFDNZYOq8NzKJrCV7QOa2zE9zo4dqnmacyNsqvdsF4_g46kGUIXi0jQQgcFtv3ttlLcwwAaR0EjsC6Hf56uVu4AfTyqq8PiOfjMrym-ENQV2AaiH4Pr_35SUdJUs5uywCSB5xVsfWZ-yC3W6nVWR9PIAiaSbZ5nlH19qWESc632N3A',
        ...userAuthOverride,
    };
    return auth;
};

const buildPatientDetails = (patientDetailsOverride?: Partial<PatientDetails>): PatientDetails => {
    const patient: PatientDetails = {
        birthDate: '1970-01-01',
        familyName: 'Doe',
        givenName: ['John'],
        nhsNumber: '9000000009',
        postalCode: 'BS3 3NQ',
        superseded: false,
        restricted: false,
        active: true,
        deceased: false,
        canManageRecord: true,
        ...patientDetailsOverride,
    };

    return patient;
};

const buildTextFile = (name: string, size?: number): File => {
    const file = new File(['test'], `${name}.txt`, {
        type: 'text/plain',
    });

    if (size) {
        Object.defineProperty(file, 'size', {
            value: size,
        });
    }

    return file;
};

const buildLgFile = (fileNumber: number): File => {
    const file = new File(['test'], `testFile${fileNumber}.pdf`, {
        type: 'application/pdf',
    });

    return file;
};

const buildDocument = (
    file: File,
    uploadStatus: DOCUMENT_UPLOAD_STATE,
    docType?: DOCUMENT_TYPE,
): UploadDocument => {
    const mockDocument: UploadDocument = {
        file,
        state: uploadStatus ?? documentUploadStates.SUCCEEDED,
        progress: 0,
        id: uuidv4(),
        docType: docType ?? DOCUMENT_TYPE.LLOYD_GEORGE,
        versionId: '1',
    };
    return mockDocument;
};

const buildUploadSession = (documents: Array<UploadDocument>): UploadSession => {
    return documents.reduce(
        (acc, doc) => ({
            ...acc,
            [doc.id]: {
                fields: {
                    key: `bucket/sub_folder/uuid_for_file(${doc.file.name})`,
                    'x-amz-algorithm': 'string',
                    'x-amz-credential': 'string',
                    'x-amz-date': 'string',
                    'x-amz-security-token': 'string',
                    policy: 'string',
                    'x-amz-signature': 'string',
                },
                url: 'https://test.s3.com',
            },
        }),
        {} as UploadSession,
    );
};

const buildSearchResult = (searchResultOverride?: Partial<SearchResult>): SearchResult => {
    const result: SearchResult = {
        author: 'Y12345',
        fileName: 'fileName.pdf',
        created: moment().format(),
        virusScannerResult: 'Clean',
        id: '1234qwer-241ewewr',
        fileSize: 224,
        version: '1',
        documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
        contentType: 'application/pdf',
        ...searchResultOverride,
    };
    return result;
};

const buildLgSearchResult = (): LloydGeorgeStitchResult => {
    const result: LloydGeorgeStitchResult = {
        jobStatus: 'Completed',
        numberOfFiles: 7,
        totalFileSizeInBytes: 7,
        lastUpdated: '2023-10-03T09:11:54.618694Z',
        presignedUrl: 'https://test-url',
    };
    return result;
};

const buildConfig = (
    localFlagsOverride?: Partial<LocalFlags>,
    featureFlagsOverride?: Partial<FeatureFlags>,
): GlobalConfig => {
    const globalConfig: GlobalConfig = {
        mockLocal: {
            recordUploaded: true,
            userRole: REPOSITORY_ROLE.GP_ADMIN,
            ...localFlagsOverride,
        },
        featureFlags: {
            uploadLloydGeorgeWorkflowEnabled: false,
            uploadLambdaEnabled: false,
            uploadArfWorkflowEnabled: false,
            ...featureFlagsOverride,
        },
    };

    return globalConfig;
};

const buildPatientAccessAudit = (): PatientAccessAudit[] => {
    return [
        {
            accessAuditData: {
                Reasons: [DeceasedAccessAuditReasons.familyRequest],
                OtherReasonText: '',
            },
            accessAuditType: AccessAuditType.deceasedPatient,
            nhsNumber: '4857773457',
        },
        {
            accessAuditData: {
                Reasons: [DeceasedAccessAuditReasons.anotherReason],
                OtherReasonText: 'Another reason',
            },
            accessAuditType: AccessAuditType.deceasedPatient,
            nhsNumber: '4857773458',
        },
    ];
};

const buildDocumentConfig = (
    configOverride?: Partial<DOCUMENT_TYPE_CONFIG>,
): DOCUMENT_TYPE_CONFIG | DOCUMENT_TYPE_CONFIG_GENERIC<LGContentKeys> => {
    return {
        snomedCode: DOCUMENT_TYPE.LLOYD_GEORGE,
        displayName: 'Scanned Paper Notes',
        canBeUpdated: true,
        multifileUpload: true,
        multifileZipped: false,
        multifileReview: true,
        canBeDiscarded: true,
        stitched: true,
        singleDocumentOnly: true,
        stitchedFilenamePrefix: '1of1_Lloyd_George_Record',
        acceptedFileTypes: ['PDF'],
        content: {
            getValue: (key: LGContentKeys) => {
                const content: Record<string, string> = {
                    restoreProgressingPageTitle: 'Restoring scanned paper notes',
                };
                return content[key];
            },
            viewDocumentTitle: 'Scanned paper notes',
            addFilesSelectTitle: 'Add scanned paper notes to this record',
            uploadFilesSelectTitle: 'Choose scanned paper notes to upload',
            uploadFilesBulletPoints: [
                'You can only upload PDF files',
                'Check your files open correctly',
                'Remove any passwords from files',
                "If there is a problem with your files during upload, you'll need to resolve these before continuing",
            ],
            chooseFilesMessage: 'Choose PDF files to upload',
            chooseFilesButtonLabel: 'Choose PDF files',
            chooseFilesWarningText: ['paragraph1', 'paragraph2', 'paragraph3'],
            confirmFilesTitle: 'Check your files before uploading',
            beforeYouUploadTitle: 'Before you upload',
            previewUploadTitle: 'Preview this scanned paper notes record',
            uploadFilesExtraParagraph:
                "You can add a note to the patient's electronic health record to say their Lloyd George record is stored in this service. Use SNOMED code 16521000000101.",
        } as any,
        ...configOverride,
    };
};

const buildMockUploadSession = (documents: UploadDocument[]): UploadSession => {
    const session: UploadSession = {};
    documents.forEach((doc) => {
        session[doc.id] = {
            url: 'http://localhost/mock-s3-upload-url',
        } as any;
    });

    return session;
};

const buildMockReviewResponse = (): ReviewsResponse => {
    return {
        documentReviewReferences: [
            {
                id: '1234',
                nhsNumber: '9000000009',
                reviewReason: 'PENDING_REVIEW',
                documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                author: 'some ods',
                version: '1',
                uploadDate: '123456790',
            },
        ],
        nextPageToken: 'abc',
        count: 1,
    };
};

const buildDocumentReference = (override: Partial<DocumentReference> = {}): DocumentReference => {
    return {
        ...buildSearchResult(),
        ...override,
        isPdf: true,
        url: '/dev/testFile.pdf',
    };
};

const buildUserRestrictions = (): UserPatientRestriction[] => {
    return [
        {
            id: 'restriction-123',
            nhsNumber: '9000000009',
            patientGivenName: ['John'],
            patientFamilyName: 'Doe',
            restrictedUser: '123456789013',
            restrictedUserFirstName: 'John',
            restrictedUserLastName: 'Smith',
            created: '2024-01-01T12:00:00Z',
        },
        {
            id: 'restriction-456',
            nhsNumber: '9000000009',
            patientGivenName: ['John'],
            patientFamilyName: 'Doe',
            restrictedUser: '123456789012',
            restrictedUserFirstName: 'Chuck',
            restrictedUserLastName: 'Norris',
            created: '2024-01-01T12:00:00Z',
        },
        {
            id: 'restriction-789',
            nhsNumber: '9000000009',
            patientGivenName: ['John'],
            patientFamilyName: 'Doe',
            restrictedUser: '123456789012',
            restrictedUserFirstName: 'Barry',
            restrictedUserLastName: 'Allen',
            created: '2024-01-01T12:00:00Z',
        },
        {
            id: 'restriction-101',
            nhsNumber: '9000000009',
            patientGivenName: ['John'],
            patientFamilyName: 'Doe',
            restrictedUser: '123456789012',
            restrictedUserFirstName: 'Tom',
            restrictedUserLastName: 'Jones',
            created: '2024-01-01T12:00:00Z',
        },
    ];
};

export {
    buildPatientDetails,
    buildTextFile,
    buildDocument,
    buildSearchResult,
    buildLgSearchResult,
    buildUserAuth,
    buildLgFile,
    buildConfig,
    buildUploadSession,
    buildPatientAccessAudit,
    buildDocumentConfig,
    buildMockUploadSession,
    buildMockReviewResponse,
    buildDocumentReference,
    buildUserRestrictions,
};
