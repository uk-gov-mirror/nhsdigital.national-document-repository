import axios from 'axios';
import {
    buildDocument,
    buildLgFile,
    buildUploadSession,
    buildPatientDetails,
} from '../test/testBuilders';
import {
    DOCUMENT_STATUS,
    DOCUMENT_TYPE,
    DOCUMENT_UPLOAD_STATE,
} from '../../types/pages/UploadDocumentsPage/types';
import uploadDocuments, {
    getDocumentStatus,
    uploadDocumentToS3,
    generateFileName,
} from './uploadDocuments';
import { describe, expect, it, Mocked, vi, beforeEach } from 'vitest';
import { DocumentStatusResult } from '../../types/generic/uploadResult';
import { endpoints } from '../../types/generic/endpoints';
import { v4 as uuidv4 } from 'uuid';

vi.mock('axios');

const mockedAxios = axios as Mocked<typeof axios>;

const nhsNumber = '9000000009';
const baseUrl = 'http://localhost/test';
const baseHeaders = { 'Content-Type': 'application/json', test: 'test' };

describe('uploadDocuments', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should use POST request when documentReferenceId is undefined', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const mockUploadSession = buildUploadSession(documents);

        mockedAxios.post.mockResolvedValue({
            status: 200,
            data: mockUploadSession,
        });

        const result = await uploadDocuments({
            nhsNumber,
            documents,
            baseUrl,
            baseHeaders,
            documentReferenceId: undefined,
        });

        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
        expect(mockedAxios.post).toHaveBeenCalledWith(
            baseUrl + endpoints.DOCUMENT_UPLOAD,
            expect.any(String),
            {
                headers: baseHeaders,
                params: {
                    patientId: nhsNumber,
                },
            },
        );
        expect(result).toEqual(mockUploadSession);
    });

    it('should use PUT request when documentReferenceId is provided', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const mockUploadSession = buildUploadSession(documents);
        const documentReferenceId = 'test-ref-id-123';

        mockedAxios.put.mockResolvedValue({
            status: 200,
            data: mockUploadSession,
        });

        const result = await uploadDocuments({
            nhsNumber,
            documents,
            baseUrl,
            baseHeaders,
            documentReferenceId,
        });

        const requestBody = JSON.parse(mockedAxios.put.mock.calls[0][1] as string);

        expect(mockedAxios.put).toHaveBeenCalledTimes(1);
        expect(mockedAxios.put).toHaveBeenCalledWith(
            baseUrl + endpoints.DOCUMENT_UPLOAD + `/${documentReferenceId}`,
            expect.any(String),
            {
                headers: baseHeaders,
                params: {
                    patientId: nhsNumber,
                },
            },
        );

        expect(requestBody).toMatchObject({
            resourceType: 'DocumentReference',
            subject: {
                identifier: {
                    system: 'https://fhir.nhs.uk/Id/nhs-number',
                    value: nhsNumber,
                },
            },
            type: {
                coding: [
                    {
                        system: 'http://snomed.info/sct',
                        code: '22151000087106',
                    },
                ],
            },
            content: [
                {
                    attachment: expect.objectContaining({
                        fileName: documents[0].file.name,
                        contentType: documents[0].file.type,
                        docType: documents[0].docType,
                        clientId: documents[0].id,
                        versionId: documents[0].versionId,
                    }),
                },
            ],
        });

        expect(result).toEqual(mockUploadSession);
    });

    it('should send correct request body structure', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const mockUploadSession = buildUploadSession(documents);

        mockedAxios.post.mockResolvedValue({
            status: 200,
            data: mockUploadSession,
        });

        await uploadDocuments({
            nhsNumber,
            documents,
            baseUrl,
            baseHeaders,
            documentReferenceId: undefined,
        });

        const requestBody = JSON.parse(mockedAxios.post.mock.calls[0][1] as string);

        expect(requestBody).toMatchObject({
            resourceType: 'DocumentReference',
            subject: {
                identifier: {
                    system: 'https://fhir.nhs.uk/Id/nhs-number',
                    value: nhsNumber,
                },
            },
            type: {
                coding: [
                    {
                        system: 'http://snomed.info/sct',
                        code: '22151000087106',
                    },
                ],
            },
            content: [
                {
                    attachment: expect.arrayContaining([
                        expect.objectContaining({
                            fileName: expect.any(String),
                            contentType: expect.any(String),
                            docType: expect.any(String),
                            clientId: expect.any(String),
                        }),
                    ]),
                },
            ],
        });
        expect(requestBody.created).toBeDefined();
    });

    it('should handle multiple documents in request body', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
            buildDocument(
                buildLgFile(2),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const mockUploadSession = buildUploadSession(documents);

        mockedAxios.post.mockResolvedValue({
            status: 200,
            data: mockUploadSession,
        });

        await uploadDocuments({
            nhsNumber,
            documents,
            baseUrl,
            baseHeaders,
            documentReferenceId: undefined,
        });

        const requestBody = JSON.parse(mockedAxios.post.mock.calls[0][1] as string);

        expect(requestBody.content[0].attachment).toHaveLength(2);
        expect(requestBody.content[0].attachment[0]).toMatchObject({
            fileName: documents[0].file.name,
            contentType: documents[0].file.type,
            docType: documents[0].docType,
            clientId: documents[0].id,
        });
        expect(requestBody.content[0].attachment[1]).toMatchObject({
            fileName: documents[1].file.name,
            contentType: documents[1].file.type,
            docType: documents[1].docType,
            clientId: documents[1].id,
        });
    });

    it('should throw error when POST request fails', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const mockError = {
            response: {
                status: 500,
                data: { message: 'Internal server error' },
            },
        };

        mockedAxios.post.mockRejectedValue(mockError);

        await expect(
            uploadDocuments({
                nhsNumber,
                documents,
                baseUrl,
                baseHeaders,
                documentReferenceId: undefined,
            }),
        ).rejects.toEqual(mockError);
    });

    it('should throw error when PUT request fails', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const documentReferenceId = 'test-ref-id-123';
        const mockError = {
            response: {
                status: 404,
                data: { message: 'Document reference not found' },
            },
        };

        mockedAxios.put.mockRejectedValue(mockError);

        await expect(
            uploadDocuments({
                nhsNumber,
                documents,
                baseUrl,
                baseHeaders,
                documentReferenceId,
            }),
        ).rejects.toEqual(mockError);
    });

    it('should handle empty string documentReferenceId as falsy value', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const mockUploadSession = buildUploadSession(documents);

        mockedAxios.post.mockResolvedValue({
            status: 200,
            data: mockUploadSession,
        });

        await uploadDocuments({
            nhsNumber,
            documents,
            baseUrl,
            baseHeaders,
            documentReferenceId: undefined,
        });

        expect(mockedAxios.post).toHaveBeenCalledWith(
            baseUrl + endpoints.DOCUMENT_UPLOAD,
            expect.any(String),
            expect.any(Object),
        );
    });

    it('should include timestamp in created field', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const mockUploadSession = buildUploadSession(documents);
        const beforeTime = new Date().toISOString();

        mockedAxios.post.mockResolvedValue({
            status: 200,
            data: mockUploadSession,
        });

        await uploadDocuments({
            nhsNumber,
            documents,
            baseUrl,
            baseHeaders,
            documentReferenceId: undefined,
        });

        const requestBody = JSON.parse(mockedAxios.post.mock.calls[0][1] as string);
        const afterTime = new Date().toISOString();

        expect(requestBody.created).toBeDefined();
        expect(new Date(requestBody.created).getTime()).toBeGreaterThanOrEqual(
            new Date(beforeTime).getTime(),
        );
        expect(new Date(requestBody.created).getTime()).toBeLessThanOrEqual(
            new Date(afterTime).getTime(),
        );
    });

    it('should handle 401 unauthorized error', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const mockError = {
            response: {
                status: 401,
                data: { message: 'Unauthorized' },
            },
        };

        mockedAxios.post.mockRejectedValue(mockError);

        await expect(
            uploadDocuments({
                nhsNumber,
                documents,
                baseUrl,
                baseHeaders,
                documentReferenceId: undefined,
            }),
        ).rejects.toEqual(mockError);
    });

    it('should handle 403 forbidden error', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const documentReferenceId = 'test-ref-id-123';
        const mockError = {
            response: {
                status: 403,
                data: { message: 'Forbidden' },
            },
        };

        mockedAxios.put.mockRejectedValue(mockError);

        await expect(
            uploadDocuments({
                nhsNumber,
                documents,
                baseUrl,
                baseHeaders,
                documentReferenceId,
            }),
        ).rejects.toEqual(mockError);
    });

    it('should correctly serialize request body as JSON string', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.SELECTED,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const mockUploadSession = buildUploadSession(documents);

        mockedAxios.post.mockResolvedValue({
            status: 200,
            data: mockUploadSession,
        });

        await uploadDocuments({
            nhsNumber,
            documents,
            baseUrl,
            baseHeaders,
            documentReferenceId: undefined,
        });

        const requestBodyString = mockedAxios.post.mock.calls[0][1] as string;
        expect(() => JSON.parse(requestBodyString)).not.toThrow();
        expect(typeof requestBodyString).toBe('string');
    });

    it('should include all document properties in attachment', async () => {
        const testFile = buildLgFile(1);
        const documents = [
            buildDocument(testFile, DOCUMENT_UPLOAD_STATE.SELECTED, DOCUMENT_TYPE.LLOYD_GEORGE),
        ];

        const mockUploadSession = buildUploadSession(documents);

        mockedAxios.post.mockResolvedValue({
            status: 200,
            data: mockUploadSession,
        });

        await uploadDocuments({
            nhsNumber,
            documents,
            baseUrl,
            baseHeaders,
            documentReferenceId: undefined,
        });

        const requestBody = JSON.parse(mockedAxios.post.mock.calls[0][1] as string);
        const attachment = requestBody.content[0].attachment[0];

        expect(attachment).toEqual({
            fileName: documents[0].file.name,
            contentType: documents[0].file.type,
            docType: documents[0].docType,
            clientId: documents[0].id,
            versionId: documents[0].versionId,
        });
    });
});

