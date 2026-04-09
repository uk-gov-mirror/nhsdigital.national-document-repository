import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import DocumentVersionRestoreHistoryStage from '../../components/blocks/_documentVersion/documentVersionRestoreHistoryStage/DocumentVersionRestoreHistoryStage';
import DocumentVersionRestoreUploadingStage from '../../components/blocks/_documentVersion/documentVersionRestoreUploadingStage/DocumentVersionRestoreUploadingStage';
import DocumentVersionRestoreCompleteStage from '../../components/blocks/_documentVersion/documentVersionRestoreCompleteStage/DocumentVersionRestoreCompleteStage';
import DocumentVersionRestoreConfirmStage from '../../components/blocks/_documentVersion/documentVersionRestoreConfirmStage/DocumentVersionRestoreConfirmStage';
import DocumentView, {
    DOCUMENT_VIEW_STATE,
} from '../../components/blocks/_patientDocuments/documentView/DocumentView';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';
import { routeChildren } from '../../types/generic/routes';
import { DocumentReference } from '../../types/pages/documentSearchResultsPage/types';
import { UploadDocument } from '../../types/pages/UploadDocumentsPage/types';

const DocumentVersionRestorePage = (): React.JSX.Element => {
    const [documentReferenceToRestore, setDocumentReferenceToRestore] =
        useState<DocumentReference | null>(null);
    const [documentReference, setDocumentReference] = useState<DocumentReference | null>(null);
    const [documents, setDocuments] = useState<UploadDocument[]>([]);
    const [latestVersion, setLatestVersion] = useState<string>('');

    const resetState = (): void => {
        setDocumentReferenceToRestore(null);
        setDocuments([]);
    };

    return (
        <Routes>
            <Route
                index
                element={
                    <DocumentVersionRestoreHistoryStage
                        documentReference={documentReference}
                        setDocumentReferenceToRestore={setDocumentReferenceToRestore}
                        setDocumentReference={setDocumentReference}
                        setLatestVersion={setLatestVersion}
                    />
                }
            />
            <Route
                path={getLastURLPath(routeChildren.DOCUMENT_VIEW_VERSION_HISTORY) + '/*'}
                element={
                    <DocumentView
                        viewState={DOCUMENT_VIEW_STATE.VERSION_HISTORY}
                        documentReference={documentReferenceToRestore!}
                        isActiveVersion={documentReferenceToRestore?.version === latestVersion}
                    />
                }
            />
            <Route
                path={getLastURLPath(routeChildren.DOCUMENT_VERSION_RESTORE_CONFIRM) + '/*'}
                element={
                    <DocumentVersionRestoreConfirmStage
                        documentReferenceToRestore={documentReferenceToRestore}
                    />
                }
            />
            <Route
                path={getLastURLPath(routeChildren.DOCUMENT_VERSION_RESTORE_UPLOADING) + '/*'}
                element={
                    <DocumentVersionRestoreUploadingStage
                        documentReferenceToRestore={documentReferenceToRestore}
                        documentReference={documentReference}
                        uploadDoc={documents}
                        setUploadDoc={setDocuments}
                    />
                }
            />
            <Route
                path={getLastURLPath(routeChildren.DOCUMENT_VERSION_RESTORE_COMPLETE) + '/*'}
                element={
                    <DocumentVersionRestoreCompleteStage
                        resetState={resetState}
                        documentReference={documentReference}
                    />
                }
            />
        </Routes>
    );
};

export default DocumentVersionRestorePage;
