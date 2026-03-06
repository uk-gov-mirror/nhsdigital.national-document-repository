import { Button, Checkboxes, ErrorSummary, Fieldset, Table } from 'nhsuk-react-components';
import { JSX, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { navigateUrlParam, routeChildren } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import PdfViewer from '../../../generic/pdfViewer/PdfViewer';
import Spinner from '../../../generic/spinner/Spinner';
import {
    DOCUMENT_UPLOAD_STATE,
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../../../types/pages/UploadDocumentsPage/types';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import useReviewId from '../../../../helpers/hooks/useReviewId';

export type ReviewDetailsFileSelectStageProps = {
    reviewData: ReviewDetails | null;
    uploadDocuments: ReviewUploadDocument[];
    setUploadDocuments: React.Dispatch<React.SetStateAction<ReviewUploadDocument[]>>;
};

const ReviewDetailsFileSelectStage = ({
    reviewData,
    uploadDocuments,
    setUploadDocuments,
}: ReviewDetailsFileSelectStageProps): JSX.Element => {
    useTitle({ pageTitle: 'Admin - Review File Selection' });
    const reviewId = useReviewId();
    const navigate = useNavigate();

    const [selectedFile, setSelectedFile] = useState<string>('');
    const [pdfObjectUrl, setPdfObjectUrl] = useState<string>('');
    const [showError, setShowError] = useState(false);
    const scrollToRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (showError) {
            scrollToRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [showError]);

    if (!reviewData) {
        return <Spinner status={'Loading'} />;
    }

    const reviewTypeLabel = getConfigForDocType(reviewData.snomedCode).displayName;

    const handleFileView = (filename: string): void => {
        setSelectedFile(filename);
        const selectedDocument = uploadDocuments.find(
            (doc) => doc.type === UploadDocumentType.REVIEW && doc.file.name === filename,
        );
        if (!selectedDocument?.file) {
            return;
        }
        const url = URL.createObjectURL(selectedDocument?.file);
        setPdfObjectUrl(url);
    };

    const handleFileSelection = (filename: string, isChecked: boolean): void => {
        if (showError) {
            setShowError(false);
        }
        const selectedDocument = uploadDocuments.find((doc) => doc.file.name === filename);
        if (!selectedDocument) {
            return;
        }
        if (isChecked) {
            setUploadDocuments((prevDocuments) => {
                return prevDocuments.map((doc) =>
                    doc.type === UploadDocumentType.REVIEW && doc.file.name === filename
                        ? { ...doc, state: DOCUMENT_UPLOAD_STATE.SELECTED }
                        : doc,
                );
            });
        } else {
            setUploadDocuments((prevDocuments) => {
                return prevDocuments.map((doc) =>
                    doc.type === UploadDocumentType.REVIEW && doc.file.name === filename
                        ? { ...doc, state: DOCUMENT_UPLOAD_STATE.UNSELECTED }
                        : doc,
                );
            });
        }
    };

    const handleContinue = (): void => {
        if (!reviewId) {
            return;
        }

        const selectedFiles = uploadDocuments.filter(
            (doc) =>
                doc.type === UploadDocumentType.REVIEW &&
                doc.state === DOCUMENT_UPLOAD_STATE.SELECTED,
        );

        if (selectedFiles.length === 0) {
            setShowError(true);
            return;
        }

        const unselectedFiles = uploadDocuments.filter(
            (doc) =>
                doc.type === UploadDocumentType.REVIEW &&
                doc.state === DOCUMENT_UPLOAD_STATE.UNSELECTED,
        );

        if (unselectedFiles.length === 0) {
            navigateUrlParam(routeChildren.REVIEW_ADD_MORE_CHOICE, { reviewId }, navigate);
            return;
        }

        const path = routeChildren.REVIEW_DOWNLOAD_CHOICE.replace(':reviewId', reviewId);
        navigate(path);
    };

    const backButton = <BackButton backLinkText="Go back" dataTestid="back-button" />;

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

            <div className="nhsuk-inset-text">
                <PatientSummary>
                    <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                    <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                    <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                </PatientSummary>
            </div>

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
                                    <RenderFileRows
                                        uploadDocuments={uploadDocuments}
                                        reviewFiles={reviewData.files}
                                        onViewFile={handleFileView}
                                        onSelectFile={handleFileSelection}
                                    />
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

type RenderFileRowsProps = {
    uploadDocuments: ReviewUploadDocument[];
    reviewFiles: ReviewDetails['files'];
    onViewFile: (filename: string) => void;
    onSelectFile: (filename: string, isChecked: boolean) => void;
};

const RenderFileRows = ({
    uploadDocuments,
    reviewFiles,
    onViewFile,
    onSelectFile,
}: RenderFileRowsProps): JSX.Element => {
    return (
        <>
            {uploadDocuments
                .filter((f) => f.type === UploadDocumentType.REVIEW)
                .map((doc) => {
                    const reviewFile = reviewFiles?.find((f) => f.fileName === doc.file.name);
                    return (
                        <Table.Row key={doc.file.name}>
                            <Table.Cell>
                                <strong>{doc.file.name}</strong>
                            </Table.Cell>
                            <Table.Cell>
                                {getFormattedDateFromString(reviewFile?.uploadDate)}
                            </Table.Cell>
                            <Table.Cell>
                                <button
                                    type="button"
                                    aria-label={`View ${doc.file.name}`}
                                    className="link-button"
                                    onClick={(): void => {
                                        onViewFile(doc.file.name);
                                    }}
                                >
                                    View
                                </button>
                            </Table.Cell>
                            <Table.Cell>
                                <Checkboxes.Box
                                    value={doc.file.name}
                                    checked={doc.state === DOCUMENT_UPLOAD_STATE.SELECTED}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
                                        onSelectFile(doc.file.name, e.target.checked);
                                    }}
                                >
                                    <span className="nhsuk-u-visually-hidden">
                                        Select {doc.file.name}
                                    </span>
                                </Checkboxes.Box>
                            </Table.Cell>
                        </Table.Row>
                    );
                })}
        </>
    );
};

export default ReviewDetailsFileSelectStage;