describe('uploadDocumentToS3', () => {
    const testFile = buildLgFile(1);
    const testDocument = buildDocument(
        testFile,
        DOCUMENT_UPLOAD_STATE.SELECTED,
        DOCUMENT_TYPE.LLOYD_GEORGE,
    );
    const mockUploadSession = buildUploadSession([testDocument]);
    const mockSetDocuments = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('make POST request to s3 bucket', async () => {
        mockedAxios.post.mockResolvedValue({ status: 200 });

        await uploadDocumentToS3({
            setDocuments: mockSetDocuments,
            uploadSession: mockUploadSession,
            document: testDocument,
        });

        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should upload document with correct FormData structure', async () => {
        mockedAxios.post.mockResolvedValue({ status: 200 });

        await uploadDocumentToS3({
            setDocuments: mockSetDocuments,
            uploadSession: mockUploadSession,
            document: testDocument,
        });

        const documentMetadata = mockUploadSession[testDocument.id];
        const [s3Url, formData] = mockedAxios.post.mock.calls[0];

        expect(s3Url).toBe(documentMetadata.url);
        expect(formData).toBeInstanceOf(FormData);
    });

    it('should throw error when S3 upload fails', async () => {
        const mockError = {
            response: {
                status: 403,
                data: { message: 'Access denied' },
            },
        };

        mockedAxios.post.mockRejectedValue(mockError);

        await expect(
            uploadDocumentToS3({
                setDocuments: mockSetDocuments,
                uploadSession: mockUploadSession,
                document: testDocument,
            }),
        ).rejects.toEqual(mockError);
    });

    it('should handle network error during upload', async () => {
        const networkError = new Error('Network error');
        mockedAxios.post.mockRejectedValue(networkError);

        await expect(
            uploadDocumentToS3({
                setDocuments: mockSetDocuments,
                uploadSession: mockUploadSession,
                document: testDocument,
            }),
        ).rejects.toThrow('Network error');
    });

    it('should append all FormData fields from upload session', async () => {
        mockedAxios.post.mockResolvedValue({ status: 200 });

        await uploadDocumentToS3({
            setDocuments: mockSetDocuments,
            uploadSession: mockUploadSession,
            document: testDocument,
        });

        const [, formData] = mockedAxios.post.mock.calls[0];
        expect(formData).toBeInstanceOf(FormData);
    });

    it('should return axios response on successful upload', async () => {
        const mockResponse = { status: 200, data: { success: true } };
        mockedAxios.post.mockResolvedValue(mockResponse);

        const result = await uploadDocumentToS3({
            setDocuments: mockSetDocuments,
            uploadSession: mockUploadSession,
            document: testDocument,
        });

        expect(result).toEqual(mockResponse);
    });

    it('should handle timeout error during upload', async () => {
        const timeoutError = {
            code: 'ECONNABORTED',
            message: 'timeout of 30000ms exceeded',
        };
        mockedAxios.post.mockRejectedValue(timeoutError);

        await expect(
            uploadDocumentToS3({
                setDocuments: mockSetDocuments,
                uploadSession: mockUploadSession,
                document: testDocument,
            }),
        ).rejects.toEqual(timeoutError);
    });
});

