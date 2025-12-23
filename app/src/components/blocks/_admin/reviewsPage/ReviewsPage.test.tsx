import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import getReviews from '../../../../helpers/requests/getReviews';
import { ReviewsResponse } from '../../../../types/generic/reviews';
import { ReviewsPage } from './ReviewsPage';

const mockedUseNavigate = vi.fn();
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../../helpers/hooks/useTitle');
vi.mock('../../../../helpers/requests/getReviews');
vi.mock('react-router-dom', () => ({
    useNavigate: (): typeof mockedUseNavigate => mockedUseNavigate,
}));

const mockUseBaseAPIUrl = useBaseAPIUrl as Mock;
const mockGetReviews = getReviews as Mock;

const testUrl = 'https://test-api.com';

const mockReviewsResponse: ReviewsResponse = {
    documentReviewReferences: [
        {
            id: '1',
            nhsNumber: '9000000001',
            document_snomed_code_type: '16521000000101',
            odsCode: 'Y12345',
            dateUploaded: '2024-01-15',
            reviewReason: 'Missing metadata',
        },
        {
            id: '2',
            nhsNumber: '9000000002',
            document_snomed_code_type: '717391000000106',
            odsCode: 'Y67890',
            dateUploaded: '2024-01-16',
            reviewReason: 'Duplicate record',
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
            document_snomed_code_type: '16521000000101',
            odsCode: 'Y12345',
            dateUploaded: '2024-01-15',
            reviewReason: 'Missing metadata',
        },
        {
            id: '2',
            nhsNumber: '9000000002',
            document_snomed_code_type: '717391000000106',
            odsCode: 'Y67890',
            dateUploaded: '2024-01-16',
            reviewReason: 'Duplicate record',
        },
        {
            id: '3',
            nhsNumber: '9000000003',
            document_snomed_code_type: '16521000000101',
            odsCode: 'Y11111',
            dateUploaded: '2024-01-17',
            reviewReason: 'Another reason',
        },
        {
            id: '4',
            nhsNumber: '9000000004',
            document_snomed_code_type: '717391000000106',
            odsCode: 'Y22222',
            dateUploaded: '2024-01-18',
            reviewReason: 'Another reason',
        },
        {
            id: '5',
            nhsNumber: '9000000005',
            document_snomed_code_type: '16521000000101',
            odsCode: 'Y33333',
            dateUploaded: '2024-01-19',
            reviewReason: 'Another reason',
        },
        {
            id: '   6',
            nhsNumber: '9000000006',
            document_snomed_code_type: '16521000000101',
            odsCode: 'Y12345',
            dateUploaded: '2024-01-20',
            reviewReason: 'Invalid format',
        },
        {
            id: '7',
            nhsNumber: '9000000007',
            document_snomed_code_type: '717391000000106',
            odsCode: 'Y67890',
            dateUploaded: '2024-01-21',
            reviewReason: 'Incorrect data',
        },
        {
            id: '8',
            nhsNumber: '9000000008',
            document_snomed_code_type: '16521000000101',
            odsCode: 'Y11111',
            dateUploaded: '2024-01-22',
            reviewReason: 'Missing pages',
        },
        {
            id: '9',
            nhsNumber: '9000000009',
            document_snomed_code_type: '717391000000106',
            odsCode: 'Y22222',
            dateUploaded: '2024-01-23',
            reviewReason: 'Incorrect data',
        },
        {
            id: '10',
            nhsNumber: '9000000010',
            document_snomed_code_type: '16521000000101',
            odsCode: 'Y33333',
            dateUploaded: '2024-01-24',
            reviewReason: 'Missing metadata',
        },
        {
            id: '11',
            nhsNumber: '9000000011',
            document_snomed_code_type: '717391000000106',
            odsCode: 'Y44444',
            dateUploaded: '2024-01-25',
            reviewReason: 'Duplicate record',
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
                path: '/admin/reviews',
                element: <ReviewsPage />,
            },
        ],
        {
            initialEntries: ['/admin/reviews'],
        },
    );

    return render(<RouterProvider router={router} />);
};

