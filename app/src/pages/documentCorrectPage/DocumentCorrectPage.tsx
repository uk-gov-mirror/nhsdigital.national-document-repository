import { Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import DocumentSelectPagesStage from '../../components/blocks/_documentManagement/documentSelectPagesStage/DocumentSelectPagesStage';
import { useEffect, useRef, useState } from 'react';
import { DocumentReference } from '../../types/pages/documentSearchResultsPage/types';
import { routeChildren, routes } from '../../types/generic/routes';
import { DocumentCorrectLocationState } from '../../types/pages/documentCorrect/types';
import { LocationParams } from '../../types/generic/location';
import { DOCUMENT_TYPE_CONFIG, getConfigForDocType } from '../../helpers/utils/documentType';
import { getLastURLPath } from '../../helpers/utils/urlManipulations';
import { AxiosError } from 'axios';
import { errorToParams } from '../../helpers/utils/errorToParams';
import DocumentRemovePagesConfirmStage from '../../components/blocks/_documentManagement/documentRemovePagesConfirmStage/DocumentRemovePagesConfirmStage';

const DocumentCorrectPage = (): React.JSX.Element => {
    const location: LocationParams<DocumentCorrectLocationState> = useLocation();
    const [documentReference, setDocumentReference] = useState<DocumentReference | null>(null);
    const [documentConfig, setDocumentConfig] = useState<DOCUMENT_TYPE_CONFIG | null>(null);
    const [pagesToRemove, setPagesToRemove] = useState<number[]>([]);
    const [baseDocumentBlob, setBaseDocumentBlob] = useState<Blob | null>(null);
    const getDocumentRef = useRef(false);
    const navigate = useNavigate();

    useEffect(() => {
        if (getDocumentRef.current) {
            return;
        }

        getDocumentRef.current = true;
        const docRef = location.state?.documentReference;
        if (!docRef) {
            navigate(routes.SERVER_ERROR);
            return;
        }

        setDocumentReference(docRef);
        setDocumentConfig(getConfigForDocType(docRef.documentSnomedCodeType));

        loadDocument(docRef);
    }, []);

    const loadDocument = async (docRef: DocumentReference): Promise<void> => {
        try {
            const response = await fetch(docRef.url!);
            const blob = await response.blob();
            setBaseDocumentBlob(blob);
        } catch (e) {
            const error = e as AxiosError;
            navigate(routes.SERVER_ERROR + errorToParams(error));
        }
    };

    if (!documentReference || !documentConfig || !baseDocumentBlob) {
        return <></>;
    }

    return (
        <>
            <Routes>
                <Route
                    path={getLastURLPath(routeChildren.DOCUMENT_REASSIGN_SELECT_PAGES) + '/*'}
                    element={
                        <DocumentSelectPagesStage
                            baseDocumentBlob={baseDocumentBlob}
                            documentConfig={documentConfig}
                            setPagesToRemove={setPagesToRemove}
                        />
                    }
                />

                <Route
                    path={
                        getLastURLPath(routeChildren.DOCUMENT_REASSIGN_CONFIRM_REMOVED_PAGES) + '/*'
                    }
                    element={
                        <DocumentRemovePagesConfirmStage
                            baseDocumentBlob={baseDocumentBlob}
                            pagesToRemove={pagesToRemove}
                        />
                    }
                />
            </Routes>

            <Outlet />
        </>
    );
};

export default DocumentCorrectPage;