describe('generateFileName', () => {
    it('generates correct filename with valid patient details', () => {
        const patientDetails = buildPatientDetails({
            givenName: ['John', 'Michael'],
            familyName: 'Smith',
            nhsNumber: '1234567890',
            birthDate: '1990-05-15',
        });

        const result = generateFileName(patientDetails);

        expect(result).toBe(
            '1of1_Lloyd_George_Record_[John Michael SMITH]_[1234567890]_[15-05-1990].pdf',
        );
    });

    it('generates correct filename with single given name', () => {
        const patientDetails = buildPatientDetails({
            givenName: ['Jane'],
            familyName: 'Doe',
            nhsNumber: '0987654321',
            birthDate: '1985-12-25',
        });

        const result = generateFileName(patientDetails);

        expect(result).toBe('1of1_Lloyd_George_Record_[Jane DOE]_[0987654321]_[25-12-1985].pdf');
    });

    it('handles special characters in given name by replacing them with dashes', () => {
        const patientDetails = buildPatientDetails({
            givenName: ['Mary/Jane', "O'Connor"],
            familyName: 'Smith-Jones',
            nhsNumber: '1111222233',
            birthDate: '1975-03-10',
        });

        const result = generateFileName(patientDetails);

        expect(result).toBe(
            "1of1_Lloyd_George_Record_[Mary-Jane O'Connor SMITH-JONES]_[1111222233]_[10-03-1975].pdf",
        );
    });

    it('handles multiple special characters that need to be replaced', () => {
        const patientDetails = buildPatientDetails({
            givenName: ['Test<Name>'],
            familyName: 'Sample*Family',
            nhsNumber: '5555666677',
            birthDate: '2000-01-01',
        });

        const result = generateFileName(patientDetails);

        expect(result).toBe(
            '1of1_Lloyd_George_Record_[Test-Name- SAMPLE*FAMILY]_[5555666677]_[01-01-2000].pdf',
        );
    });

    it('handles empty given name array', () => {
        const patientDetails = buildPatientDetails({
            givenName: [],
            familyName: 'OnlyFamily',
            nhsNumber: '9999888877',
            birthDate: '1965-07-20',
        });

        const result = generateFileName(patientDetails);

        expect(result).toBe('1of1_Lloyd_George_Record_[ ONLYFAMILY]_[9999888877]_[20-07-1965].pdf');
    });

    it('handles birth date with single digit day and month', () => {
        const patientDetails = buildPatientDetails({
            givenName: ['Alex'],
            familyName: 'Wilson',
            nhsNumber: '1122334455',
            birthDate: '1992-02-05',
        });

        const result = generateFileName(patientDetails);

        expect(result).toBe('1of1_Lloyd_George_Record_[Alex WILSON]_[1122334455]_[05-02-1992].pdf');
    });

    it('throws an error when patient details is null', () => {
        expect(() => generateFileName(null)).toThrow(
            'Patient details are required to generate filename',
        );
    });

    it('handles all special characters that should be replaced', () => {
        const patientDetails = buildPatientDetails({
            givenName: ['Test,Name/With\\Various?Characters%With*More:|"And<Finally>'],
            familyName: 'NormalFamily',
            nhsNumber: '1234567890',
            birthDate: '1980-06-15',
        });

        const result = generateFileName(patientDetails);

        expect(result).toBe(
            '1of1_Lloyd_George_Record_[Test-Name-With-Various-Characters-With-More---And-Finally- NORMALFAMILY]_[1234567890]_[15-06-1980].pdf',
        );
    });

    it('handles very long names correctly', () => {
        const patientDetails = buildPatientDetails({
            givenName: ['Supercalifragilisticexpialidocious', 'AnExtremelyLongMiddleName'],
            familyName: 'AnExtremelyLongFamilyNameThatGoesOnAndOn',
            nhsNumber: '1111111111',
            birthDate: '1995-09-30',
        });

        const result = generateFileName(patientDetails);

        expect(result).toBe(
            '1of1_Lloyd_George_Record_[Supercalifragilisticexpialidocious AnExtremelyLongMiddleName ANEXTREMELYLONGFAMILYNAMETHATGOESONANDON]_[1111111111]_[30-09-1995].pdf',
        );
    });

    it('handles invalid birth date gracefully', () => {
        const patientDetails = buildPatientDetails({
            givenName: ['Test'],
            familyName: 'User',
            nhsNumber: '1234567890',
            birthDate: 'invalid-date',
        });

        const result = generateFileName(patientDetails);

        expect(result).toBe('1of1_Lloyd_George_Record_[Test USER]_[1234567890]_[NaN-NaN-NaN].pdf');
    });

    it('handles whitespace in names correctly', () => {
        const patientDetails = buildPatientDetails({
            givenName: ['  John  ', '  Michael  '],
            familyName: '  Smith  ',
            nhsNumber: '1234567890',
            birthDate: '1990-01-01',
        });

        const result = generateFileName(patientDetails);

        expect(result).toBe(
            '1of1_Lloyd_George_Record_[  John     Michael     SMITH  ]_[1234567890]_[01-01-1990].pdf',
        );
    });
});

