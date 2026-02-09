import { Button, ErrorSummary, Fieldset, Radios, Table } from 'nhsuk-react-components';
import { Dispatch, JSX, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import { getPdfObjectUrl } from '../../../../helpers/utils/getPdfObjectUrl';
import { isLocal } from '../../../../helpers/utils/isLocal';
import '../../../../helpers/utils/string-extensions';
import { navigateUrlParam, routeChildren, routes } from '../../../../types/generic/routes';
import BackButton from '../../../generic/backButton/BackButton';
import Spinner from '../../../generic/spinner/Spinner';
import ExistingRecordTable from './ExistingRecordTable';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import { getFormattedDateFromString } from '../../../../helpers/utils/formatDate';
import {
    GetDocumentReviewDto,
    ReviewDetails,
    ReviewsListFiles,
} from '../../../../types/generic/reviews';
import { getReviewById } from '../../../../helpers/requests/getReviews';
import { DOWNLOAD_STAGE } from '../../../../types/generic/downloadStage';
import {
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../../../types/pages/UploadDocumentsPage/types';
import DocumentUploadLloydGeorgePreview from '../../_documentUpload/documentUploadLloydGeorgePreview/DocumentUploadLloydGeorgePreview';
import { AxiosError } from 'axios';
import { errorToParams } from '../../../../helpers/utils/errorToParams';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';

type FileAction = 'add-all' | 'choose-files' | 'duplicate' | 'accept' | 'reject' | '';

export type ReviewDetailsAssessmentStageProps = {
    reviewData: ReviewDetails | null;
    setReviewData: Dispatch<React.SetStateAction<ReviewDetails | null>>;
    uploadDocuments: ReviewUploadDocument[];
    setDownloadStage: Dispatch<React.SetStateAction<DOWNLOAD_STAGE>>;
    downloadStage: DOWNLOAD_STAGE;
    hasExistingRecordInStorage: boolean;
};

export type SelectedFile = { fileName: string; reviewType: UploadDocumentType };

const ReviewDetailsAssessmentStage = ({
    reviewData,
    setReviewData,
    uploadDocuments,
    downloadStage,
    setDownloadStage,
    hasExistingRecordInStorage,
}: ReviewDetailsAssessmentStageProps): JSX.Element => {
    useTitle({ pageTitle: 'Admin - Review Assessment' });
    const { reviewId } = useParams<{ reviewId: string }>();
    const navigate = useNavigate();

    const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
    const [fileAction, setFileAction] = useState<FileAction>('');
    const [showError, setShowError] = useState(false);
    const errorSummaryRef = useRef<HTMLDivElement>(null);

    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();

    const handleExistingFileView = async (filename: string, id: string): Promise<void> => {
        if (!reviewData) {
            return;
        }
        if (isLocal) {
            const file = reviewData.existingFiles?.find((f) => f.fileName === filename);
            if (!file) {
                return;
            }
            getPdfObjectUrl(file.url || '', (): void => {}, setDownloadStage);
            setSelectedFile({ fileName: filename, reviewType: UploadDocumentType.EXISTING });
            return;
        }

        const existing = uploadDocuments.find((doc) => doc.type === UploadDocumentType.EXISTING);
        if (!existing) {
            return;
        }
        setSelectedFile({ fileName: filename, reviewType: UploadDocumentType.EXISTING });
    };

    const handleNewFileView = async (file: ReviewsListFiles): Promise<void> => {
        setDownloadStage(DOWNLOAD_STAGE.PENDING);
        if (!reviewData || !reviewId) {
            return;
        }

        if (isLocal) {
            setSelectedFile({ fileName: file.fileName, reviewType: UploadDocumentType.REVIEW });
            getPdfObjectUrl(file.presignedUrl, (): void => {}, setDownloadStage);
            return;
        }

        const [id, version] = reviewId.split('.');

        let refreshedReview: GetDocumentReviewDto;
        try {
            refreshedReview = await getReviewById(
                baseUrl,
                baseHeaders,
                id,
                version,
                reviewData.nhsNumber,
            );
        } catch (e) {
            const error = e as AxiosError;
            if (error.code === '403') {
                navigate(routes.SESSION_EXPIRED);
                return;
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
                return;
            }
        }

        const refreshedFile = refreshedReview!.files?.find((f) => f.fileName === file.fileName);

        if (refreshedFile) {
            const updatedFiles = reviewData.files?.map((f) =>
                f.fileName === file.fileName
                    ? { ...f, presignedUrl: refreshedFile.presignedUrl }
                    : f,
            );

            if (updatedFiles) {
                reviewData.files = updatedFiles;
                setReviewData(reviewData);
            }

            setSelectedFile({ fileName: file.fileName, reviewType: UploadDocumentType.REVIEW });
        }
        setDownloadStage(DOWNLOAD_STAGE.SUCCEEDED);
    };

    if (!reviewData) {
        return <Spinner status={'Loading'} />;
    }

    const reviewConfig = getConfigForDocType(reviewData?.snomedCode || '');
    const reviewTypeLabel = reviewConfig.displayName;

    const canBeUpdatedAndDiscarded = reviewConfig.canBeUpdated && reviewConfig.canBeDiscarded; // show existing
    const canBeUpdatedOrDiscarded = reviewConfig.canBeUpdated || reviewConfig.canBeDiscarded; // show new files

    const handleContinue = (): void => {
        setShowError(false);

        if (!reviewId) {
            return;
        }

        let navigateUrl: routeChildren;
        switch (fileAction) {
            case 'add-all':
                if (reviewConfig.canBeUpdated === true && reviewConfig.canBeDiscarded === false) {
                    navigateUrl = routeChildren.ADMIN_REVIEW_UPLOAD;
                    break;
                }
                navigateUrl = routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE;
                break;
            case 'choose-files':
                navigateUrl = routeChildren.ADMIN_REVIEW_CHOOSE_WHICH_FILES;
                break;
            case 'duplicate':
                navigateUrl = routeChildren.ADMIN_REVIEW_NO_FILES_CHOICE;
                break;
            case 'accept':
                if (uploadDocuments.length === 1) {
                    navigateUrl =
                        reviewConfig.multifileReview === true
                            ? routeChildren.ADMIN_REVIEW_ADD_MORE_CHOICE
                            : routeChildren.ADMIN_REVIEW_UPLOAD;
                    break;
                }

                navigateUrl = routeChildren.ADMIN_REVIEW_UPLOAD_FILE_ORDER;
                break;
            case 'reject':
                navigateUrl = routeChildren.ADMIN_REVIEW_NO_FILES_CHOICE;
                break;

            default:
                setShowError(true);
                setTimeout(() => {
                    errorSummaryRef.current?.focus();
                }, 0);
                return;
        }

        navigateUrlParam(navigateUrl, { reviewId }, navigate);
    };

    const backButton = <BackButton backLinkText="Go back" dataTestid="back-button" />;

    if (!uploadDocuments || !reviewData) {
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
        const andExisting = reviewData.existingFiles!.length > 0 ? ' and existing ' : ' ';
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

            <p>You are reviewing the {reviewTypeLabel} for:</p>

            <div className="nhsuk-inset-text">
                <PatientSummary>
                    <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                    <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                    <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                </PatientSummary>
            </div>

            {canBeUpdatedAndDiscarded && reviewData.existingFiles!.length > 0 && (
                <ExistingRecordTable
                    existingFiles={reviewData.existingFiles!}
                    onFileView={handleExistingFileView}
                />
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
                            {uploadDocuments
                                .filter((f) => f.type === UploadDocumentType.REVIEW)
                                .map((uploadDoc) => {
                                    const file = reviewData.files?.find(
                                        (f) => f.fileName === uploadDoc.file.name,
                                    );
                                    if (!file) {
                                        return <></>;
                                    }
                                    const date = getFormattedDateFromString(file.uploadDate);
                                    return (
                                        <Table.Row key={uploadDoc.id}>
                                            <Table.Cell>
                                                <strong>{file.fileName}</strong>
                                            </Table.Cell>
                                            <Table.Cell>{date}</Table.Cell>
                                            <Table.Cell>
                                                <button
                                                    type="button"
                                                    aria-label={`View ${file.fileName}`}
                                                    className="link-button"
                                                    onClick={(): void => {
                                                        handleNewFileView(file);
                                                    }}
                                                >
                                                    View
                                                </button>
                                            </Table.Cell>
                                        </Table.Row>
                                    );
                                })}
                        </Table.Body>
                    </Table>
                </section>
            )}

            {!selectedFile && (
                <>
                    <p>
                        <strong>You are currently viewing: all files</strong>
                    </p>

                    <DocumentUploadLloydGeorgePreview
                        documents={uploadDocuments.filter((f) => f.file.name.endsWith('.pdf'))}
                        setMergedPdfBlob={(): void => {}}
                        stitchedBlobLoaded={(): void => {}}
                        documentConfig={reviewConfig}
                    />
                </>
            )}

            {selectedFile && (
                <section className="file-viewer mb-4">
                    <p>
                        <strong>
                            You are currently viewing
                            {uploadDocuments.filter((f) => f.file.name === selectedFile.fileName)
                                .length >= 2 &&
                                (selectedFile.reviewType === UploadDocumentType.EXISTING
                                    ? ' (existing files)'
                                    : ' (new files)')}
                            {': '}
                            {selectedFile.fileName}
                        </strong>
                    </p>
                    {downloadStage === DOWNLOAD_STAGE.PENDING ? (
                        <Spinner status="Preparing file for viewing..." />
                    ) : (
                        <DocumentUploadLloydGeorgePreview
                            documents={uploadDocuments.filter(
                                (f) =>
                                    f.type === selectedFile.reviewType &&
                                    f.file.name === selectedFile.fileName &&
                                    f.file.name.endsWith('.pdf'),
                            )}
                            setMergedPdfBlob={(): void => {}}
                            stitchedBlobLoaded={(): void => {}}
                            documentConfig={reviewConfig}
                        />
                    )}
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

export default ReviewDetailsAssessmentStage;
