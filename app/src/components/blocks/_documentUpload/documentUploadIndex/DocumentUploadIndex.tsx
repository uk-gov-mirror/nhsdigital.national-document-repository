import documentTypesConfig from '../../../../config/documentTypesConfig.json';
import { Card } from 'nhsuk-react-components';
import { ReactComponent as RightCircleIcon } from '../../../../styles/right-chevron-circle.svg';
import getDocument, { GetDocumentResponse } from '../../../../helpers/requests/getDocument';
import getDocumentSearchResults from '../../../../helpers/requests/getDocumentSearchResults';
import { Dispatch, SetStateAction, useState } from 'react';
import { DOCUMENT_TYPE, getConfigForDocType } from '../../../../helpers/utils/documentType';
import { JourneyType } from '../../../../helpers/utils/urlManipulations';
import { ExistingDocument } from '../../../../types/pages/UploadDocumentsPage/types';
import { createSearchParams, NavigateOptions, To, useNavigate } from 'react-router-dom';
import usePatient from '../../../../helpers/hooks/usePatient';
import useBaseAPIUrl from '../../../../helpers/hooks/useBaseAPIUrl';
import useBaseAPIHeaders from '../../../../helpers/hooks/useBaseAPIHeaders';
import { routeChildren, routes } from '../../../../types/generic/routes';
import axios, { AxiosError } from 'axios';
import { isMock } from '../../../../helpers/utils/isLocal';
import PatientSummary from '../../../generic/patientSummary/PatientSummary';
import Spinner from '../../../generic/spinner/Spinner';

type DocumentUploadIndexProps = {
    setDocumentType: Dispatch<SetStateAction<DOCUMENT_TYPE>>;
    setJourney: Dispatch<SetStateAction<JourneyType>>;
    updateExistingDocuments: (existingDocuments: ExistingDocument[]) => void;
};

const DocumentUploadIndex = ({
    setDocumentType,
    setJourney,
    updateExistingDocuments,
}: DocumentUploadIndexProps): React.JSX.Element => {
    const navigate = useNavigate();
    const patientDetails = usePatient();
    const baseUrl = useBaseAPIUrl();
    const baseHeaders = useBaseAPIHeaders();
    const [loadingNext, setLoadingNext] = useState(false);

    const documentTypeSelected = async (documentType: DOCUMENT_TYPE): Promise<void> => {
        const config = getConfigForDocType(documentType);

        if (!patientDetails?.nhsNumber) {
            navigate(routes.SERVER_ERROR);
            return;
        }

        if (config.singleDocumentOnly && patientDetails.canManageRecord) {
            await handleSingleDocumentOnlyTypeSelected(documentType);
            setDocumentType(documentType);
            return;
        }

        setDocumentType(documentType);
        navigate(routeChildren.DOCUMENT_UPLOAD_SELECT_FILES);
    };

    const loadDocument = async (documentId: string): Promise<GetDocumentResponse> => {
        const documentResponse = await getDocument({
            nhsNumber: patientDetails!.nhsNumber,
            baseUrl,
            baseHeaders,
            documentId,
        });

        return documentResponse;
    };

    const handleSingleDocumentOnlyTypeSelected = async (docType: DOCUMENT_TYPE): Promise<void> => {
        const handleSuccess = (existingDocument: ExistingDocument): void => {
            const to: To = {
                pathname: routeChildren.DOCUMENT_UPLOAD_SELECT_FILES,
                search: createSearchParams({ journey: 'update' }).toString(),
            };
            const options: NavigateOptions = {
                state: {
                    journey: 'update',
                    existingDocuments: [existingDocument],
                },
            };

            setLoadingNext(false);
            setJourney('update');
            updateExistingDocuments([existingDocument]);
            navigate(to, options);
        };

        try {
            setLoadingNext(true);

            const searchResults = await getDocumentSearchResults({
                nhsNumber: patientDetails!.nhsNumber,
                baseUrl: baseUrl,
                baseHeaders: baseHeaders,
                docType,
            });

            if (searchResults.length === 0) {
                navigate(routeChildren.DOCUMENT_UPLOAD_SELECT_FILES);
                return;
            }

            const getDocumentResponse = await loadDocument(searchResults[0].id);

            const existingDoc: ExistingDocument = {
                fileName: searchResults[0].fileName,
                documentId: searchResults[0].id,
                versionId: searchResults[0].version,
                docType,
                blob: null,
            };

            const response = await fetch(getDocumentResponse.url);
            existingDoc.blob = await response.blob();

            handleSuccess(existingDoc);
        } catch (e) {
            const error = e as AxiosError;

            if (isMock(error)) {
                const { data } = await axios.get('/dev/testFile.pdf', {
                    responseType: 'blob',
                });
                handleSuccess({
                    fileName: 'testFile.pdf',
                    documentId: 'mock-document-id',
                    versionId: '1',
                    docType,
                    blob: data,
                });
            } else if (error.response?.status === 403) {
                navigate(routes.SESSION_EXPIRED);
            } else {
                navigate(routes.SERVER_ERROR + `?message=${encodeURIComponent(error.message)}`);
            }
        }
    };

    return (
        <>
            <h1 data-testid="page-title">Choose a document type to upload</h1>

            <PatientSummary oneLine />

            {loadingNext ? (
                <Spinner status="Loading existing document..." />
            ) : (
                <Card.Group>
                    {documentTypesConfig
                        .filter((doc) => doc.canUploadIndependently)
                        .map((documentConfig) => (
                            <Card.GroupItem width="one-half" key={documentConfig.snomed_code}>
                                <Card clickable cardType="primary">
                                    <Card.Content>
                                        <Card.Heading className="nhsuk-heading-m">
                                            <Card.Link
                                                data-testid={`upload-${documentConfig.snomed_code}-link`}
                                                onClick={async (): Promise<void> =>
                                                    documentTypeSelected(
                                                        documentConfig.snomed_code as DOCUMENT_TYPE,
                                                    )
                                                }
                                            >
                                                {documentConfig.content.upload_title}
                                            </Card.Link>
                                        </Card.Heading>
                                        <Card.Description>
                                            {documentConfig.content.upload_description}
                                        </Card.Description>
                                        <RightCircleIcon />
                                    </Card.Content>
                                </Card>
                            </Card.GroupItem>
                        ))}
                </Card.Group>
            )}
        </>
    );
};

export default DocumentUploadIndex;
