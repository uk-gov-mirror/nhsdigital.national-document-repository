import { Button, ErrorMessage, Table, TextInput } from 'nhsuk-react-components';
import { Dispatch, JSX, SetStateAction, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useTitle from '../../../../helpers/hooks/useTitle';
import getReviews from '../../../../helpers/requests/getReviews';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';
import { formatNhsNumber } from '../../../../helpers/utils/formatNhsNumber';
import { usePatientDetailsContext } from '../../../../providers/patientProvider/PatientProvider';
import {
    ReviewDetails,
    ReviewListItem,
    ReviewListItemDto,
} from '../../../../types/generic/reviews';
import { routes } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import { Pagination } from '../../../generic/paginationV2/Pagination';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';
import SpinnerV2 from '../../../generic/spinnerV2/SpinnerV2';
import { AxiosError } from 'axios';
import { errorToParams } from '../../../../helpers/utils/errorToParams';

export type ReviewsPageProps = {
    setReviewData: Dispatch<SetStateAction<ReviewDetails | null>>;
};

type ReviewTableRowsProps = {
    reviews: ReviewListItem[];
    isLoading: boolean;
    failedLoading: boolean;
    setReviewData: Dispatch<SetStateAction<ReviewDetails | null>>;
};

const ReviewTableRows = ({
    reviews,
    isLoading,
    failedLoading,
    setReviewData,
}: ReviewTableRowsProps): JSX.Element | null => {
    if (failedLoading) {
        return (
            <Table.Row>
                <Table.Cell colSpan={6}>
                    <ErrorMessage>Failed to load reviews</ErrorMessage>
                </Table.Cell>
            </Table.Row>
        );
    }

    if (reviews.length > 0 && !isLoading) {
        return (
            <>
                {reviews.map((review): JSX.Element => {
                    let dateUploaded: Date;
                    if (Number.isNaN(Number(review.dateUploaded))) {
                        dateUploaded = new Date(review.dateUploaded);
                    } else {
                        dateUploaded = new Date(Number(review.dateUploaded));
                    }

                    return (
                        <Table.Row key={review.id}>
                            <Table.Cell>
                                {review.nhsNumber === '0000000000'
                                    ? 'N/A'
                                    : formatNhsNumber(review.nhsNumber)}
                            </Table.Cell>
                            <Table.Cell>{review.recordType}</Table.Cell>
                            <Table.Cell>{review.uploader}</Table.Cell>
                            <Table.Cell>{getFormattedDate(dateUploaded)}</Table.Cell>
                            <Table.Cell className="nowrap">
                                <Link
                                    to={`${review.id}.${review.version}`}
                                    data-testid={`view-record-link-${review.id}`}
                                    onClick={(e): void => {
                                        const newReviewData = new ReviewDetails(
                                            review.id,
                                            review.snomedCode,
                                            `${review.dateUploaded}`,
                                            review.uploader,
                                            `${review.dateUploaded}`,
                                            review.reviewReason,
                                            review.version,
                                            review.nhsNumber,
                                        );
                                        setReviewData(newReviewData);
                                    }}
                                >
                                    View
                                </Link>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
            </>
        );
    }

    return (
        <Table.Row>
            <Table.Cell colSpan={6}>
                {isLoading ? <SpinnerV2 status="Loading..." /> : <>No documents to review</>}
            </Table.Cell>
        </Table.Row>
    );
};

export const ReviewsPage = ({ setReviewData }: ReviewsPageProps): React.JSX.Element => {
    useTitle({ pageTitle: 'Admin - Reviews' });
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const [, setPatientDetails] = usePatientDetailsContext();
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
    const navigate = useNavigate();

    const [pageTokens, setPageTokens] = useState<string[]>(['']);

    const isLastPage = (): boolean => !nextPageToken || count < pageLimit;

    useEffect(() => {
        setNextPageToken('');
    }, [inputValue]);

    const fetchPage = async (
        pageNumber: number,
        startKey: string,
        searchQuery: string = searchValue,
    ): Promise<void> => {
        setIsLoading(true);
        try {
            const response = await getReviews(
                baseUrl,
                baseHeaders,
                searchQuery,
                startKey,
                pageLimit,
            );
            const reviews = reviewDtosToReview(response.documentReviewReferences);
            setFailedLoading(false);
            setReviews(reviews);
            if (response.nextPageToken) {
                setNextPageToken(response.nextPageToken);
            }
            setCount(response.count);
            setCurrentPage(pageNumber);

            const hasNextPage = nextPageToken.includes(response.nextPageToken || '');
            if (!hasNextPage || (response.nextPageToken && !pageTokens[pageNumber])) {
                setPageTokens((prev) => {
                    const newTokens = [...prev];
                    newTokens[pageNumber] = response?.nextPageToken || '';
                    return newTokens;
                });
            }
        } catch (e) {
            const error = e as AxiosError;
            if (error.code === '403') {
                navigate(routes.SESSION_EXPIRED);
                return;
            }

            setFailedLoading(true);
            setCurrentPage(1);
            setPageTokens(['']);
            setReviews([]);
            setCount(0);

            navigate(routes.SERVER_ERROR + errorToParams(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async (): Promise<void> => {
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
            let recordType: string = '';
            try {
                recordType = getConfigForDocType(dto.documentSnomedCodeType).content
                    .reviewList as string;
            } catch {}

            return {
                id: dto.id,
                version: dto.version,
                nhsNumber: dto.nhsNumber,
                recordType: recordType,
                snomedCode: dto.documentSnomedCodeType,
                uploader: dto.author,
                dateUploaded: `${dto.uploadDate}000`, // python provides time in seconds, JS uses ms
                reviewReason: dto.reviewReason,
            };
        });
    };

    useEffect(() => {
        setPatientDetails(null);
        handleSearch();
    }, []);

    return (
        <>
            <BackButton toLocation={routes.ADMIN_ROUTE} backLinkText="Go back" />

            <h1 className="smaller-title" data-testid="search-reviews-title">
                Documents to review
            </h1>

            <h2>Documents that we store automatically</h2>
            <p>Lloyd George scanned paper notes are automatically stored in this service if:</p>
            <ul>
                <li>they transferred successfully at bulk transfer</li>
                <li>
                    a patient moves practice and their Lloyd George record is transferred to your
                    practice
                </li>
            </ul>
            <p>
                You can view these records{' '}
                <a
                    href={routes.SEARCH_PATIENT}
                    onClick={(e): void => {
                        e.preventDefault();
                        navigate(routes.SEARCH_PATIENT);
                    }}
                >
                    searching using the patient's NHS number
                </a>
                .
            </p>

            <h2>Documents that you need to review before they are stored in this service</h2>
            <p>
                The documents listed in the table could not be automatically stored in this service.
            </p>
            <p>These documents could be:</p>
            <ul>
                <li>
                    Lloyd George scanned paper notes that were scanned from the bulk transfer of
                    your files into the service
                </li>
                <li>
                    Lloyd George scanned paper notes that were received from another practice and
                    are not for patients that you serve
                </li>
                <li>Non-Lloyd George files that could be yours</li>
            </ul>
            <p>
                Review each document and decide whether you want to accept and store it in the
                service.
            </p>

            <Table.Panel heading="Documents to review" className="reviews-page" allowFullScreen>
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
                            <Table.Cell>Document type</Table.Cell>
                            <Table.Cell>Sender ODS code</Table.Cell>
                            <Table.Cell>Date uploaded</Table.Cell>
                            <Table.Cell>View</Table.Cell>
                        </Table.Row>
                    </Table.Head>
                    <Table.Body>
                        <ReviewTableRows
                            reviews={reviews}
                            isLoading={isLoading}
                            failedLoading={failedLoading}
                            setReviewData={setReviewData}
                        />
                    </Table.Body>
                </Table>
                <Pagination>
                    {/* previous link */}
                    {currentPage > 1 && (
                        <Pagination.Link
                            href="#"
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
                                href="#"
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
                            href="#"
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
