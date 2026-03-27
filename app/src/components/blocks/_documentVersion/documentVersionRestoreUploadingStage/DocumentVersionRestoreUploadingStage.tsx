import { Dispatch, SetStateAction, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import usePatient from '../../../../helpers/hooks/usePatient';
import { generateStitchedFileName } from '../../../../helpers/requests/uploadDocuments';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';
import {
    DOCUMENT_UPLOAD_STATE,
    UploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { v4 as uuidv4 } from 'uuid';
import ProgressingPage from '../../generic/progressingPage/ProgressingPage';
import { errorToParams } from '../../../../helpers/utils/errorToParams';
import getDocument from '../../../../helpers/requests/getDocument';
import { AxiosError } from 'axios';
import { fetchBlob } from '../../../../helpers/utils/getPdfObjectUrl';

type DocumentVersionRestoreUploadingStageProps = {
    documentReferenceToRestore: DocumentReference | null;
    documentReference: DocumentReference | null;
    uploadDoc: UploadDocument[];
    setUploadDoc: Dispatch<SetStateAction<UploadDocument[]>>;
};

const DocumentVersionRestoreUploadingStage = ({
    documentReferenceToRestore,
    documentReference,
    uploadDoc,
    setUploadDoc,
}: Readonly<DocumentVersionRestoreUploadingStageProps>): React.JSX.Element => {
    const navigate = useNavigate();
    const patientDetails = usePatient();
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();

    useEffect(() => {
        if (!documentReferenceToRestore) {
            navigate(routes.PATIENT_DOCUMENTS);
        }
    }, [documentReferenceToRestore, navigate]);

    if (!documentReferenceToRestore) {
        return <></>;
    }

    const documentConfig = getConfigForDocType(documentReferenceToRestore.documentSnomedCodeType);

    const loadDocument = async (documentId: string, version: string): Promise<Blob | undefined> => {
        try {
            const documentResponse = await getDocument({
                nhsNumber: patientDetails!.nhsNumber,
                baseUrl,
                baseHeaders,
                documentId,
                version,
            });

            return await fetchBlob(documentResponse.url);
        } catch (e) {
            const error = e as AxiosError;
            if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else {
                navigate(routes.SERVER_ERROR + errorToParams(error));
            }
        }
    };

    const prepareDocuments = async (): Promise<void> => {
        let objectBlob: Blob | undefined;
        if (uploadDoc.length === 0) {
            objectBlob = await loadDocument(
                documentReferenceToRestore.id,
                documentReferenceToRestore.version,
            );
        }

        const config = getConfigForDocType(documentReferenceToRestore.documentSnomedCodeType);
        if (config.stitched) {
            const filename = generateStitchedFileName(
                patientDetails,
                getConfigForDocType(documentReferenceToRestore.documentSnomedCodeType),
            );
            const versionId = `${Number(documentReference?.version)}`;
            const lgDocument: UploadDocument = {
                id: uuidv4(),
                file: new File([objectBlob!], filename, { type: 'application/pdf' }),
                state: DOCUMENT_UPLOAD_STATE.SELECTED,
                progress: 0,
                docType: documentReferenceToRestore.documentSnomedCodeType,
                versionId,
            };

            setUploadDoc([lgDocument]);
        }
    };

    return (
        <ProgressingPage
            documents={uploadDoc}
            setDocuments={setUploadDoc}
            documentConfig={documentConfig}
            journey="restore"
            patientDetails={patientDetails!}
            baseUrl={baseUrl}
            baseHeaders={baseHeaders}
            documentReferenceId={documentReference?.id}
            prepareDocuments={prepareDocuments}
            onInfected={(): void => {
                navigate(routeChildren.DOCUMENT_UPLOAD_INFECTED);
            }}
            onAllFinished={(): void => {
                setTimeout(() => navigate(routeChildren.DOCUMENT_VERSION_RESTORE_COMPLETE), 2000);
            }}
        />
    );
};

export default DocumentVersionRestoreUploadingStage;
