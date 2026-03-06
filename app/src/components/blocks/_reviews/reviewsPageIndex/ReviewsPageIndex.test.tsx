import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import getReviews from '../../../../helpers/requests/getReviews';
import { ReviewsResponse } from '../../../../types/generic/reviews';
import ReviewsPageIndex from './ReviewsPageIndex';
import PatientDetailsProvider from '../../../../providers/patientProvider/PatientProvider';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { routes } from '../../../../types/generic/routes';

const mockedUseNavigate = vi.fn();
const mockSetSnoMed = vi.fn();
const mockSetReviewData = vi.fn();

vi.mock('../../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/requests/getReviews');
vi.mock('../../../../helpers/utils/documentType');
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockedUseNavigate,
        Link: ({ children, to, ...props }: any): React.JSX.Element => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

const mockUseBaseAPIUrl = useBaseAPIUrl as Mock;
const mockUseBaseAPIHeaders = useBaseAPIHeaders as Mock;
const mockGetReviews = getReviews as Mock;
const mockGetConfigForDocType = getConfigForDocType as Mock;

const testUrl = 'https://test-api.com';
const testHeaders = { Authorization: 'Bearer test-token' };

const mockReviewsResponse: ReviewsResponse = {
    documentReviewReferences: [
        {
            id: '1',
            nhsNumber: '9000000001',
            documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
            author: 'Y12345',
            uploadDate: new Date('2024-01-15').valueOf() / 1000,
            reviewReason: 'Missing metadata',
            version: '1',
        },
        {
            id: '2',
            nhsNumber: '9000000002',
            documentSnomedCodeType: '717391000000106' as DOCUMENT_TYPE,
            author: 'Y67890',
            uploadDate: new Date('2024-01-16').valueOf() / 1000,
            reviewReason: 'Duplicate record',
            version: '1',
        },
    ],
    nextPageToken: '3',
    count: 2,
};

const mockElevenReviewsResponse: ReviewsResponse = {
    documentReviewReferences: [
        {
            id: '1',
            nhsNumber: '9000000001',
            documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
            author: 'Y12345',
            uploadDate: new Date('2024-01-15').valueOf() / 1000,
            reviewReason: 'Missing metadata',
            version: '1',
        },
        {
            id: '2',
            nhsNumber: '9000000002',
            documentSnomedCodeType: '717391000000106' as DOCUMENT_TYPE,
            author: 'Y67890',
            uploadDate: new Date('2024-01-16').valueOf() / 1000,
            reviewReason: 'Duplicate record',
            version: '1',
        },
        {
            id: '3',
            nhsNumber: '9000000003',
            documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
            author: 'Y11111',
            uploadDate: new Date('2024-01-17').valueOf() / 1000,
            reviewReason: 'Another reason',
            version: '1',
        },
        {
            id: '4',
            nhsNumber: '9000000004',
            documentSnomedCodeType: '717391000000106' as DOCUMENT_TYPE,
            author: 'Y22222',
            uploadDate: new Date('2024-01-18').valueOf() / 1000,
            reviewReason: 'Another reason',
            version: '1',
        },
        {
            id: '5',
            nhsNumber: '9000000005',
            documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
            author: 'Y33333',
            uploadDate: new Date('2024-01-19').valueOf() / 1000,
            reviewReason: 'Another reason',
            version: '1',
        },
        {
            id: '   6',
            nhsNumber: '9000000006',
            documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
            author: 'Y12345',
            uploadDate: new Date('2024-01-20').valueOf() / 1000,
            reviewReason: 'Invalid format',
            version: '1',
        },
        {
            id: '7',
            nhsNumber: '9000000007',
            documentSnomedCodeType: '717391000000106' as DOCUMENT_TYPE,
            author: 'Y67890',
            uploadDate: new Date('2024-01-21').valueOf() / 1000,
            reviewReason: 'Incorrect data',
            version: '1',
        },
        {
            id: '8',
            nhsNumber: '9000000008',
            documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
            author: 'Y11111',
            uploadDate: new Date('2024-01-22').valueOf() / 1000,
            reviewReason: 'Missing pages',
            version: '1',
        },
        {
            id: '9',
            nhsNumber: '9000000009',
            documentSnomedCodeType: '717391000000106' as DOCUMENT_TYPE,
            author: 'Y22222',
            uploadDate: new Date('2024-01-23').valueOf() / 1000,
            reviewReason: 'Incorrect data',
            version: '1',
        },
        {
            id: '10',
            nhsNumber: '9000000010',
            documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
            author: 'Y33333',
            uploadDate: new Date('2024-01-24').valueOf() / 1000,
            reviewReason: 'Missing metadata',
            version: '1',
        },
        {
            id: '11',
            nhsNumber: '9000000011',
            documentSnomedCodeType: '717391000000106' as DOCUMENT_TYPE,
            author: 'Y44444',
            uploadDate: new Date('2024-01-25').valueOf() / 1000,
            reviewReason: 'Duplicate record',
            version: '1',
        },
    ],
    nextPageToken: '11',
    count: 10,
};

