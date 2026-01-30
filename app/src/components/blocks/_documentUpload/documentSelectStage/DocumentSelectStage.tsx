import {
    BackLink,
    Button,
    Fieldset,
    Table,
    TextInput,
    WarningCallout,
} from 'nhsuk-react-components';
import { getDocument } from 'pdfjs-dist';
import { JSX, RefObject, useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useTitle from '../../../../helpers/hooks/useTitle';
import {
    fileUploadErrorMessages,
    groupUploadErrorsByType,
    PDF_PARSING_ERROR_TYPE,
    UPLOAD_FILE_ERROR_TYPE,
} from '../../../../helpers/utils/fileUploadErrorMessages';
import formatFileSize from '../../../../helpers/utils/formatFileSize';
import { routeChildren, routes } from '../../../../types/generic/routes';
import {
    DOCUMENT_UPLOAD_STATE,
    FileInputEvent,
    SetUploadDocuments,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import LinkButton from '../../../generic/linkButton/LinkButton';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import ErrorBox from '../../../layout/errorBox/ErrorBox';
import { ErrorMessageListItem } from '../../../../types/pages/genericPageErrors';
import { getJourney, useEnhancedNavigate } from '../../../../helpers/utils/urlManipulations';
import { DOCUMENT_TYPE, DOCUMENT_TYPE_CONFIG } from '../../../../helpers/utils/documentType';
import rejectedFileTypes from '../../../../config/rejectedFileTypes.json';

export type Props = {
    setDocuments: SetUploadDocuments;
    documents: Array<UploadDocument>;
    documentType: DOCUMENT_TYPE;
    filesErrorRef: RefObject<boolean>;
    documentConfig: DOCUMENT_TYPE_CONFIG;
    onSuccessOverride?: () => void;
    backLinkOverride?: string;
    goToNextDocType?: () => void;
    goToPreviousDocType?: () => void;
    showSkiplink?: boolean;
};

type UploadFilesError = ErrorMessageListItem<UPLOAD_FILE_ERROR_TYPE>;

const DocumentSelectStage = ({
    documents,
    setDocuments,
    documentType,
    filesErrorRef,
    documentConfig,
    onSuccessOverride,
    backLinkOverride,
    goToNextDocType,
    goToPreviousDocType,
    showSkiplink,
}: Props): JSX.Element => {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [noFilesSelected, setNoFilesSelected] = useState<boolean>(false);
    const scrollToRef = useRef<HTMLDivElement>(null);
    const fileInputAreaRef = useRef<HTMLFieldSetElement>(null);
    const [lastErrorsLength, setLastErrorsLength] = useState(0);
    const [tooManyFilesAdded, setTooManyFilesAdded] = useState<boolean>(false);
    const [removeFilesToSkip, setRemoveFilesToSkip] = useState<boolean>(false);
    const journey = getJourney();

    const navigate = useEnhancedNavigate();
    const multifile = documentConfig.multifileUpload || documentConfig.multifileReview;

    const validateFileType = (file: File): boolean => {
        const fileExtension = file.name.split('.').pop()?.toUpperCase();
        if (!fileExtension || rejectedFileTypes.includes(fileExtension)) {
            return false;
        }

        return (
            documentConfig.acceptedFileTypes.length === 0 ||
            documentConfig.acceptedFileTypes.includes(fileExtension)
        );
    };

    useEffect(() => {
        if (filesErrorRef.current) {
            navigate(routes.HOME);
            return;
        }
    }, []);

    const onFileDrop = (e: React.DragEvent<HTMLDivElement>): void => {
        e.preventDefault();
        e.stopPropagation();

        fileInputAreaRef.current?.scrollIntoView({ behavior: 'smooth' });

        let fileArray: File[] = [];
        if (e.dataTransfer.items?.length > 0) {
            [...e.dataTransfer.items].forEach((item) => {
                const file = item.getAsFile();

                if (item.kind === 'file' && file) {
                    fileArray.push(file);
                }
            });
        } else if (e.dataTransfer.files?.length > 0) {
            fileArray = [...e.dataTransfer.files];
        }

        if (!multifile && fileArray.length > 1) {
            resetErrors();
            setTooManyFilesAdded(true);
            return;
        }

        setTooManyFilesAdded(false);

        if (fileArray) {
            void updateFileList(fileArray);
        }
    };

    const onInput = (e: FileInputEvent): void => {
        fileInputAreaRef.current?.scrollIntoView({ behavior: 'smooth' });
        const fileArray = Array.from(e.target.files ?? new FileList());

        void updateFileList(fileArray);
    };

    const updateFileList = async (fileArray: File[]): Promise<void> => {
        const documentMap = fileArray.map(async (file) => {
            const document: UploadDocument = {
                id: uuidv4(),
                file,
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: documentType,
                attempts: 0,
                numPages: 0,
                validated: false,
            };

            if (!validateFileType(file)) {
                document.state = DOCUMENT_UPLOAD_STATE.FAILED;
                document.error = UPLOAD_FILE_ERROR_TYPE.invalidFileType;
                return document;
            }

            if (documents.some((d) => d.file.name === document.file.name)) {
                document.state = DOCUMENT_UPLOAD_STATE.FAILED;
                document.error = UPLOAD_FILE_ERROR_TYPE.duplicateFileName;
                return document;
            }

            if (file.type !== 'application/pdf') {
                return document;
            }

            const buffer = await file.arrayBuffer();

            try {
                const pdf = await getDocument(buffer).promise;
                await pdf.getPage(1);
                document.numPages = pdf.numPages;
                await pdf.destroy();
            } catch (e) {
                const error = e as Error;
                document.state = DOCUMENT_UPLOAD_STATE.FAILED;

                if (error.message === PDF_PARSING_ERROR_TYPE.INVALID_PDF_STRUCTURE) {
                    document.error = UPLOAD_FILE_ERROR_TYPE.invalidPdf;
                } else if (error.message === PDF_PARSING_ERROR_TYPE.PASSWORD_MISSING) {
                    document.error = UPLOAD_FILE_ERROR_TYPE.passwordProtected;
                } else if (error.message === PDF_PARSING_ERROR_TYPE.EMPTY_PDF) {
                    document.error = UPLOAD_FILE_ERROR_TYPE.emptyPdf;
                }
            }

            return document;
        });

        const docs = await Promise.all(documentMap);

        const failedDocs = docs.filter(
            (doc) => doc.state === DOCUMENT_UPLOAD_STATE.FAILED && doc.error,
        );

        if (failedDocs.length > 0) {
            filesErrorRef.current = true;
            setDocuments(failedDocs);
            navigate(routeChildren.DOCUMENT_UPLOAD_FILE_ERRORS);
            return;
        }

        updateDocuments(multifile ? [...docs, ...documents] : [...docs]);
    };

    const onRemove = (index: number): void => {
        let updatedDocList: UploadDocument[] = [...documents];
        updatedDocList.splice(index, 1);

        if (updatedDocList.filter((doc) => doc.docType === documentType).length === 0) {
            setRemoveFilesToSkip(false);
        }

        updateDocuments(updatedDocList);
    };

    const updateDocuments = (docs: UploadDocument[]): void => {
        const sortedDocs = docs
            .sort((a, b) => a.file.lastModified - b.file.lastModified)
            .map((doc, index) => ({
                ...doc,
                position: index + 1,
            }));

        setDocuments((previousState) => {
            const docs = previousState.filter((doc) => doc.docType !== documentType);
            return [...docs, ...sortedDocs];
        });
    };

    const validateDocuments = (): boolean => {
        setNoFilesSelected(documents.length === 0);

        documents?.forEach((doc) => (doc.validated = true));

        setDocuments((previousState) => {
            previousState.forEach((doc) => {
                if (doc.docType === documentType) {
                    doc.validated = true;
                }
            });
            return [...previousState];
        });

        return (
            documents.length > 0 &&
            documents.every((doc) => doc.state !== DOCUMENT_UPLOAD_STATE.FAILED)
        );
    };

    const navigateToNextStep = (): void => {
        if (documentConfig.stitched) {
            navigate.withParams(routeChildren.DOCUMENT_UPLOAD_SELECT_ORDER);
            return;
        }

        navigate.withParams(routeChildren.DOCUMENT_UPLOAD_CONFIRMATION);
    };

    const continueClicked = (): void => {
        resetErrors();
        
        if (!validateDocuments()) {
            scrollToRef.current?.scrollIntoView({ behavior: 'smooth' });
            return;
        }

        if (onSuccessOverride) {
            onSuccessOverride();
            return;
        }

        if (documentConfig.stitched) {
            navigate.withParams(routeChildren.DOCUMENT_UPLOAD_SELECT_ORDER);
            return;
        }

        skipClicked(false);
    };

    const skipClicked = (checkDocCount: boolean = true): void => {
        if (checkDocCount && documents.some(doc => doc.docType === documentType)) {
            resetErrors();
            setRemoveFilesToSkip(true);
            setTimeout(() => {
                scrollToRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 0);
            return;
        }

        if (goToNextDocType) {
            goToNextDocType();
            window.scrollTo(0, 0);
        } else {
            navigateToNextStep();
        }

        resetErrors();
    };

    const DocumentRow = (document: UploadDocument, index: number): JSX.Element => {
        return (
            <Table.Row key={document.id} id={document.file.name}>
                <Table.Cell className={document.error ? 'error-cell' : ''}>
                    <strong>{document.file.name}</strong>
                </Table.Cell>
                <Table.Cell>{formatFileSize(document.file.size)}</Table.Cell>
                <Table.Cell>
                    <button
                        type="button"
                        aria-label={`Remove ${document.file.name} from selection`}
                        className="link-button"
                        onClick={(): void => {
                            onRemove(index);
                        }}
                    >
                        Remove
                    </button>
                </Table.Cell>
            </Table.Row>
        );
    };

    const pageTitle = (): string => {
        const pageTitle =
            journey === 'new'
                ? documentConfig.content.uploadFilesSelectTitle
                : documentConfig.content.addFilesSelectTitle;

        return pageTitle as string;
    };

    useTitle({ pageTitle: pageTitle() });

    const errorDocs = (): UploadDocument[] => {
        return documents.filter((doc) => doc.error && doc.validated);
    };

    useEffect(() => {
        const currentErrorsLength = errorDocs().length;
        if (lastErrorsLength <= currentErrorsLength) {
            scrollToRef.current?.scrollIntoView({ behavior: 'smooth' });
        }

        setLastErrorsLength(currentErrorsLength);
    }, [errorDocs().length, noFilesSelected]);

    const errorMessageList = (): UploadFilesError[] => {
        const errors: UploadFilesError[] = [];

        if (noFilesSelected) {
            errors.push({
                linkId: 'upload-files',
                error: UPLOAD_FILE_ERROR_TYPE.noFiles,
            });
        } else if (tooManyFilesAdded) {
            errors.push({
                linkId: 'upload-files',
                error: UPLOAD_FILE_ERROR_TYPE.tooManyFiles,
            });
        } else if (removeFilesToSkip) {
            errors.push({
                linkId: 'upload-files',
                error: UPLOAD_FILE_ERROR_TYPE.removeFilesToSkip,
            });
        } else {
            errorDocs().forEach((doc) => {
                errors.push({
                    linkId: doc.file.name,
                    error: doc.error!,
                });
            });
        }

        return errors;
    };

    const resetErrors = (): void => {
        setNoFilesSelected(false);
        setTooManyFilesAdded(false);
        setRemoveFilesToSkip(false);
    };

    const backClicked = (): void => {
        if (backLinkOverride) {
            navigate(backLinkOverride);
        } else if (goToPreviousDocType) {
            goToPreviousDocType();
            resetErrors();
        } else {
            navigate(routes.VERIFY_PATIENT);
        }
    };

    return (
        <div className="document-select-stage">
            <BackLink onClick={backClicked} data-testid="back-button">
                Go back
            </BackLink>

            {(errorDocs().length > 0 || noFilesSelected || tooManyFilesAdded || removeFilesToSkip) && (
                <ErrorBox
                    dataTestId="error-box"
                    errorBoxSummaryId="failed-document-uploads-summary-title"
                    messageTitle="There is a problem"
                    errorMessageList={errorMessageList()}
                    groupErrorsFn={groupUploadErrorsByType}
                    scrollToRef={scrollToRef}
                ></ErrorBox>
            )}

            <h1 data-testid="page-title">{pageTitle()}</h1>

            <div className="nhsuk-inset-text">
                <p>Make sure that all files uploaded are for this patient only:</p>
                <PatientSummary>
                    <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                    <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                    <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                </PatientSummary>
            </div>

            {documentConfig.content.chooseFilesWarningText && (
                <WarningCallout>
                    <WarningCallout.Label>Important</WarningCallout.Label>
                    {([] as string[])
                        .concat(documentConfig.content.chooseFilesWarningText)
                        .map((text) => (
                            <p key={text}>{text}</p>
                        ))}
                </WarningCallout>
            )}

            <div>
                <h2 className="nhsuk-heading-m">{documentConfig.content.beforeYouUploadTitle}</h2>
                <ul>
                    {(documentConfig.content.uploadFilesBulletPoints as string[]).map(
                        (point, index) => (
                            <li key={`bullet-${index}`}>{point}</li>
                        ),
                    )}
                </ul>
                {multifile ? (
                    <p>
                        Uploading may take longer if there are many files or if individual files are
                        large.
                    </p>
                ) : (
                    <p>Uploading may take longer if the file is large.</p>
                )}
            </div>

            <Fieldset ref={fileInputAreaRef}>
                <div className={`${noFilesSelected ? 'nhsuk-form-group--error' : ''}`}>
                    <h3>{documentConfig.content.chooseFilesMessage}</h3>
                    {noFilesSelected && (
                        <p className="nhsuk-error-message">
                            {fileUploadErrorMessages.noFiles.inline}
                        </p>
                    )}

                    <div
                        role="button"
                        id="upload-files"
                        tabIndex={0}
                        data-testid="dropzone"
                        onDragOver={(e): void => {
                            e.preventDefault();
                        }}
                        onDrop={onFileDrop}
                        className={'lloydgeorge_drag-and-drop'}
                    >
                        <strong className="lg-input-bold">
                            Drag and drop a file{multifile && ' or multiple files'} here
                        </strong>
                        <div>
                            <TextInput
                                data-testid={`button-input`}
                                type="file"
                                multiple={multifile}
                                hidden
                                accept={documentConfig.acceptedFileTypes
                                    .map((ext) => `.${ext}`)
                                    .join(',')}
                                onChange={(e: FileInputEvent): void => {
                                    onInput(e);
                                    e.target.value = '';
                                }}
                                // @ts-ignore  The NHS Component library is outdated and does not allow for any reference other than a blank MutableRefObject
                                inputRef={(e: HTMLInputElement): void => {
                                    fileInputRef.current = e;
                                }}
                            />
                            <Button
                                data-testid={`upload-button-input`}
                                type={'button'}
                                className={'nhsuk-button nhsuk-button--secondary bottom-margin'}
                                onClick={(): void => {
                                    fileInputRef.current?.click();
                                }}
                                aria-labelledby="upload-fieldset-legend"
                            >
                                {documentConfig.content.chooseFilesButtonLabel}
                            </Button>
                            {documents && documents.length > 0 && (
                                <div className="file-count-text" data-testid="file-selected-count">
                                    <strong>
                                        {`${documents.length}`} file
                                        {`${documents.length === 1 ? '' : 's'}`} chosen
                                    </strong>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Fieldset>
            {documents && documents.length > 0 && (
                <>
                    <Table
                        caption={`Chosen file${documents.length === 1 ? '' : 's'}`}
                        id="selected-documents-table"
                    >
                        <Table.Head>
                            <Table.Row>
                                <Table.Cell className="table-cell-lg-input-cell-border">
                                    <div
                                        className="div-lg-input-cell"
                                        data-testid="file-selected-count"
                                    >
                                        <strong>
                                            {`${documents.length}`} file
                                            {`${documents.length === 1 ? '' : 's'}`} chosen
                                        </strong>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                            <Table.Row>
                                <Table.Cell className="word-break-keep-all">Filename</Table.Cell>
                                <Table.Cell width="20%" className="word-break-keep-all">
                                    File size
                                </Table.Cell>
                                <Table.Cell className="word-break-keep-all">Remove file</Table.Cell>
                            </Table.Row>
                        </Table.Head>

                        <Table.Body>
                            {documents.map((document, index) => DocumentRow(document, index))}
                        </Table.Body>
                    </Table>
                    {multifile && (
                        <LinkButton
                            type="button"
                            className="remove-all-button mb-5"
                            data-testid="remove-all-button"
                            onClick={(): void => {
                                navigate.withParams(routeChildren.DOCUMENT_UPLOAD_REMOVE_ALL);
                            }}
                        >
                            Remove all files
                        </LinkButton>
                    )}
                </>
            )}
            <div className="action-buttons">
                <Button
                    type="button"
                    id="continue-button"
                    data-testid="continue-button"
                    onClick={continueClicked}
                    className="continue-button mr-4"
                >
                    Continue
                </Button>
                {showSkiplink && (
                    <LinkButton data-testid="skip-link" onClick={() => skipClicked()}>
                        {documentConfig.content.skipDocumentLinkText}
                    </LinkButton>
                )}
            </div>
        </div>
    );
};

export default DocumentSelectStage;
