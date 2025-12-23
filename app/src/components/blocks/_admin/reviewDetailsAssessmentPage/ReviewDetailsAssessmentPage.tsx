import { Button, ErrorSummary, Fieldset, Radios, Table } from 'nhsuk-react-components';
import { JSX, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { getPdfObjectUrl } from '../../../../helpers/utils/getPdfObjectUrl';
import { isLocal } from '../../../../helpers/utils/isLocal';
import '../../../../helpers/utils/string-extensions';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import PdfViewer from '../../../generic/pdfViewer/PdfViewer';
import Spinner from '../../../generic/spinner/Spinner';
import ExistingRecordTable from './ExistingRecordTable';

// Mock data for existing and new files
const mockExistingFiles = [
    {
        filename: 'LloydGeorgerecord1.pdf',
        documentUrl: '/dev/testFile.pdf',
    },
];

const mockNewFiles = [
    {
        filename: 'filename_1.pdf',
        dateReceived: '29 May 2025',
        documentUrl: '/dev/testFile.pdf',
    },
    {
        filename: 'filename_2.pdf',
        dateReceived: '29 May 2025',
        documentUrl: '/dev/testFile1.pdf',
    },
    {
        filename: 'filename_3.pdf',
        dateReceived: '29 May 2025',
        documentUrl: '/dev/testFile.pdf',
    },
];

type FileAction = 'add-all' | 'choose-files' | 'duplicate' | 'accept' | 'reject' | '';

export type ReviewDetailsAssessmentPageProps = {
    reviewSnoMed: DOCUMENT_TYPE;
};

const ReviewDetailsAssessmentPage = ({
    reviewSnoMed,
}: ReviewDetailsAssessmentPageProps): JSX.Element => {
    useTitle({ pageTitle: 'Admin - Review Assessment' });
    const { reviewId } = useParams<{ reviewId: string }>();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [existingFiles, setExistingFiles] = useState<typeof mockExistingFiles>([]); // TODO: type to be determined in PRMP-827
    const [newFiles, setNewFiles] = useState<typeof mockNewFiles>([]); // TODO: type to be determined in PRMP-827
    const [selectedFile, setSelectedFile] = useState<string>('');
    const [pdfObjectUrl, setPdfObjectUrl] = useState<string>('');
    const [fileAction, setFileAction] = useState<FileAction>('');
    const [hasExistingRecordInStorage, setHasExistingRecordInStorage] = useState<boolean>(true);
    const [showError, setShowError] = useState(false);
    const errorSummaryRef = useRef<HTMLDivElement>(null);

    const reviewConfig = getConfigForDocType(reviewSnoMed);
    const reviewTypeLabel = reviewConfig.displayName;

    const canBeUpdatedAndDiscarded = reviewConfig.canBeUpdated && reviewConfig.canBeDiscarded; // show existing
    const canBeUpdatedOrDiscarded = reviewConfig.canBeUpdated || reviewConfig.canBeDiscarded; // show new files

    useEffect(() => {
        const timer = setTimeout(() => {
            if (isLocal) {
                // TODO: Replace with actual API call to determine if existing files exist PRMP-827
                // const hasExisting = false;
                const hasExisting = true;
                setHasExistingRecordInStorage(hasExisting); // only do this test if its LG

                if (hasExisting) {
                    setExistingFiles(mockExistingFiles);
                }

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

    const handleFileView = (filename: string, documentUrl: string): void => {
        setSelectedFile(filename);
        getPdfObjectUrl(documentUrl, setPdfObjectUrl, () => {});
    };

    const handleContinue = (): void => {
        setShowError(false);
        if (!fileAction) {
            setShowError(true);
            setTimeout(() => {
                errorSummaryRef.current?.focus();
            }, 0);
            return;
        }
        if (!reviewId) {
            return;
        }
        if (fileAction === 'add-all') {
            if (reviewConfig.canBeUpdated === true && reviewConfig.canBeDiscarded === false) {
                navigateUrlParam(routeChildren.ADMIN_REVIEW_UPLOAD, { reviewId }, navigate);
                return;
            }
            navigateUrlParam(routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE, { reviewId }, navigate);
            return;
        }
        if (fileAction === 'choose-files') {
            navigateUrlParam(routeChildren.ADMIN_REVIEW_CHOOSE_WHICH_FILES, { reviewId }, navigate);
            return;
        }
        if (fileAction === 'duplicate') {
            navigateUrlParam(routeChildren.ADMIN_REVIEW_NO_FILES_CHOICE, { reviewId }, navigate);
            return;
        }
        if (fileAction === 'accept') {
            navigateUrlParam(routeChildren.ADMIN_REVIEW_COMPLETE, { reviewId }, navigate);
            return;
        }
        if (fileAction === 'reject') {
            navigateUrlParam(routeChildren.ADMIN_REVIEW_NO_FILES_CHOICE, { reviewId }, navigate);
            return;
        }
    };

    const backButton = <BackButton backLinkText="Go back" dataTestid="back-button" />;

    if (isLoading) {
        return (
            <>
                {backButton}
                <Spinner status="Loading files..." />
            </>
        );
    }

    let pageTitle: string;
    if (reviewConfig.canBeUpdated === false && reviewConfig.canBeDiscarded) {
        pageTitle = 'Do you want to accept these records?';
    } else if (reviewConfig.canBeUpdated && reviewConfig.canBeDiscarded) {
        const andExisting = existingFiles.length > 0 ? ' and existing ' : ' ';
        pageTitle = `Review the new${andExisting}${reviewTypeLabel.toSentenceCase()}`;
    } else {
        pageTitle = `Review the ${reviewTypeLabel.toSentenceCase()}`;
    }

    const renderRadioButtons = (): JSX.Element => {
        if (reviewConfig.canBeUpdated === false && reviewConfig.canBeDiscarded) {
            return (
                <>
                    <Radios.Radio
                        id="accept"
                        value="accept"
                        onChange={(e): void => {
                            setFileAction(e.currentTarget.value as FileAction);
                        }}
                    >
                        Accept record
                    </Radios.Radio>
                    <Radios.Radio
                        id="reject"
                        value="reject"
                        onChange={(e): void => {
                            setFileAction(e.currentTarget.value as FileAction);
                        }}
                    >
                        Reject record
                    </Radios.Radio>
                </>
            );
        }

        if (
            hasExistingRecordInStorage &&
            reviewConfig.canBeUpdated &&
            reviewConfig.canBeDiscarded
        ) {
            return (
                <>
                    <Radios.Radio
                        id="add-all"
                        value="add-all"
                        onChange={(e): void => {
                            setFileAction(e.currentTarget.value as FileAction);
                        }}
                    >
                        Add all files to the existing {reviewTypeLabel.toSentenceCase()}
                    </Radios.Radio>
                    <Radios.Radio
                        id="choose-files"
                        value="choose-files"
                        onChange={(e): void => {
                            setFileAction(e.currentTarget.value as FileAction);
                        }}
                    >
                        Choose which files to add to the existing {reviewTypeLabel.toSentenceCase()}
                    </Radios.Radio>
                    <Radios.Radio
                        id="duplicate"
                        value="duplicate"
                        onChange={(e): void => {
                            setFileAction(e.currentTarget.value as FileAction);
                        }}
                    >
                        I don't need these files, they are duplicates of the existing{' '}
                        {reviewTypeLabel.toSentenceCase()}
                    </Radios.Radio>
                </>
            );
        }

        return (
            <>
                <Radios.Radio
                    id="add-all"
                    value="add-all"
                    onChange={(e): void => {
                        setFileAction(e.currentTarget.value as FileAction);
                    }}
                >
                    Add all these files
                </Radios.Radio>
                <Radios.Radio
                    id="choose-files"
                    value="choose-files"
                    onChange={(e): void => {
                        setFileAction(e.currentTarget.value as FileAction);
                    }}
                >
                    Choose which files to add
                </Radios.Radio>
            </>
        );
    };

    return (
        <>
            {backButton}

            {showError && (
                <ErrorSummary
                    ref={errorSummaryRef}
                    aria-labelledby="error-summary-title"
                    role="alert"
                    tabIndex={-1}
                >
                    <ErrorSummary.Title id="error-summary-title">
                        There is a problem
                    </ErrorSummary.Title>
                    <ErrorSummary.Body>
                        <ErrorSummary.List>
                            <ErrorSummary.Item href="#file-action">
                                Select what you want to do with these files
                            </ErrorSummary.Item>
                        </ErrorSummary.List>
                    </ErrorSummary.Body>
                </ErrorSummary>
            )}

            <h1>{pageTitle}</h1>

            {canBeUpdatedAndDiscarded && existingFiles.length > 0 && (
                <ExistingRecordTable existingFiles={existingFiles} onFileView={handleFileView} />
            )}

            {canBeUpdatedOrDiscarded && ( // show new files table
                <section className="new-files mb-4">
                    <h2>New files</h2>
                    <Table caption="">
                        <Table.Head>
                            <Table.Row>
                                <Table.Cell className="word-break-keep-all">Filename</Table.Cell>
                                <Table.Cell className="word-break-keep-all">
                                    Date received
                                </Table.Cell>
                                <Table.Cell className="word-break-keep-all">View file</Table.Cell>
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
                                                handleFileView(file.filename, file.documentUrl);
                                            }}
                                        >
                                            View
                                        </button>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                </section>
            )}

            {selectedFile && (
                <section className="file-viewer mb-4">
                    <p>
                        <strong>You are currently viewing: {selectedFile}</strong>
                    </p>
                    <PdfViewer fileUrl={pdfObjectUrl} />
                </section>
            )}

            <section className="file-actions">
                <Fieldset>
                    <Fieldset.Legend isPageHeading>
                        What do you want to do with these files?
                    </Fieldset.Legend>
                    <Radios
                        name="file-action"
                        id="file-action"
                        error={showError ? 'Select an option' : ''}
                    >
                        {renderRadioButtons()}
                    </Radios>
                </Fieldset>

                <Button className="mt-4" onClick={handleContinue}>
                    Continue
                </Button>
            </section>
        </>
    );
};

export default ReviewDetailsAssessmentPage;