const mockEmptyResponse: ReviewsResponse = {
    documentReviewReferences: [],
    nextPageToken: '',
    count: 0,
};

const renderComponent = (): ReturnType<typeof render> => {
    const router = createMemoryRouter(
        [
            {
                path: '/reviews',
                element: (
                    <PatientDetailsProvider>
                        <ReviewsPageIndex setReviewData={mockSetReviewData} />
                    </PatientDetailsProvider>
                ),
            },
        ],
        {
            initialEntries: ['/reviews'],
        },
    );

    return render(<RouterProvider router={router} />);
};

describe('ReviewsPage', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockUseBaseAPIUrl.mockReturnValue(testUrl);
        mockUseBaseAPIHeaders.mockReturnValue(testHeaders);
        mockGetReviews.mockReset();
        mockGetReviews.mockResolvedValue(mockReviewsResponse);
        mockSetSnoMed.mockClear();
        mockGetConfigForDocType.mockImplementation((snomed: string) => {
            if (snomed === '16521000000101') {
                return {
                    content: {
                        reviewDocumentTitle: 'Scanned paper notes',
                    },
                    displayName: 'scanned paper notes',
                };
            } else if (snomed === '717391000000106') {
                return {
                    content: {
                        reviewDocumentTitle: 'Electronic health record',
                    },
                    displayName: 'electronic health record',
                };
            }
            return {
                content: {
                    reviewDocumentTitle: 'Unknown Type',
                },
                displayName: 'Unknown Type',
            };
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial Render', () => {
        it('renders the page title', () => {
            renderComponent();

            const headings = screen.getAllByText('Documents to review');
            expect(headings.length).toBeGreaterThanOrEqual(1);
        });

        it('renders the search form with NHS number input', () => {
            renderComponent();

            expect(screen.getByLabelText('Search by NHS number')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
        });

        it('renders the table with correct headers', () => {
            renderComponent();

            expect(screen.getByRole('columnheader', { name: 'NHS number' })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'Document type' })).toBeInTheDocument();
            expect(
                screen.getByRole('columnheader', { name: 'Sender ODS code' }),
            ).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'Date uploaded' })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'View' })).toBeInTheDocument();
        });

        it('fetches reviews on initial load', async () => {
            renderComponent();

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, testHeaders, '', '', 10);
            });
        });

        it('displays loading spinner while fetching initial data', () => {
            mockGetReviews.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve(mockReviewsResponse), 100)),
            );

            renderComponent();

            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    describe('Review Data Display', () => {
        it('displays review items when data is loaded', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            expect(screen.getByText('900 000 0002')).toBeInTheDocument();
            expect(screen.getByText('Scanned paper notes')).toBeInTheDocument();
            expect(screen.getByText('Electronic health record')).toBeInTheDocument();
            expect(screen.getByText('Y12345')).toBeInTheDocument();
            expect(screen.getByText('Y67890')).toBeInTheDocument();
        });

        it('displays formatted NHS numbers', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            expect(screen.queryByText('9000000001')).not.toBeInTheDocument();
        });

        it('displays N/A for NHS number 0000000000', async () => {
            const responseWithZeroNhs: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '0000000000',
                        documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: new Date('2024-01-15').valueOf() / 1000,
                        reviewReason: 'Test',
                        version: '1',
                    },
                ],
                nextPageToken: '',
                count: 1,
            };

            mockGetReviews.mockResolvedValue(responseWithZeroNhs);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('N/A')).toBeInTheDocument();
            });
        });

        it('translates SNOMED codes correctly', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Scanned paper notes')).toBeInTheDocument();
            });

            expect(screen.getByText('Electronic health record')).toBeInTheDocument();
        });

        it('displays "Unknown Type" for unrecognized SNOMED codes', async () => {
            const responseWithUnknownCode: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        documentSnomedCodeType: '999999999' as DOCUMENT_TYPE,
                        author: 'Y12345',
                        uploadDate: new Date('2024-01-15').valueOf() / 1000,
                        reviewReason: 'Test',
                        version: '1',
                    },
                ],
                nextPageToken: '',
                count: 1,
            };

            mockGetReviews.mockResolvedValue(responseWithUnknownCode);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Unknown Type')).toBeInTheDocument();
            });
        });

        it('displays "No reviews found" when there are no results', async () => {
            mockGetReviews.mockResolvedValue(mockEmptyResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText(/No documents to review/)).toBeInTheDocument();
            });
        });

        it('renders view links for each review', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByTestId('view-record-link-1')).toBeInTheDocument();
            });

            expect(screen.getByTestId('view-record-link-2')).toBeInTheDocument();
        });
    });

    describe('Search Functionality', () => {
        it('updates input value when typing', async () => {
            renderComponent();

            const searchInput = screen.getByLabelText('Search by NHS number');
            await userEvent.type(searchInput, '9000000003');

            expect(searchInput).toHaveValue('9000000003');
        });

        it('performs search when clicking search button', async () => {
            renderComponent();

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalled();
            });

            vi.clearAllMocks();

            const searchInput = screen.getByLabelText('Search by NHS number');
            await userEvent.type(searchInput, '9000000003');

            const searchButton = screen.getByRole('button', { name: /search/i });
            await userEvent.click(searchButton);

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledWith(
                    testUrl,
                    testHeaders,
                    '9000000003',
                    '',
                    10,
                );
            });
        });

        it('performs search when submitting form', async () => {
            renderComponent();

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalled();
            });

            vi.clearAllMocks();

            const searchInput = screen.getByLabelText('Search by NHS number');
            await userEvent.type(searchInput, '9000000004{enter}');

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledWith(
                    testUrl,
                    testHeaders,
                    '9000000004',
                    '',
                    10,
                );
            });
        });

        it('resets pagination when performing a new search', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            const searchInput = screen.getByLabelText('Search by NHS number');
            await userEvent.type(searchInput, '9000000005');

            const searchButton = screen.getByRole('button', { name: /search/i });
            await userEvent.click(searchButton);

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledWith(
                    testUrl,
                    testHeaders,
                    '9000000005',
                    '',
                    10,
                );
            });
        });

        it('shows spinner button while searching', async () => {
            mockGetReviews.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve(mockReviewsResponse), 100)),
            );

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            const searchInput = screen.getByLabelText('Search by NHS number');
            await userEvent.type(searchInput, '9000000005');

            const searchButton = screen.getByRole('button', { name: /search/i });
            await userEvent.click(searchButton);

            expect(screen.getByText('Searching...')).toBeInTheDocument();
        });
    });

    describe('Pagination', () => {
        it('displays pagination controls when there are results', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            expect(screen.getByLabelText('Page 1')).toBeInTheDocument();
        });

        it('displays next button when there are more pages', async () => {
            mockGetReviews.mockResolvedValue(mockElevenReviewsResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            expect(screen.getByText('Next')).toBeInTheDocument();
        });

        it('does not display next button on last page', async () => {
            const lastPageResponse: ReviewsResponse = {
                ...mockReviewsResponse,
                nextPageToken: '',
                count: 5,
            };

            mockGetReviews.mockResolvedValue(lastPageResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            expect(screen.queryByRole('link', { name: 'Next page' })).not.toBeInTheDocument();
        });

        it('does not display previous button on first page', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            expect(screen.queryByRole('link', { name: 'Previous page' })).not.toBeInTheDocument();
        });

        it('navigates to next page when clicking next button', async () => {
            mockGetReviews.mockResolvedValue(mockElevenReviewsResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            vi.clearAllMocks();

            const nextButton = screen.getByText('Next').closest('a');
            await userEvent.click(nextButton!);

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, testHeaders, '', '11', 10);
            });
        });

        it('displays previous button on page 2', async () => {
            mockGetReviews.mockResolvedValue(mockElevenReviewsResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            const nextButton = screen.getByText('Next').closest('a');
            await userEvent.click(nextButton!);

            await waitFor(() => {
                expect(screen.getByText('Previous')).toBeInTheDocument();
            });
        });

        it('navigates to previous page when clicking previous button', async () => {
            mockGetReviews.mockResolvedValue(mockElevenReviewsResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            const nextButton = screen.getByText('Next').closest('a');
            await userEvent.click(nextButton!);

            await waitFor(() => {
                expect(screen.getByText('Previous')).toBeInTheDocument();
            });

            vi.clearAllMocks();

            const previousButton = screen.getByText('Previous').closest('a');
            await userEvent.click(previousButton!);

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, testHeaders, '', '', 10);
            });
        });

        it('navigates to specific page when clicking page number', async () => {
            mockGetReviews.mockResolvedValue(mockElevenReviewsResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            const nextButton = screen.getByText('Next').closest('a');
            await userEvent.click(nextButton!);

            await waitFor(() => {
                expect(screen.getByLabelText('Page 2')).toBeInTheDocument();
            });

            vi.clearAllMocks();

            const page1Link = screen.getByLabelText('Page 1');
            await userEvent.click(page1Link);

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, testHeaders, '', '', 10);
            });
        });

        it('highlights current page number', async () => {
            mockGetReviews.mockResolvedValue(mockElevenReviewsResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            const page1Link = screen.getByLabelText('Page 1');
            expect(page1Link.closest('li')).toHaveClass('nhsuk-pagination__item--current');
        });
    });

    describe('Error Handling', () => {
        it('navigates to session expired when search returns 403', async () => {
            mockGetReviews.mockRejectedValueOnce({ response: { status: 403 } });
            renderComponent();

            await waitFor(() => {
                expect(mockedUseNavigate).toBeCalledWith(routes.SESSION_EXPIRED);
            });
        });

        it('navigates to unexpected error when search returns non-403 error', async () => {
            mockGetReviews.mockRejectedValueOnce(new Error('Network error'));
            renderComponent();

            await waitFor(() => {
                expect(mockedUseNavigate).toBeCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });
    });

    describe('Table Panel', () => {
        it('renders table panel with heading', () => {
            renderComponent();

            const headings = screen.getAllByText('Documents to review');
            expect(headings.length).toBeGreaterThanOrEqual(1);
        });

        it('renders table with responsive class', () => {
            renderComponent();

            const table = screen.getByRole('table');
            expect(table).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('handles single review item', async () => {
            const singleItemResponse: ReviewsResponse = {
                documentReviewReferences: [mockReviewsResponse.documentReviewReferences[0]],
                nextPageToken: '',
                count: 1,
            };

            mockGetReviews.mockResolvedValue(singleItemResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            expect(screen.queryByText('900 000 0002')).not.toBeInTheDocument();
        });

        it('handles count less than page limit on last page', async () => {
            const partialPageResponse: ReviewsResponse = {
                ...mockReviewsResponse,
                nextPageToken: '',
                count: 5,
            };

            mockGetReviews.mockResolvedValue(partialPageResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            expect(screen.queryByRole('link', { name: 'Next page' })).not.toBeInTheDocument();
        });

        it('handles whitespace in search input', async () => {
            renderComponent();

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalled();
            });

            vi.clearAllMocks();

            const searchInput = screen.getByLabelText('Search by NHS number');
            await userEvent.type(searchInput, '  900 000 0003  ');

            const searchButton = screen.getByRole('button', { name: /search/i });
            await userEvent.click(searchButton);

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledWith(
                    testUrl,
                    testHeaders,
                    '  900 000 0003  ',
                    '',
                    10,
                );
            });
        });
    });

    describe('Report Download Link', () => {
        it('renders download report link with correct href', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            const downloadLink = screen.getByText('Download a report on this data');
            expect(downloadLink).toBeInTheDocument();
            expect(downloadLink).toHaveAttribute('href', '/create-report?reportType=REVIEW');
        });
    });
});
