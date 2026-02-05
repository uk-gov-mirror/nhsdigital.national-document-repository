import { Button } from 'nhsuk-react-components';
import useTitle from '../../../../helpers/hooks/useTitle';
import { UploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';
import BackButton from '../../../generic/backButton/BackButton';
import { useEffect, useState, useRef, Dispatch, SetStateAction } from 'react';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import DocumentUploadLloydGeorgePreview from '../documentUploadLloydGeorgePreview/DocumentUploadLloydGeorgePreview';
import SpinnerButton from '../../../generic/spinnerButton/SpinnerButton';
import DocumentList from './components/DocumentList';

type Props = {
    documents: UploadDocument[];
    setDocuments: Dispatch<SetStateAction<UploadDocument[]>>;
    confirmFiles: () => void;
};

const DocumentUploadConfirmStage = ({
    documents,
    setDocuments,
    confirmFiles,
}: Props): React.JSX.Element => {
    const [stitchedBlobLoaded, setStitchedBlobLoaded] = useState(false);
    const [currentPreviewDocument, setCurrentPreviewDocument] = useState<
        UploadDocument | undefined
    >(
        documents.length === 1
            ? documents.find((doc) => doc.file.type === 'application/pdf')
            : undefined,
    );
    const processingFiles = useRef<boolean>(false);
    const [hasStitchedDocType, setHasStitchedDocType] = useState<boolean>(false);
    const [hasUnstitchedDocType, setHasUnstitchedDocType] = useState<boolean>(false);
    const [groupedDocuments, setGroupedDocuments] = useState<
        { [key in DOCUMENT_TYPE]: UploadDocument[] } | null
    >(null);
    const documentPreviewRef = useRef<HTMLDivElement>(null);

    useTitle({ pageTitle: 'Check files are for the correct patient' });

    useEffect(() => {
        if (processingFiles.current) return;

        processingFiles.current = true;

        const groupedDocs = groupDocumentsByType(documents);

        let hasStitched = false;
        let hasUnstitched = false;

        Object.keys(groupedDocs).forEach((docType) => {
            const documentConfig = getConfigForDocType(docType as DOCUMENT_TYPE);
            if (documentConfig.stitched) {
                if (!currentPreviewDocument) {
                    setCurrentPreviewDocument(groupedDocs[docType as DOCUMENT_TYPE][0]);
                }

                hasStitched = true;
            } else {
                hasUnstitched = true;
            }
        });

        setHasStitchedDocType(hasStitched);
        setHasUnstitchedDocType(hasUnstitched);

        processingFiles.current = false;
    }, [documents]);

    const groupDocumentsByType = (
        documents: UploadDocument[],
    ): { [key in DOCUMENT_TYPE]: UploadDocument[] } => {
        const groupedDocs = documents.reduce(
            (groups, doc) => {
                const type = doc.docType;
                if (!groups[type]) {
                    groups[type] = [];
                }
                groups[type].push(doc);
                return groups;
            },
            {} as { [key in DOCUMENT_TYPE]: UploadDocument[] },
        );

        setGroupedDocuments(groupedDocs);

        return groupedDocs;
    };

    const getDocumentsForPreview = (): UploadDocument[] => {
        if (!groupedDocuments) {
            return [];
        }

        const docs = [];

        const currentDocConfig = currentPreviewDocument
            ? getConfigForDocType(currentPreviewDocument.docType)
            : null;

        if (currentDocConfig?.stitched) {
            docs.push(...groupedDocuments[currentPreviewDocument!.docType]);
        } else if (currentPreviewDocument) {
            docs.push(currentPreviewDocument);
        }

        return docs.sort((a, b) => a.position! - b.position!);
    };

    const confirmClicked = (): void => {
        processingFiles.current = true;
        confirmFiles();
    };

    const setPreviewDocument = (document: UploadDocument): void => {
        setCurrentPreviewDocument(document);
        // timeout to wait for first render before scrolling
        setTimeout(() => {
            if (typeof documentPreviewRef?.current?.scrollIntoView === 'function') {
                documentPreviewRef?.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }, 2);
    };

    const removeDocument = (docToRemove: UploadDocument): void => {
        const updatedDocs = documents.filter((doc) => doc.id !== docToRemove.id);

        groupDocumentsByType(updatedDocs);

        if (currentPreviewDocument?.id === docToRemove.id) {
            setCurrentPreviewDocument(undefined);
        } else if (updatedDocs.length === 1 && updatedDocs[0].file.type === 'application/pdf') {
            setCurrentPreviewDocument(updatedDocs[0]);
        }

        setDocuments(updatedDocs);
    };

    const docLists = (): React.JSX.Element[] => {
        if (!groupedDocuments) return [];

        const canRemoveFiles = documents.length > 1 && hasUnstitchedDocType;

        return Object.keys(groupedDocuments).map((docType) => {
            const documentsForType = groupedDocuments[docType as DOCUMENT_TYPE];
            const canPreviewFiles =
                canRemoveFiles &&
                documentsForType.some((doc) => doc.file.type === 'application/pdf');

            return (
                <DocumentList
                    documents={documentsForType}
                    docType={docType as DOCUMENT_TYPE}
                    showViewFileColumn={canPreviewFiles}
                    setPreviewDocument={setPreviewDocument}
                    onRemoveFile={canRemoveFiles ? removeDocument : undefined}
                    key={docType}
                />
            );
        });
    };

    const documentPreview = (): React.JSX.Element => {
        if (!currentPreviewDocument) {
            return <div ref={documentPreviewRef}></div>;
        }

        const config = getConfigForDocType(currentPreviewDocument.docType);

        const updateStitchedBlob = config.stitched
            ? (loaded: boolean): void => {
                  setStitchedBlobLoaded(loaded);
              }
            : undefined;

        const showCurrentlyViewingText =
            hasUnstitchedDocType && documents.length > 0 && !!groupedDocuments;

        return (
            <div ref={documentPreviewRef}>
                <DocumentUploadLloydGeorgePreview
                    documents={getDocumentsForPreview()}
                    stitchedBlobLoaded={updateStitchedBlob}
                    documentConfig={config}
                    showCurrentlyViewingText={showCurrentlyViewingText}
                />
            </div>
        );
    };

    return (
        <div className="document-upload-confirm">
            <BackButton dataTestid="go-back-link" />
            <h1>Check files are for the correct patient</h1>

            <div className="nhsuk-inset-text">
                <p>Make sure that all files uploaded are for this patient only:</p>
                <PatientSummary>
                    <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                    <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                    <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                </PatientSummary>
            </div>

            {!processingFiles.current && docLists()}

            {documentPreview()}

            {(!hasStitchedDocType || stitchedBlobLoaded) && !processingFiles.current && (
                <Button data-testid="confirm-button" onClick={confirmClicked}>
                    Confirm and upload files
                </Button>
            )}
            {processingFiles.current && (
                <SpinnerButton
                    id="confirm-spinner"
                    status="Preparing files"
                    disabled={true}
                    className="mt-4"
                />
            )}
            {hasStitchedDocType && !stitchedBlobLoaded && (
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
