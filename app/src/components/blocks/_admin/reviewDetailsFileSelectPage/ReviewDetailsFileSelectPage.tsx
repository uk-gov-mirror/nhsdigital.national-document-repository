import { Button, Checkboxes, ErrorSummary, Fieldset, Table } from 'nhsuk-react-components';
import { JSX, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { getPdfObjectUrl } from '../../../../helpers/utils/getPdfObjectUrl';
import { isLocal } from '../../../../helpers/utils/isLocal';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import PdfViewer from '../../../generic/pdfViewer/PdfViewer';
import Spinner from '../../../generic/spinner/Spinner';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';

// Mock data for new files
const mockNewFiles = [
    {
        filename: 'filename_1.pdf',
        dateReceived: '29 May 2025',
        documentUrl: '/dev/testFile.pdf',
    },
    {
        filename: 'filename_2.pdf',
        dateReceived: '29 May 2025',
        documentUrl: '/dev/testFile2.pdf',
    },
    {
        filename: 'filename_3.pdf',
        dateReceived: '29 May 2025',
        documentUrl: '/dev/testFile.pdf',
    },
];

export type ReviewDetailsFileSelectPageProps = {
    reviewSnoMed: DOCUMENT_TYPE;
};

const ReviewDetailsFileSelectPage = ({
    reviewSnoMed,
}: ReviewDetailsFileSelectPageProps): JSX.Element => {
    useTitle({ pageTitle: 'Admin - Review File Selection' });
    const { reviewId } = useParams<{ reviewId: string }>();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [newFiles, setNewFiles] = useState<typeof mockNewFiles>([]);
    const [selectedFile, setSelectedFile] = useState<string>('');
    const [pdfObjectUrl, setPdfObjectUrl] = useState<string>('');
    const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
    const [showError, setShowError] = useState(false);
    const scrollToRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (showError) {
            scrollToRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [showError]);

    useEffect(() => {
        // Simulate API call to fetch files
        const timer = setTimeout(() => {
            if (isLocal) {
                setNewFiles(mockNewFiles);
                // Set first new file as selected by default
                if (mockNewFiles.length > 0) {
                    setSelectedFile(mockNewFiles[0].filename);
                    getPdfObjectUrl(mockNewFiles[0].documentUrl, setPdfObjectUrl, () => {});
                }
            }
            setIsLoading(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [reviewId]);

    const reviewTypeLabel = getConfigForDocType(reviewSnoMed).displayName;

    const handleFileView = (filename: string, documentUrl: string): void => {
        setSelectedFile(filename);
        getPdfObjectUrl(documentUrl, setPdfObjectUrl, () => {});
    };

    const handleFileSelection = (filename: string, isChecked: boolean): void => {
        const updatedSelection = new Set(selectedFiles);
        if (isChecked) {
            updatedSelection.add(filename);
        } else {
            updatedSelection.delete(filename);
        }
        setSelectedFiles(updatedSelection);
        if (updatedSelection.size > 0) {
            setShowError(false);
        }
    };

    const handleContinue = (): void => {
        if (!reviewId) {
            return;
        }
        if (selectedFiles.size === 0) {
            setShowError(true);
            return;
        }
        // TODO: Send selected files to backend PRMP-827
        // Calculate unselected files
        const unselectedFiles = newFiles
            .filter((file) => !selectedFiles.has(file.filename))
            .map((file) => file.filename);
        if (unselectedFiles.length === 0) {
            navigateUrlParam(routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE, { reviewId }, navigate);
            return;
        }
        // Navigate to download choice page with unselected files in state
        const path = routeChildren.ADMIN_REVIEW_DOWNLOAD_CHOICE.replace(':reviewId', reviewId);
        navigate(path, { state: { unselectedFiles } });
    };

    const backButton = <BackButton backLinkText="Go back" dataTestid="back-button" />;

    if ((reviewSnoMed as string) === '') {
        navigate(routeChildren.ADMIN_REVIEW);
        return <></>;
    }

    if (isLoading) {
        return (
            <>
                {backButton}
                <Spinner status="Loading files..." />
            </>
        );
    }

    return (
        <>
            {backButton}

            {showError && (
                <ErrorSummary
                    ref={scrollToRef}
                    aria-labelledby="error-summary-title"
                    role="alert"
                    tabIndex={-1}
                >
                    <ErrorSummary.Title id="error-summary-title">
                        There is a problem
                    </ErrorSummary.Title>
                    <ErrorSummary.Body>
                        <ErrorSummary.List>
                            <ErrorSummary.Item href="#new-files-table">
                                You need to select an option
                            </ErrorSummary.Item>
                        </ErrorSummary.List>
                    </ErrorSummary.Body>
                </ErrorSummary>
            )}

            <h1>Choose files to add to the existing {reviewTypeLabel.toSentenceCase()}</h1>

            <section id="new-files-table" className="new-files mb-4">
                <h2>New files</h2>
                <form>
                    <Fieldset>
                        <Checkboxes error={showError ? 'Select at least one file' : false}>
                            <Table responsive caption="">
                                <Table.Head>
                                    <Table.Row>
                                        <Table.Cell className="word-break-keep-all">
                                            Filename
                                        </Table.Cell>
                                        <Table.Cell className="word-break-keep-all">
                                            Date received
                                        </Table.Cell>
                                        <Table.Cell className="word-break-keep-all">
                                            View file
                                        </Table.Cell>
                                        <Table.Cell className="word-break-keep-all">
                                            Select
                                        </Table.Cell>
                                    </Table.Row>
                                </Table.Head>
                                <Table.Body>
                                    {newFiles.map((file) => (
                                        <Table.Row key={file.filename}>
                                            <Table.Cell>
                                                <strong>{file.filename}</strong>
                                            </Table.Cell>
                                            <Table.Cell>{file.dateReceived}</Table.Cell>
                                            <Table.Cell>
                                                <button
                                                    type="button"
                                                    aria-label={`View ${file.filename}`}
                                                    className="link-button"
                                                    onClick={(): void => {
                                                        handleFileView(
                                                            file.filename,
                                                            file.documentUrl,
                                                        );
                                                    }}
                                                >
                                                    View
                                                </button>
                                            </Table.Cell>
                                            <Table.Cell>
                                                <Checkboxes.Box
                                                    value={file.filename}
                                                    checked={selectedFiles.has(file.filename)}
                                                    onChange={(
                                                        e: React.ChangeEvent<HTMLInputElement>,
                                                    ): void => {
                                                        handleFileSelection(
                                                            file.filename,
                                                            e.target.checked,
                                                        );
                                                    }}
                                                >
                                                    <span className="nhsuk-u-visually-hidden">
                                                        Select {file.filename}
                                                    </span>
                                                </Checkboxes.Box>
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table>
                        </Checkboxes>
                    </Fieldset>
                </form>
            </section>

            {selectedFile && (
                <section className="file-viewer mb-4">
                    <p>
                        <strong>You are currently viewing: {selectedFile}</strong>
                    </p>
                    <PdfViewer fileUrl={pdfObjectUrl} />
                </section>
            )}

            <section className="continue-section">
                <p>If you need to add any more files you can do this next.</p>

                <Button className="mt-4" onClick={handleContinue}>
                    Continue
                </Button>
            </section>
        </>
    );
};

export default ReviewDetailsFileSelectPage;