describe('getDocumentStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should request document status for all documents provided', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
            buildDocument(
                buildLgFile(2),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const data: DocumentStatusResult = {};
        documents.forEach((doc) => {
            doc.ref = uuidv4();
            data[doc.ref] = {
                status: DOCUMENT_STATUS.FINAL,
            };
        });

        mockedAxios.get.mockResolvedValue({
            statusCode: 200,
            data,
        });

        const result = await getDocumentStatus({
            documents,
            baseUrl,
            baseHeaders,
            nhsNumber,
        });

        expect(mockedAxios.get).toHaveBeenCalledWith(baseUrl + endpoints.DOCUMENT_STATUS, {
            headers: baseHeaders,
            params: {
                patientId: nhsNumber,
                docIds: documents.map((d) => d.ref).join(','),
            },
        });
        expect(result).toBe(data);
    });

    it('should request document status for a single document', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        documents[0].ref = uuidv4();

        const data: DocumentStatusResult = {
            [documents[0].ref]: {
                status: DOCUMENT_STATUS.FINAL,
            },
        };

        mockedAxios.get.mockResolvedValue({
            statusCode: 200,
            data,
        });

        const result = await getDocumentStatus({
            documents,
            baseUrl,
            baseHeaders,
            nhsNumber,
        });

        expect(mockedAxios.get).toHaveBeenCalledTimes(1);
        expect(result).toEqual(data);
    });

    it('should throw error when document status request fails', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        documents[0].ref = uuidv4();

        const mockError = {
            response: {
                status: 500,
                data: { message: 'Internal server error' },
            },
        };

        mockedAxios.get.mockRejectedValue(mockError);

        await expect(
            getDocumentStatus({
                documents,
                baseUrl,
                baseHeaders,
                nhsNumber,
            }),
        ).rejects.toEqual(mockError);
    });

    it('should handle 404 error when document status not found', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        documents[0].ref = uuidv4();

        const mockError = {
            response: {
                status: 404,
                data: { message: 'Document not found' },
            },
        };

        mockedAxios.get.mockRejectedValue(mockError);

        await expect(
            getDocumentStatus({
                documents,
                baseUrl,
                baseHeaders,
                nhsNumber,
            }),
        ).rejects.toEqual(mockError);
    });

    it('should handle network error when fetching document status', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        documents[0].ref = uuidv4();

        const networkError = new Error('Network error');
        mockedAxios.get.mockRejectedValue(networkError);

        await expect(
            getDocumentStatus({
                documents,
                baseUrl,
                baseHeaders,
                nhsNumber,
            }),
        ).rejects.toThrow('Network error');
    });

    it('should correctly format document IDs as comma-separated string', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
            buildDocument(
                buildLgFile(2),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
            buildDocument(
                buildLgFile(3),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        const docId1 = uuidv4();
        const docId2 = uuidv4();
        const docId3 = uuidv4();

        documents[0].ref = docId1;
        documents[1].ref = docId2;
        documents[2].ref = docId3;

        const data: DocumentStatusResult = {
            [docId1]: { status: DOCUMENT_STATUS.FINAL },
            [docId2]: { status: DOCUMENT_STATUS.FINAL },
            [docId3]: { status: DOCUMENT_STATUS.FINAL },
        };

        mockedAxios.get.mockResolvedValue({
            statusCode: 200,
            data,
        });

        await getDocumentStatus({
            documents,
            baseUrl,
            baseHeaders,
            nhsNumber,
        });

        expect(mockedAxios.get).toHaveBeenCalledWith(
            baseUrl + endpoints.DOCUMENT_STATUS,
            expect.objectContaining({
                params: {
                    patientId: nhsNumber,
                    docIds: `${docId1},${docId2},${docId3}`,
                },
            }),
        );
    });

    it('should pass correct headers to axios get request', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        documents[0].ref = uuidv4();

        const customHeaders = {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token123',
            'X-Custom-Header': 'custom-value',
        };

        const data: DocumentStatusResult = {
            [documents[0].ref]: { status: DOCUMENT_STATUS.FINAL },
        };

        mockedAxios.get.mockResolvedValue({
            statusCode: 200,
            data,
        });

        await getDocumentStatus({
            documents,
            baseUrl,
            baseHeaders: customHeaders,
            nhsNumber,
        });

        expect(mockedAxios.get).toHaveBeenCalledWith(
            baseUrl + endpoints.DOCUMENT_STATUS,
            expect.objectContaining({
                headers: customHeaders,
            }),
        );
    });

    it('should handle empty status result', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        documents[0].ref = uuidv4();

        const data: DocumentStatusResult = {};

        mockedAxios.get.mockResolvedValue({
            statusCode: 200,
            data,
        });

        const result = await getDocumentStatus({
            documents,
            baseUrl,
            baseHeaders,
            nhsNumber,
        });

        expect(result).toEqual({});
    });

    it('should handle 503 service unavailable error', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        documents[0].ref = uuidv4();

        const mockError = {
            response: {
                status: 503,
                data: { message: 'Service temporarily unavailable' },
            },
        };

        mockedAxios.get.mockRejectedValue(mockError);

        await expect(
            getDocumentStatus({
                documents,
                baseUrl,
                baseHeaders,
                nhsNumber,
            }),
        ).rejects.toEqual(mockError);
    });

    it('should handle malformed response gracefully', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        documents[0].ref = uuidv4();

        const malformedData = null;

        mockedAxios.get.mockResolvedValue({
            statusCode: 200,
            data: malformedData,
        });

        const result = await getDocumentStatus({
            documents,
            baseUrl,
            baseHeaders,
            nhsNumber,
        });

        expect(result).toBeNull();
    });

    it('should construct correct document status URL', async () => {
        const documents = [
            buildDocument(
                buildLgFile(1),
                DOCUMENT_UPLOAD_STATE.UPLOADING,
                DOCUMENT_TYPE.LLOYD_GEORGE,
            ),
        ];

        documents[0].ref = uuidv4();

        const customBaseUrl = 'https://api.example.com/v1';

        const data: DocumentStatusResult = {
            [documents[0].ref]: { status: DOCUMENT_STATUS.FINAL },
        };

        mockedAxios.get.mockResolvedValue({
            statusCode: 200,
            data,
        });

        await getDocumentStatus({
            documents,
            baseUrl: customBaseUrl,
            baseHeaders,
            nhsNumber,
        });

        expect(mockedAxios.get).toHaveBeenCalledWith(
            customBaseUrl + endpoints.DOCUMENT_STATUS,
            expect.any(Object),
        );
    });
});
