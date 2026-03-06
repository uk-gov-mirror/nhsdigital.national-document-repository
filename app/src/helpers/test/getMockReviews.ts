import {
    ReviewsResponse,
    ReviewListItemDto,
    GetDocumentReviewDto,
    ReviewFileDto,
} from '../../types/generic/reviews';
import { DOCUMENT_TYPE, getConfigForDocType } from '../utils/documentType';
import { isLocal } from '../utils/isLocal';

let getMockResponses: ((params: URLSearchParams) => Promise<ReviewsResponse>) | undefined;
let setupMockRequest:
    | ((params: URLSearchParams, simulateDataAddition?: boolean) => void)
    | undefined;
let getSingleReviewMockResponse:
    | ((reviewId: string, versionNumber: string) => Promise<GetDocumentReviewDto>)
    | undefined;

if (isLocal) {
    let testingCounter = 0;

    setupMockRequest = (params: URLSearchParams, simulateDataAddition = false): void => {
        testingCounter = testingCounter + 1;
        // simulate data being added over time by setting this to true.
        if (simulateDataAddition && testingCounter > 10) {
            params.append('injectData', 'true');
            params.append('testingCounter', (testingCounter - 10).toString());
        }

        if (!getMockResponses) {
            throw new Error('never should happen');
        }
    };

    getMockResponses = async (params: URLSearchParams): Promise<ReviewsResponse> => {
        const limit = parseInt(params.get('limit') || '10');
        const startKey = params.get('startKey') || '';
        const nhsNumber = params.get('nhsNumber') || '';
        const uploader = params.get('uploader') || '';

        if (nhsNumber === 'error') {
            throw new Error('Simulated network error');
        }

        // eslint-disable-next-line no-console
        console.log('Getting mock reviews with params:', params.toString());

        // Filter the reviews based on search filter
        let filteredReviews = getMockReviewsData(params);

        if (uploader || nhsNumber) {
            filteredReviews = filteredReviews.filter((review) => {
                return review.nhsNumber === nhsNumber || review.author === uploader;
            });
        }

        let startIndex = 0;
        if (startKey) {
            const startKeyIndex = filteredReviews.findIndex((review) => review.id === startKey);
            startIndex = startKeyIndex > -1 ? startKeyIndex : 0;
        }

        const endIndex = startIndex + limit;
        const paginatedReviews = filteredReviews.slice(startIndex, endIndex);
        const nextPageToken = endIndex < filteredReviews.length ? filteredReviews[endIndex].id : '';

        return {
            documentReviewReferences: paginatedReviews,
            nextPageToken: nextPageToken,
            count: paginatedReviews.length,
        };
    };

    getSingleReviewMockResponse = async (
        reviewId: string,
        versionNumber: string,
    ): Promise<GetDocumentReviewDto> => {
        const mockReviewsResponse = await getMockResponses!(new URLSearchParams());
        const mockReview = mockReviewsResponse.documentReviewReferences.find(
            (review) => review.id === reviewId && review.version === versionNumber,
        );
        const config = getConfigForDocType(
            mockReview?.documentSnomedCodeType ?? DOCUMENT_TYPE.LLOYD_GEORGE,
        );

        if (
            //prettier-ignore
            ['2','5','6','10','11','14','15','18','19','23','24','27','28','31','33','101','103',
                '106','42','111','55','68','81','94',].includes(reviewId)
        ) {
            return {
                id: reviewId,
                uploadDate: '1765539858673',
                documentSnomedCodeType:
                    mockReview?.documentSnomedCodeType ?? DOCUMENT_TYPE.LLOYD_GEORGE,
                files: ((): ReviewFileDto[] => {
                    const filename = 'document_files_{idx}.pdf';
                    const docs: ReviewFileDto[] = [];
                    const url = `/dev/testFile.pdf`;
                    for (let idx = 1; idx <= 1; idx++) {
                        docs.push({
                            fileName: filename.replace('{idx}', idx.toString()),
                            presignedUrl: url,
                        });
                    }
                    return docs;
                })(),
            };
        } else if (!config.multifileReview) {
            return {
                id: reviewId,
                uploadDate: '1765539858673',
                documentSnomedCodeType:
                    mockReview?.documentSnomedCodeType ?? DOCUMENT_TYPE.LLOYD_GEORGE,
                files: [
                    {
                        fileName: 'document_1.pdf',
                        presignedUrl: '/dev/testFile.pdf',
                    },
                ],
            };
        }

        return {
            id: reviewId,
            uploadDate: '1765539858673',
            documentSnomedCodeType:
                mockReview?.documentSnomedCodeType ?? DOCUMENT_TYPE.LLOYD_GEORGE,
            files: [
                {
                    fileName: 'document_1.pdf',
                    presignedUrl: '/dev/testFile.pdf',
                },
                {
                    fileName: 'document_2.pdf',
                    presignedUrl: '/dev/testFile.pdf',
                },
            ],
        };
    };

    const getMockReviewsData = (params: URLSearchParams): ReviewListItemDto[] => {
        const injectData = params.get('injectData') === 'true';

        const LG = DOCUMENT_TYPE.LLOYD_GEORGE;
        const EHR = DOCUMENT_TYPE.EHR;
        const EHR_ATTACHMENTS = DOCUMENT_TYPE.EHR_ATTACHMENTS;
        const LETTERS = DOCUMENT_TYPE.LETTERS_AND_DOCS;

        let baseData: ReviewListItemDto[] = [
            {
                id: '0',
                nhsNumber: '0000000000',
                documentSnomedCodeType: LG,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '1',
                nhsNumber: '9000000001',
                documentSnomedCodeType: LETTERS,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '2',
                nhsNumber: '9000000002',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
            {
                id: '3',
                nhsNumber: '9000000003',
                documentSnomedCodeType: EHR,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '4',
                nhsNumber: '9000000004',
                documentSnomedCodeType: LG,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '5',
                nhsNumber: '9000000005',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '6',
                nhsNumber: '9000000006',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '7',
                nhsNumber: '9000000007',
                documentSnomedCodeType: EHR,
                author: 'Y22222',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
            {
                id: '8',
                nhsNumber: '9000000008',
                documentSnomedCodeType: LG,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '9',
                nhsNumber: '9000000009',
                documentSnomedCodeType: EHR,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '10',
                nhsNumber: '9000000010',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '11',
                nhsNumber: '9000000011',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y22222',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '12',
                nhsNumber: '9000000012',
                documentSnomedCodeType: LG,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
            {
                id: '13',
                nhsNumber: '9000000013',
                documentSnomedCodeType: EHR,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '14',
                nhsNumber: '9000000014',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '15',
                nhsNumber: '9000000015',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '16',
                nhsNumber: '9000000016',
                documentSnomedCodeType: LG,
                author: 'Y22222',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
            {
                id: '17',
                nhsNumber: '9000000017',
                documentSnomedCodeType: EHR,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '18',
                nhsNumber: '9000000018',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '19',
                nhsNumber: '9000000019',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '20',
                nhsNumber: '9000000020',
                documentSnomedCodeType: LG,
                author: 'Y22222',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
            {
                id: '21',
                nhsNumber: '9000000021',
                documentSnomedCodeType: EHR,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '22',
                nhsNumber: '9000000022',
                documentSnomedCodeType: LG,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '23',
                nhsNumber: '9000000023',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '24',
                nhsNumber: '9000000024',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y22222',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
            {
                id: '25',
                nhsNumber: '9000000025',
                documentSnomedCodeType: EHR,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '26',
                nhsNumber: '9000000026',
                documentSnomedCodeType: LG,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '27',
                nhsNumber: '9000000027',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '28',
                nhsNumber: '9000000028',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y22222',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
            {
                id: '29',
                nhsNumber: '9000000029',
                documentSnomedCodeType: EHR,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '30',
                nhsNumber: '9000000030',
                documentSnomedCodeType: LG,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '31',
                nhsNumber: '9000000031',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '32',
                nhsNumber: '9000000032',
                documentSnomedCodeType: LG,
                author: 'Y22222',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
            {
                id: '33',
                nhsNumber: '9000000033',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '34',
                nhsNumber: '9000000034',
                documentSnomedCodeType: LG,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '35',
                nhsNumber: '9000000035',
                documentSnomedCodeType: EHR,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '101',
                nhsNumber: '9000000101',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '102',
                nhsNumber: '9000000102',
                documentSnomedCodeType: LG,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '103',
                nhsNumber: '9000000103',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '104',
                nhsNumber: '9000000104',
                documentSnomedCodeType: LG,
                author: 'Y22222',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
            {
                id: '105',
                nhsNumber: '9000000105',
                documentSnomedCodeType: EHR,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '106',
                nhsNumber: '9000000106',
                documentSnomedCodeType: EHR_ATTACHMENTS,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '107',
                nhsNumber: '9000000107',
                documentSnomedCodeType: EHR,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '108',
                nhsNumber: '9000000108',
                documentSnomedCodeType: LG,
                author: 'Y22222',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
            {
                id: '109',
                nhsNumber: '9000000109',
                documentSnomedCodeType: EHR,
                author: 'Y12345',
                uploadDate: 1765539858,
                reviewReason: 'Missing metadata',
                version: '1',
            },
            {
                id: '110',
                nhsNumber: '9000000110',
                documentSnomedCodeType: LG,
                author: 'Y67890',
                uploadDate: 1765539858,
                reviewReason: 'Invalid format',
                version: '1',
            },
            {
                id: '111',
                nhsNumber: '9000000111',
                documentSnomedCodeType: EHR,
                author: 'Y11111',
                uploadDate: 1765539858,
                reviewReason: 'Suspicious content',
                version: '1',
            },
            {
                id: '112',
                nhsNumber: '9000000112',
                documentSnomedCodeType: LG,
                author: 'Y22222',
                uploadDate: 1765539858,
                reviewReason: 'Duplicate record',
                version: '1',
            },
        ];

        if (injectData) {
            const counter = +(params.get('testingCounter') || 1);
            const dataTooInject: ReviewListItemDto[] = [
                {
                    id: '36',
                    nhsNumber: '9000000036',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '37',
                    nhsNumber: '9000000037',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '38',
                    nhsNumber: '9000000038',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '39',
                    nhsNumber: '9000000039',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '40',
                    nhsNumber: '9000000040',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '41',
                    nhsNumber: '9000000041',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '42',
                    nhsNumber: '9000000042',
                    documentSnomedCodeType: EHR_ATTACHMENTS,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '43',
                    nhsNumber: '9000000043',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '44',
                    nhsNumber: '9000000044',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '45',
                    nhsNumber: '9000000045',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '46',
                    nhsNumber: '9000000046',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '47',
                    nhsNumber: '9000000047',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '48',
                    nhsNumber: '9000000048',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '49',
                    nhsNumber: '9000000049',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '50',
                    nhsNumber: '9000000050',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '111',
                    nhsNumber: '9000000111',
                    documentSnomedCodeType: EHR_ATTACHMENTS,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '52',
                    nhsNumber: '9000000052',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '53',
                    nhsNumber: '9000000053',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '54',
                    nhsNumber: '9000000054',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '55',
                    nhsNumber: '9000000055',
                    documentSnomedCodeType: EHR_ATTACHMENTS,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '56',
                    nhsNumber: '9000000056',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '57',
                    nhsNumber: '9000000057',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '58',
                    nhsNumber: '9000000058',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '59',
                    nhsNumber: '9000000059',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '60',
                    nhsNumber: '9000000060',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '61',
                    nhsNumber: '9000000061',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '62',
                    nhsNumber: '9000000062',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '63',
                    nhsNumber: '9000000063',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '64',
                    nhsNumber: '9000000064',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '65',
                    nhsNumber: '9000000065',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '66',
                    nhsNumber: '9000000066',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '67',
                    nhsNumber: '9000000067',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '68',
                    nhsNumber: '9000000068',
                    documentSnomedCodeType: EHR_ATTACHMENTS,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '69',
                    nhsNumber: '9000000069',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '70',
                    nhsNumber: '9000000070',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '71',
                    nhsNumber: '9000000071',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '72',
                    nhsNumber: '9000000072',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '73',
                    nhsNumber: '9000000073',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '74',
                    nhsNumber: '9000000074',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '75',
                    nhsNumber: '9000000075',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '76',
                    nhsNumber: '9000000076',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '77',
                    nhsNumber: '9000000077',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '78',
                    nhsNumber: '9000000078',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '79',
                    nhsNumber: '9000000079',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '80',
                    nhsNumber: '9000000080',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '81',
                    nhsNumber: '9000000081',
                    documentSnomedCodeType: EHR_ATTACHMENTS,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '82',
                    nhsNumber: '9000000082',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '83',
                    nhsNumber: '9000000083',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '84',
                    nhsNumber: '9000000084',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '85',
                    nhsNumber: '9000000085',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '86',
                    nhsNumber: '9000000086',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '87',
                    nhsNumber: '9000000087',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '88',
                    nhsNumber: '9000000088',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '89',
                    nhsNumber: '9000000089',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '90',
                    nhsNumber: '9000000090',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '91',
                    nhsNumber: '9000000091',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '92',
                    nhsNumber: '9000000092',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '93',
                    nhsNumber: '9000000093',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '94',
                    nhsNumber: '9000000094',
                    documentSnomedCodeType: EHR_ATTACHMENTS,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '95',
                    nhsNumber: '9000000095',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '96',
                    nhsNumber: '9000000096',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
                {
                    id: '97',
                    nhsNumber: '9000000097',
                    documentSnomedCodeType: EHR,
                    author: 'Y12345',
                    uploadDate: 1765539858,
                    reviewReason: 'Missing metadata',
                    version: '1',
                },
                {
                    id: '98',
                    nhsNumber: '9000000098',
                    documentSnomedCodeType: LG,
                    author: 'Y67890',
                    uploadDate: 1765539858,
                    reviewReason: 'Invalid format',
                    version: '1',
                },
                {
                    id: '99',
                    nhsNumber: '9000000099',
                    documentSnomedCodeType: EHR,
                    author: 'Y11111',
                    uploadDate: 1765539858,
                    reviewReason: 'Suspicious content',
                    version: '1',
                },
                {
                    id: '100',
                    nhsNumber: '9000000100',
                    documentSnomedCodeType: LG,
                    author: 'Y22222',
                    uploadDate: 1765539858,
                    reviewReason: 'Duplicate record',
                    version: '1',
                },
            ];
            const data: ReviewListItemDto[] = dataTooInject.slice(0, counter);
            baseData = baseData.concat(data);
        }

        return baseData.sort((a, b) => (a.uploadDate < b.uploadDate ? -1 : 1));
    };
}

export default getMockResponses;
export { setupMockRequest, getSingleReviewMockResponse };
