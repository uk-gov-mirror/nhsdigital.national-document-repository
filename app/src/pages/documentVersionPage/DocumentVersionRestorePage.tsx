import { useEffect, useState } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import DocumentVersionRestoreHistoryStage from '../../components/blocks/_documentVersion/documentVersionRestoreHistoryStage/DocumentVersionRestoreHistoryStage';
import DocumentView, {
    DOCUMENT_VIEW_STATE,
} from '../../components/blocks/_patientDocuments/documentView/DocumentView';
import useConfig from '../../helpers/hooks/useConfig';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';
import { routeChildren, routes } from '../../types/generic/routes';
import { DocumentReference } from '../../types/pages/documentSearchResultsPage/types';

const DocumentVersionRestorePage = (): React.JSX.Element => {
    const [documentReferenceToRestore, setDocumentReferenceToRestore] =
        useState<DocumentReference | null>(null);
    const [documentReference, setDocumentReference] = useState<DocumentReference | null>(null);
    const [latestVersion, setLatestVersion] = useState<string>('');
    const config = useConfig();
    const navigate = useNavigate();

    useEffect(() => {
        if (!config.featureFlags?.versionHistoryEnabled) {
            navigate(routes.HOME);
        }
    }, [config.featureFlags, navigate]);

    if (!config.featureFlags?.versionHistoryEnabled) {
        return <></>;
    }

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
        </Routes>
    );
};

export default DocumentVersionRestorePage;