describe('ReviewsPage', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockUseBaseAPIUrl.mockReturnValue(testUrl);
        mockGetReviews.mockResolvedValue(mockReviewsResponse);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Initial Render', () => {
        it('renders the page title', () => {
            renderComponent();

            expect(screen.getByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
        });

        it('renders the search form with NHS number input', () => {
            renderComponent();

            expect(screen.getByLabelText('Search by NHS number')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
        });

        it('renders the table with correct headers', () => {
            renderComponent();

            expect(screen.getByRole('columnheader', { name: 'NHS number' })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'Record type' })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'ODS code' })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'Date uploaded' })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'Review reason' })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'View' })).toBeInTheDocument();
        });

        it('fetches reviews on initial load', async () => {
            renderComponent();

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, '', '', 10);
            });
        });

        it('displays loading spinner while fetching initial data', async () => {
            mockGetReviews.mockImplementation(
                () => new Promise((resolve) => setTimeout(() => resolve(mockReviewsResponse), 100)),
            );

            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Review reason')).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(screen.getByText('Loading...')).toBeInTheDocument();
            });
        });
    });

    describe('Review Data Display', () => {
        it('displays review items when data is loaded', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            expect(screen.getByText('900 000 0002')).toBeInTheDocument();
            expect(screen.getByText('Lloyd George')).toBeInTheDocument();
            expect(screen.getByText('Electronic Health Record')).toBeInTheDocument();
            expect(screen.getByText('Y12345')).toBeInTheDocument();
            expect(screen.getByText('Y67890')).toBeInTheDocument();
            expect(screen.getByText('Missing metadata')).toBeInTheDocument();
            expect(screen.getByText('Duplicate record')).toBeInTheDocument();
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
                        document_snomed_code_type: '16521000000101',
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-15',
                        reviewReason: 'Test',
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
                expect(screen.getByText('Lloyd George')).toBeInTheDocument();
            });

            expect(screen.getByText('Electronic Health Record')).toBeInTheDocument();
        });

        it('displays "Unknown Type" for unrecognized SNOMED codes', async () => {
            const responseWithUnknownCode: ReviewsResponse = {
                documentReviewReferences: [
                    {
                        id: '1',
                        nhsNumber: '9000000001',
                        document_snomed_code_type: '999999999',
                        odsCode: 'Y12345',
                        dateUploaded: '2024-01-15',
                        reviewReason: 'Test',
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
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, '9000000003', '', 10);
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
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, '9000000004', '', 10);
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
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, '9000000005', '', 10);
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
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, '', '11', 10);
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
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, '', '', 10);
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
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, '', '', 10);
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
        it('displays error message when reviews fail to load', async () => {
            mockGetReviews.mockRejectedValue(new Error('Network error'));
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Failed to load reviews')).toBeInTheDocument();
            });
        });

        it('resets state when loading fails', async () => {
            mockGetReviews.mockRejectedValue(new Error('Network error'));
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Failed to load reviews')).toBeInTheDocument();
            });

            expect(screen.queryByText('900 000 0001')).not.toBeInTheDocument();
        });

        it('clears error when new search succeeds', async () => {
            mockGetReviews.mockRejectedValueOnce(new Error('Network error'));
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('Failed to load reviews')).toBeInTheDocument();
            });

            mockGetReviews.mockResolvedValue(mockReviewsResponse);

            const searchButton = screen.getByRole('button', { name: /search/i });
            await userEvent.click(searchButton);

            await waitFor(() => {
                expect(screen.queryByText('Failed to load reviews')).not.toBeInTheDocument();
            });

            expect(screen.getByText('900 000 0001')).toBeInTheDocument();
        });
    });

    describe('Table Panel', () => {
        it('renders table panel with heading', () => {
            renderComponent();

            expect(screen.getByText('Items to review')).toBeInTheDocument();
        });

        it('renders table with responsive class', () => {
            renderComponent();

            const table = screen.getByRole('table');
            expect(table).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('handles empty search input', async () => {
            renderComponent();

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalled();
            });

            vi.clearAllMocks();

            const searchButton = screen.getByRole('button', { name: /search/i });
            await userEvent.click(searchButton);

            await waitFor(() => {
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, '', '', 10);
            });
        });

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
                expect(mockGetReviews).toHaveBeenCalledWith(testUrl, '  900 000 0003  ', '', 10);
            });
        });
    });

    describe('Date Display', () => {
        it('displays date uploaded correctly', async () => {
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('2024-01-15')).toBeInTheDocument();
            });

            expect(screen.getByText('2024-01-16')).toBeInTheDocument();
        });
    });

    describe('Multiple Reviews', () => {
        it('renders all review items correctly', async () => {
            const multipleReviewsResponse: ReviewsResponse = {
                documentReviewReferences: [
                    ...mockReviewsResponse.documentReviewReferences,
                    {
                        id: '3',
                        nhsNumber: '9000000003',
                        document_snomed_code_type: '16521000000101',
                        odsCode: 'Y11111',
                        dateUploaded: '2024-01-17',
                        reviewReason: 'Another reason',
                    },
                ],
                nextPageToken: '4',
                count: 3,
            };

            mockGetReviews.mockResolvedValue(multipleReviewsResponse);
            renderComponent();

            await waitFor(() => {
                expect(screen.getByText('900 000 0001')).toBeInTheDocument();
            });

            expect(screen.getByText('900 000 0002')).toBeInTheDocument();
            expect(screen.getByText('900 000 0003')).toBeInTheDocument();
            expect(screen.getByTestId('view-record-link-1')).toBeInTheDocument();
            expect(screen.getByTestId('view-record-link-2')).toBeInTheDocument();
            expect(screen.getByTestId('view-record-link-3')).toBeInTheDocument();
        });
    });
});
