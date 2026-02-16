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
import { DOCUMENT_TYPE, DOCUMENT_TYPE_CONFIG } from '../utils/documentType';
import { ReviewsResponse } from '../../types/generic/reviews';

const buildUserAuth = (userAuthOverride?: Partial<UserAuth>): UserAuth => {
    const auth: UserAuth = {
        role: REPOSITORY_ROLE.GP_ADMIN,
        authorisation_token: '111xxx222',
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
        attempts: 0,
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
): DOCUMENT_TYPE_CONFIG => {
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
};
