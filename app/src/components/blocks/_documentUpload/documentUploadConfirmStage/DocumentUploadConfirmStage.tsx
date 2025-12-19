import { Button, Table } from 'nhsuk-react-components';
import useTitle from '../../../../helpers/hooks/useTitle';
import { UploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';
import BackButton from '../../../generic/backButton/BackButton';
import { routeChildren } from '../../../../types/generic/routes';
import { useState } from 'react';
import Pagination from '../../../generic/pagination/Pagination';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import { getJourney, useEnhancedNavigate } from '../../../../helpers/utils/urlManipulations';
import { DOCUMENT_TYPE_CONFIG } from '../../../../helpers/utils/documentType';
import DocumentUploadLloydGeorgePreview from '../documentUploadLloydGeorgePreview/DocumentUploadLloydGeorgePreview';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';

type Props = {
    documents: UploadDocument[];
    documentConfig: DOCUMENT_TYPE_CONFIG;
    confirmFiles: () => void;
};

const DocumentUploadConfirmStage = ({
    documents,
    documentConfig,
    confirmFiles,
}: Props): React.JSX.Element => {
    const [currentPage, setCurrentPage] = useState<number>(0);
    const navigate = useEnhancedNavigate();
    const pageSize = 10;
    const journey = getJourney();
    const [stitchedBlobLoaded, setStitchedBlobLoaded] = useState(false);
    const [currentPreviewDocument, setCurrentPreviewDocument] = useState<
        UploadDocument | undefined
    >(
        documents.length === 1
            ? documents.find((doc) => doc.file.type === 'application/pdf')
            : undefined,
    );
    const [processingFiles, setProcessingFiles] = useState<boolean>(false);

    const multifile = documentConfig.multifileReview || documentConfig.multifileUpload;

    useTitle({ pageTitle: documentConfig.content.confirmFilesTitle as string });

    const currentItems = (): UploadDocument[] => {
        const skipCount = currentPage * pageSize;
        return documents.slice(skipCount, skipCount + pageSize);
    };

    const totalPages = (): number => {
        return Math.ceil(documents.length / pageSize);
    };

    const getDocumentsForPreview = (): UploadDocument[] => {
        const docs = [];

        if (documentConfig.stitched) {
            docs.push(...documents);
        } else if (currentPreviewDocument) {
            docs.push(currentPreviewDocument);
        }

        return docs.sort((a, b) => a.position! - b.position!);
    };

    const getFileActionParagraph = (): string => {
        if (documentConfig.stitched) {
            if (journey === 'update') {
                return `Files will be added to the existing ${documentConfig.displayName} to create a single PDF document.`;
            }

            return `Files will be combined into a single PDF document to create a ${documentConfig.displayName} record for this patient.`;
        }

        return multifile
            ? `Each file will be uploaded as a separate ${documentConfig.displayName} for this patient.`
            : `This file will be uploaded as a new ${documentConfig.displayName} for this patient.`;
    };

    const confirmClicked = (): void => {
        if (documentConfig.multifileZipped) {
            setProcessingFiles(true);
        }
        confirmFiles();
    };

    return (
        <div className="document-upload-confirm">
            <BackButton dataTestid="go-back-link" />
            <h1>{documentConfig.content.confirmFilesTitle}</h1>

            <div className="nhsuk-inset-text">
                <p>
                    {multifile
                        ? 'Make sure that all files uploaded are for this patient only:'
                        : 'Make sure that the uploaded file is for this patient only:'}
                </p>
                <PatientSummary>
                    <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                    <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                    <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                </PatientSummary>
            </div>

            <p>{getFileActionParagraph()}</p>

            <h4>File{multifile ? 's' : ''} to be uploaded</h4>

            <Table id="selected-documents-table">
                <Table.Head>
                    <Table.Row>
                        <Table.Cell>Filename</Table.Cell>
                        {documentConfig.stitched && (
                            <Table.Cell width="25%" className="word-break-keep-all">
                                Position
                            </Table.Cell>
                        )}
                        {multifile && !documentConfig.stitched && <Table.Cell>Preview</Table.Cell>}
                        {multifile && (
                            <Table.Cell width="10%" className="word-break-keep-all">
                                <button
                                    className="govuk-link"
                                    rel="change"
                                    data-testid="change-files-button"
                                    onClick={(e): void => {
                                        e.preventDefault();
                                        navigate.withParams(
                                            routeChildren.DOCUMENT_UPLOAD_SELECT_FILES,
                                        );
                                    }}
                                >
                                    Change files
                                </button>
                            </Table.Cell>
                        )}
                    </Table.Row>
                </Table.Head>

                <Table.Body>
                    {currentItems().map((document: UploadDocument) => {
                        return (
                            <Table.Row key={document.id} id={document.file.name}>
                                <Table.Cell>
                                    <div>
                                        <strong>{document.file.name}</strong>
                                    </div>
                                </Table.Cell>
                                {documentConfig.stitched && (
                                    <Table.Cell>{document.position}</Table.Cell>
                                )}
                                {!documentConfig.stitched && documents.length > 1 && (
                                    <Table.Cell>
                                        {document.file.type === 'application/pdf' ? (
                                            <button
                                                className="govuk-link"
                                                rel="preview"
                                                data-testid={`preview-${document.id}-button`}
                                                onClick={(e): void => {
                                                    e.preventDefault();
                                                    setCurrentPreviewDocument(document);
                                                }}
                                            >
                                                Preview
                                            </button>
                                        ) : (
                                            '-'
                                        )}
                                    </Table.Cell>
                                )}
                                <Table.Cell></Table.Cell>
                            </Table.Row>
                        );
                    })}
                </Table.Body>
            </Table>

            <Pagination
                totalPages={totalPages()}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
            />

            {(documentConfig.stitched || currentPreviewDocument) && (
                <div>
                    <DocumentUploadLloydGeorgePreview
                        documents={getDocumentsForPreview()}
                        stitchedBlobLoaded={(loaded: boolean): void => {
                            setStitchedBlobLoaded(loaded);
                        }}
                        documentConfig={documentConfig}
                    />
                </div>
            )}

            {(!documentConfig.stitched || stitchedBlobLoaded) && !processingFiles && (
                <Button data-testid="confirm-button" onClick={confirmClicked}>
                    Confirm and upload file{multifile ? 's' : ''}
                </Button>
            )}
            {processingFiles && (
                <SpinnerButton
                    id="confirm-spinner"
                    status="Preparing files"
                    disabled={true}
                    className="mt-4"
                />
            )}
            {documentConfig.stitched && !stitchedBlobLoaded && (
                <SpinnerButton
                    id="continue-spinner"
                    status="Stitching PDF"
                    disabled={true}
                    className="mt-4"
                />
            )}
        </div>
    );
};

export default DocumentUploadConfirmStage;
