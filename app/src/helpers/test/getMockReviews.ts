import { ReviewsResponse, ReviewListItemDto } from '../../types/generic/reviews';
import { DOCUMENT_TYPE } from '../utils/documentType';
import { isLocal } from '../utils/isLocal';

let getMockResponses: ((params: URLSearchParams) => Promise<ReviewsResponse>) | undefined;
let setupMockRequest:
    | ((params: URLSearchParams, simulateDataAddition?: boolean) => void)
    | undefined;

if (isLocal) {
    var testingCounter = 0;

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
        // Simulate network delay
        // await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1000));

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
            // ABSOLUTE EQUALS
            filteredReviews = filteredReviews.filter((review) => {
                return review.nhsNumber === nhsNumber || review.odsCode === uploader;
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

    const getMockReviewsData = (params: URLSearchParams): ReviewListItemDto[] => {
        const injectData = params.get('injectData') === 'true';

        const LG = DOCUMENT_TYPE.LLOYD_GEORGE;
        const EHR = DOCUMENT_TYPE.EHR;
        const EHR_ATTACHMENTS = DOCUMENT_TYPE.EHR_ATTACHMENTS;

        let baseData: ReviewListItemDto[] = [
            {
                id: '0',
                nhsNumber: '0000000000',
                document_snomed_code_type: LG,
                odsCode: 'Y12345',
                dateUploaded: '2024-01-14',
                reviewReason: 'Missing metadata',
            },
            {
                id: '1',
                nhsNumber: '9000000001',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y12345',
                dateUploaded: '2024-01-15',
                reviewReason: 'Missing metadata',
            },
            {
                id: '2',
                nhsNumber: '9000000002',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y12345',
                dateUploaded: '2024-01-16',
                reviewReason: 'Duplicate record',
            },
            {
                id: '3',
                nhsNumber: '9000000003',
                document_snomed_code_type: EHR,
                odsCode: 'Y67890',
                dateUploaded: '2024-01-17',
                reviewReason: 'Invalid format',
            },
            {
                id: '4',
                nhsNumber: '9000000004',
                document_snomed_code_type: LG,
                odsCode: 'Y67890',
                dateUploaded: '2024-01-18',
                reviewReason: 'Missing metadata',
            },
            {
                id: '5',
                nhsNumber: '9000000005',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y11111',
                dateUploaded: '2024-01-19',
                reviewReason: 'Suspicious content',
            },
            {
                id: '6',
                nhsNumber: '9000000006',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y12345',
                dateUploaded: '2024-01-20',
                reviewReason: 'Invalid format',
            },
            {
                id: '7',
                nhsNumber: '9000000007',
                document_snomed_code_type: EHR,
                odsCode: 'Y22222',
                dateUploaded: '2024-01-21',
                reviewReason: 'Duplicate record',
            },
            {
                id: '8',
                nhsNumber: '9000000008',
                document_snomed_code_type: LG,
                odsCode: 'Y67890',
                dateUploaded: '2024-01-22',
                reviewReason: 'Missing metadata',
            },
            {
                id: '9',
                nhsNumber: '9000000009',
                document_snomed_code_type: EHR,
                odsCode: 'Y11111',
                dateUploaded: '2024-01-23',
                reviewReason: 'Suspicious content',
            },
            {
                id: '10',
                nhsNumber: '9000000010',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y12345',
                dateUploaded: '2024-01-24',
                reviewReason: 'Invalid format',
            },
            {
                id: '11',
                nhsNumber: '9000000011',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y22222',
                dateUploaded: '2024-01-25',
                reviewReason: 'Missing metadata',
            },
            {
                id: '12',
                nhsNumber: '9000000012',
                document_snomed_code_type: LG,
                odsCode: 'Y67890',
                dateUploaded: '2024-01-26',
                reviewReason: 'Duplicate record',
            },
            {
                id: '13',
                nhsNumber: '9000000013',
                document_snomed_code_type: EHR,
                odsCode: 'Y12345',
                dateUploaded: '2024-01-27',
                reviewReason: 'Missing metadata',
            },
            {
                id: '14',
                nhsNumber: '9000000014',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y67890',
                dateUploaded: '2024-01-28',
                reviewReason: 'Invalid format',
            },
            {
                id: '15',
                nhsNumber: '9000000015',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y11111',
                dateUploaded: '2024-01-29',
                reviewReason: 'Suspicious content',
            },
            {
                id: '16',
                nhsNumber: '9000000016',
                document_snomed_code_type: LG,
                odsCode: 'Y22222',
                dateUploaded: '2024-01-30',
                reviewReason: 'Duplicate record',
            },
            {
                id: '17',
                nhsNumber: '9000000017',
                document_snomed_code_type: EHR,
                odsCode: 'Y12345',
                dateUploaded: '2024-01-31',
                reviewReason: 'Missing metadata',
            },
            {
                id: '18',
                nhsNumber: '9000000018',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y67890',
                dateUploaded: '2024-02-01',
                reviewReason: 'Invalid format',
            },
            {
                id: '19',
                nhsNumber: '9000000019',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y11111',
                dateUploaded: '2024-02-02',
                reviewReason: 'Suspicious content',
            },
            {
                id: '20',
                nhsNumber: '9000000020',
                document_snomed_code_type: LG,
                odsCode: 'Y22222',
                dateUploaded: '2024-02-03',
                reviewReason: 'Duplicate record',
            },
            {
                id: '21',
                nhsNumber: '9000000021',
                document_snomed_code_type: EHR,
                odsCode: 'Y12345',
                dateUploaded: '2024-02-04',
                reviewReason: 'Missing metadata',
            },
            {
                id: '22',
                nhsNumber: '9000000022',
                document_snomed_code_type: LG,
                odsCode: 'Y67890',
                dateUploaded: '2024-02-05',
                reviewReason: 'Invalid format',
            },
            {
                id: '23',
                nhsNumber: '9000000023',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y11111',
                dateUploaded: '2024-02-06',
                reviewReason: 'Suspicious content',
            },
            {
                id: '24',
                nhsNumber: '9000000024',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y22222',
                dateUploaded: '2024-02-07',
                reviewReason: 'Duplicate record',
            },
            {
                id: '25',
                nhsNumber: '9000000025',
                document_snomed_code_type: EHR,
                odsCode: 'Y12345',
                dateUploaded: '2024-02-08',
                reviewReason: 'Missing metadata',
            },
            {
                id: '26',
                nhsNumber: '9000000026',
                document_snomed_code_type: LG,
                odsCode: 'Y67890',
                dateUploaded: '2024-02-09',
                reviewReason: 'Invalid format',
            },
            {
                id: '27',
                nhsNumber: '9000000027',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y11111',
                dateUploaded: '2024-02-10',
                reviewReason: 'Suspicious content',
            },
            {
                id: '28',
                nhsNumber: '9000000028',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y22222',
                dateUploaded: '2024-02-11',
                reviewReason: 'Duplicate record',
            },
            {
                id: '29',
                nhsNumber: '9000000029',
                document_snomed_code_type: EHR,
                odsCode: 'Y12345',
                dateUploaded: '2024-02-12',
                reviewReason: 'Missing metadata',
            },
            {
                id: '30',
                nhsNumber: '9000000030',
                document_snomed_code_type: LG,
                odsCode: 'Y67890',
                dateUploaded: '2024-02-13',
                reviewReason: 'Invalid format',
            },
            {
                id: '31',
                nhsNumber: '9000000031',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y11111',
                dateUploaded: '2024-02-14',
                reviewReason: 'Suspicious content',
            },
            {
                id: '32',
                nhsNumber: '9000000032',
                document_snomed_code_type: LG,
                odsCode: 'Y22222',
                dateUploaded: '2024-02-15',
                reviewReason: 'Duplicate record',
            },
            {
                id: '33',
                nhsNumber: '9000000033',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y12345',
                dateUploaded: '2024-02-16',
                reviewReason: 'Missing metadata',
            },
            {
                id: '34',
                nhsNumber: '9000000034',
                document_snomed_code_type: LG,
                odsCode: 'Y67890',
                dateUploaded: '2024-02-17',
                reviewReason: 'Invalid format',
            },
            {
                id: '35',
                nhsNumber: '9000000035',
                document_snomed_code_type: EHR,
                odsCode: 'Y11111',
                dateUploaded: '2024-02-18',
                reviewReason: 'Suspicious content',
            },
            {
                id: '101',
                nhsNumber: '9000000101',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y12345',
                dateUploaded: '2024-04-24',
                reviewReason: 'Missing metadata',
            },
            {
                id: '102',
                nhsNumber: '9000000102',
                document_snomed_code_type: LG,
                odsCode: 'Y67890',
                dateUploaded: '2024-04-25',
                reviewReason: 'Invalid format',
            },
            {
                id: '103',
                nhsNumber: '9000000103',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y11111',
                dateUploaded: '2024-04-26',
                reviewReason: 'Suspicious content',
            },
            {
                id: '104',
                nhsNumber: '9000000104',
                document_snomed_code_type: LG,
                odsCode: 'Y22222',
                dateUploaded: '2024-04-27',
                reviewReason: 'Duplicate record',
            },
            {
                id: '105',
                nhsNumber: '9000000105',
                document_snomed_code_type: EHR,
                odsCode: 'Y12345',
                dateUploaded: '2024-04-28',
                reviewReason: 'Missing metadata',
            },
            {
                id: '106',
                nhsNumber: '9000000106',
                document_snomed_code_type: EHR_ATTACHMENTS,
                odsCode: 'Y67890',
                dateUploaded: '2024-04-29',
                reviewReason: 'Invalid format',
            },
            {
                id: '107',
                nhsNumber: '9000000107',
                document_snomed_code_type: EHR,
                odsCode: 'Y11111',
                dateUploaded: '2024-04-30',
                reviewReason: 'Suspicious content',
            },
            {
                id: '108',
                nhsNumber: '9000000108',
                document_snomed_code_type: LG,
                odsCode: 'Y22222',
                dateUploaded: '2024-05-01',
                reviewReason: 'Duplicate record',
            },
            {
                id: '109',
                nhsNumber: '9000000109',
                document_snomed_code_type: EHR,
                odsCode: 'Y12345',
                dateUploaded: '2024-05-02',
                reviewReason: 'Missing metadata',
            },
            {
                id: '110',
                nhsNumber: '9000000110',
                document_snomed_code_type: LG,
                odsCode: 'Y67890',
                dateUploaded: '2024-05-03',
                reviewReason: 'Invalid format',
            },
            {
                id: '111',
                nhsNumber: '9000000111',
                document_snomed_code_type: EHR,
                odsCode: 'Y11111',
                dateUploaded: '2024-05-04',
                reviewReason: 'Suspicious content',
            },
            {
                id: '112',
                nhsNumber: '9000000112',
                document_snomed_code_type: LG,
                odsCode: 'Y22222',
                dateUploaded: '2024-05-05',
                reviewReason: 'Duplicate record',
            },
        ];

        if (injectData) {
            const counter = +(params.get('testingCounter') || 1);
            const dataTooInject = [
                {
                    id: '36',
                    nhsNumber: '9000000036',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-02-19',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '37',
                    nhsNumber: '9000000037',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-02-20',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '38',
                    nhsNumber: '9000000038',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-02-21',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '39',
                    nhsNumber: '9000000039',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-02-22',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '40',
                    nhsNumber: '9000000040',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-02-23',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '41',
                    nhsNumber: '9000000041',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-02-24',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '42',
                    nhsNumber: '9000000042',
                    document_snomed_code_type: EHR_ATTACHMENTS,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-02-25',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '43',
                    nhsNumber: '9000000043',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-02-26',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '44',
                    nhsNumber: '9000000044',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-02-27',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '45',
                    nhsNumber: '9000000045',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-02-28',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '46',
                    nhsNumber: '9000000046',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-02-29',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '47',
                    nhsNumber: '9000000047',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-03-01',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '48',
                    nhsNumber: '9000000048',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-03-02',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '49',
                    nhsNumber: '9000000049',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-03-03',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '50',
                    nhsNumber: '9000000050',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-03-04',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '111',
                    nhsNumber: '9000000111',
                    document_snomed_code_type: EHR_ATTACHMENTS,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-05-04',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '52',
                    nhsNumber: '9000000052',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-03-06',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '53',
                    nhsNumber: '9000000053',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-03-07',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '54',
                    nhsNumber: '9000000054',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-03-08',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '55',
                    nhsNumber: '9000000055',
                    document_snomed_code_type: EHR_ATTACHMENTS,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-03-09',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '56',
                    nhsNumber: '9000000056',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-03-10',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '57',
                    nhsNumber: '9000000057',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-03-11',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '58',
                    nhsNumber: '9000000058',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-03-12',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '59',
                    nhsNumber: '9000000059',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-03-13',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '60',
                    nhsNumber: '9000000060',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-03-14',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '61',
                    nhsNumber: '9000000061',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-03-15',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '62',
                    nhsNumber: '9000000062',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-03-16',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '63',
                    nhsNumber: '9000000063',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-03-17',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '64',
                    nhsNumber: '9000000064',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-03-18',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '65',
                    nhsNumber: '9000000065',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-03-19',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '66',
                    nhsNumber: '9000000066',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-03-20',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '67',
                    nhsNumber: '9000000067',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-03-21',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '68',
                    nhsNumber: '9000000068',
                    document_snomed_code_type: EHR_ATTACHMENTS,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-03-22',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '69',
                    nhsNumber: '9000000069',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-03-23',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '70',
                    nhsNumber: '9000000070',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-03-24',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '71',
                    nhsNumber: '9000000071',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-03-25',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '72',
                    nhsNumber: '9000000072',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-03-26',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '73',
                    nhsNumber: '9000000073',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-03-27',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '74',
                    nhsNumber: '9000000074',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-03-28',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '75',
                    nhsNumber: '9000000075',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-03-29',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '76',
                    nhsNumber: '9000000076',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-03-30',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '77',
                    nhsNumber: '9000000077',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-03-31',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '78',
                    nhsNumber: '9000000078',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-04-01',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '79',
                    nhsNumber: '9000000079',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-04-02',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '80',
                    nhsNumber: '9000000080',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-04-03',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '81',
                    nhsNumber: '9000000081',
                    document_snomed_code_type: EHR_ATTACHMENTS,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-04-04',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '82',
                    nhsNumber: '9000000082',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-04-05',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '83',
                    nhsNumber: '9000000083',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-04-06',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '84',
                    nhsNumber: '9000000084',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-04-07',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '85',
                    nhsNumber: '9000000085',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-04-08',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '86',
                    nhsNumber: '9000000086',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-04-09',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '87',
                    nhsNumber: '9000000087',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-04-10',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '88',
                    nhsNumber: '9000000088',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-04-11',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '89',
                    nhsNumber: '9000000089',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-04-12',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '90',
                    nhsNumber: '9000000090',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-04-13',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '91',
                    nhsNumber: '9000000091',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-04-14',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '92',
                    nhsNumber: '9000000092',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-04-15',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '93',
                    nhsNumber: '9000000093',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-04-16',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '94',
                    nhsNumber: '9000000094',
                    document_snomed_code_type: EHR_ATTACHMENTS,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-04-17',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '95',
                    nhsNumber: '9000000095',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-04-18',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '96',
                    nhsNumber: '9000000096',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-04-19',
                    reviewReason: 'Duplicate record',
                },
                {
                    id: '97',
                    nhsNumber: '9000000097',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y12345',
                    dateUploaded: '2024-04-20',
                    reviewReason: 'Missing metadata',
                },
                {
                    id: '98',
                    nhsNumber: '9000000098',
                    document_snomed_code_type: LG,
                    odsCode: 'Y67890',
                    dateUploaded: '2024-04-21',
                    reviewReason: 'Invalid format',
                },
                {
                    id: '99',
                    nhsNumber: '9000000099',
                    document_snomed_code_type: EHR,
                    odsCode: 'Y11111',
                    dateUploaded: '2024-04-22',
                    reviewReason: 'Suspicious content',
                },
                {
                    id: '100',
                    nhsNumber: '9000000100',
                    document_snomed_code_type: LG,
                    odsCode: 'Y22222',
                    dateUploaded: '2024-04-23',
                    reviewReason: 'Duplicate record',
                },
            ];
            baseData = baseData.concat(dataTooInject.slice(0, counter));
        }
        // return [];

        return baseData.sort((a, b) => (a.dateUploaded < b.dateUploaded ? -1 : 1));
    };
}

export default getMockResponses;
export { setupMockRequest };
