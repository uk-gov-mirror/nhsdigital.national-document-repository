import { Button, ErrorMessage, Table, TextInput } from 'nhsuk-react-components';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useTitle from '../../../../helpers/hooks/useTitle';
import getReviews from '../../../../helpers/requests/getReviews';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import {
    ReviewListItem,
    ReviewListItemDto,
    translateSnowmed,
} from '../../../../types/generic/reviews';
import { routes } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import { Pagination } from '../../../generic/paginationV2/Pagination';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';
import SpinnerV2 from '../../../generic/spinnerV2/SpinnerV2';

export const ReviewsPage = (): React.JSX.Element => {
    useTitle({ pageTitle: 'Admin - Reviews' });
    const baseUrl = useBaseAPIUrl();
    const inputRef = useRef<HTMLInputElement | null>(null);
    const pageLimit = 10;
    const [inputValue, setInputValue] = useState('');
    const [searchValue, setSearchValue] = useState('');
    const [reviews, setReviews] = useState<ReviewListItem[]>([]);
    const [nextPageToken, setNextPageToken] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [failedLoading, setFailedLoading] = useState(false);
    const [count, setCount] = useState(0);

    // Store page tokens: index is page number - 1, value is the startKey for that page
    const [pageTokens, setPageTokens] = useState<string[]>(['']);

    const isLastPage = (): boolean => !nextPageToken || count < pageLimit;

    const fetchPage = async (
        pageNumber: number,
        startKey: string,
        searchQuery: string = searchValue,
    ): Promise<void> => {
        setIsLoading(true);
        try {
            const response = await getReviews(baseUrl, searchQuery, startKey, pageLimit);
            const reviews = reviewDtosToReview(response.documentReviewReferences);
            setFailedLoading(false);
            setReviews(reviews);
            setNextPageToken(response.nextPageToken);
            setCount(response.count);
            setCurrentPage(pageNumber);

            // If we got a nextPageToken and don't have it stored yet, add it to our history
            const hasNextPage = nextPageToken.includes(response.nextPageToken);
            if (!hasNextPage || (response.nextPageToken && !pageTokens[pageNumber])) {
                setPageTokens((prev) => {
                    const newTokens = [...prev];
                    newTokens[pageNumber] = response.nextPageToken;
                    return newTokens;
                });
            }
        } catch {
            setFailedLoading(true);
            setCurrentPage(1);
            setPageTokens(['']);
            setReviews([]);
            setCount(0);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async (): Promise<void> => {
        // Reset pagination when searching
        setIsLoading(true);
        setSearchValue(inputValue);
        setCurrentPage(1);
        setPageTokens(['']);
        await fetchPage(1, '', inputValue);
        setIsLoading(false);
    };

    const goToNextPage = async (): Promise<void> => {
        if (nextPageToken && !isLastPage()) {
            await fetchPage(currentPage + 1, nextPageToken);
        }
    };

    const goToPreviousPage = async (): Promise<void> => {
        if (currentPage > 1) {
            const previousPageToken = pageTokens[currentPage - 2] || '';
            await fetchPage(currentPage - 1, previousPageToken);
        }
    };

    const goToPage = async (pageNumber: number): Promise<void> => {
        if (pageNumber > 0 && pageNumber <= pageTokens.length) {
            const startKey = pageTokens[pageNumber - 1] || '';
            await fetchPage(pageNumber, startKey);
        }
    };

    const reviewDtosToReview = (
        documentReviewReferences: ReviewListItemDto[],
    ): ReviewListItem[] => {
        return documentReviewReferences.map((dto): ReviewListItem => {
            const nhsNumber =
                dto.nhsNumber === '0000000000' ? 'N/A' : formatNhsNumber(dto.nhsNumber);
            return {
                id: dto.id,
                nhsNumber,
                recordType: translateSnowmed(dto.document_snomed_code_type),
                uploader: dto.odsCode,
                dateUploaded: dto.dateUploaded,
                reviewReason: dto.reviewReason,
            };
        });
    };

    useEffect(() => {
        handleSearch();
    }, []);

    return (
        <>
            <BackButton toLocation={routes.ADMIN_ROUTE} backLinkText="Go back" />

            <h1 className="smaller-title">Reviews</h1>
            <Table.Panel heading="Items to review" className="reviews-page" allowFullScreen>
                {/* Search box */}
                <form
                    id="search-form"
                    onSubmit={(e): void => {
                        e.preventDefault();
                        handleSearch();
                    }}
                >
                    <div id="search-container" className="mt-5">
                        <TextInput
                            id="search-input"
                            name="search"
                            label="Search by NHS number"
                            type="text"
                            value={inputValue}
                            onChange={(e): void => setInputValue(e.currentTarget.value)}
                            autoComplete="off"
                            ref={inputRef}
                        />
                        <i />
                    </div>
                    {isLoading ? (
                        <SpinnerButton
                            id="patient-search-spinner"
                            status="Searching..."
                            disabled={true}
                        />
                    ) : (
                        <Button type="submit" disabled={isLoading}>
                            Search
                        </Button>
                    )}
                </form>

                {/* table */}
                <Table responsive>
                    <Table.Head>
                        <Table.Row>
                            <Table.Cell>NHS number</Table.Cell>
                            <Table.Cell>Record type</Table.Cell>
                            <Table.Cell>ODS code</Table.Cell>
                            <Table.Cell>Date uploaded</Table.Cell>
                            <Table.Cell>Review reason</Table.Cell>
                            <Table.Cell>View</Table.Cell>
                        </Table.Row>
                    </Table.Head>
                    <Table.Body>
                        <TableRows
                            reviews={reviews}
                            isLoading={isLoading}
                            failedLoading={failedLoading}
                        />
                    </Table.Body>
                </Table>
                <Pagination>
                    {/* previous link */}
                    {currentPage > 1 && (
                        <Pagination.Link
                            onClick={(e): void => {
                                e.preventDefault();
                                goToPreviousPage();
                            }}
                            previous
                        />
                    )}
                    {/* previous page items */}
                    {pageTokens.map((_, index) => {
                        const pageNumber = index + 1;
                        return (
                            <Pagination.Item
                                key={pageNumber}
                                current={pageNumber === currentPage}
                                onClick={(e): void => {
                                    e.preventDefault();
                                    goToPage(pageNumber);
                                }}
                                number={pageNumber}
                            />
                        );
                    })}
                    {/* next link */}
                    {!isLastPage() && (
                        <Pagination.Link
                            onClick={(e): void => {
                                e.preventDefault();
                                goToNextPage();
                            }}
                            next
                        />
                    )}
                </Pagination>
            </Table.Panel>
        </>
    );
};

type TableRowsProps = {
    reviews: ReviewListItem[];
    isLoading: boolean;
    failedLoading: boolean;
};
const TableRows = ({ reviews, isLoading, failedLoading }: TableRowsProps): React.JSX.Element => {
    if (isLoading) {
        return (
            <Table.Row>
                <Table.Cell colSpan={6}>
                    <SpinnerV2 status="Loading..." />
                </Table.Cell>
            </Table.Row>
        );
    }

    if (reviews.length > 0) {
        return (
            <>
                {reviews.map((review) => (
                    <Table.Row key={review.id}>
                        <Table.Cell>{review.nhsNumber}</Table.Cell>
                        <Table.Cell>{review.recordType}</Table.Cell>
                        <Table.Cell>{review.uploader}</Table.Cell>
                        <Table.Cell>{review.dateUploaded}</Table.Cell>
                        <Table.Cell>{review.reviewReason}</Table.Cell>
                        <Table.Cell className="nowrap">
                            <Link to={review.id} data-testid={`view-record-link-${review.id}`}>
                                View
                            </Link>
                        </Table.Cell>
                    </Table.Row>
                ))}
            </>
        );
    }

    if (failedLoading) {
        return (
            <Table.Row>
                <Table.Cell colSpan={6}>
                    <ErrorMessage>Failed to load reviews</ErrorMessage>
                </Table.Cell>
            </Table.Row>
        );
    }

    return (
        <Table.Row>
            <Table.Cell colSpan={6}>No documents to review</Table.Cell>
        </Table.Row>
    );
};
