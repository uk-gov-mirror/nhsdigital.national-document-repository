import { Link, useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { Button, Table } from 'nhsuk-react-components';
import {
    extractPdfBlobUsingSelectedPages,
    getUniquePageNumbersFromRanges,
} from '../../../../helpers/utils/documentManagement/pageNumbers';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import PdfViewer from '../../../generic/pdfViewer/PdfViewer';
import Spinner from '../../../generic/spinner/Spinner';
import PdfjsViewerElement from 'pdfjs-viewer-element';
import { downloadFile } from '../../../../helpers/utils/downloadFile';

type Props = {
    documentReference: DocumentReference;
    baseDocumentBlob: Blob | null;
    pagesToRemove: number[][];
    reassignedPagesBlob: Blob | null;
    setReassignedPagesBlob: Dispatch<SetStateAction<Blob | null>>;
};

const DocumentRemovePagesConfirmStage = ({
    documentReference,
    baseDocumentBlob,
    pagesToRemove,
    reassignedPagesBlob,
    setReassignedPagesBlob,
}: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const loadingRef = useRef(false);
    const hasLoadedBlob = useRef(false);
    const [documentConfig] = useState(
        getConfigForDocType(documentReference.documentSnomedCodeType),
    );
    const pdfViewerRef = useRef<PdfjsViewerElement | null>(null);

    const pageTitle = 'Check the pages you have selected to remove';
    useTitle({ pageTitle });

    useEffect(() => {
        if (!baseDocumentBlob) {
            loadingRef.current = true;
            return;
        }

        loadingRef.current = false;

        const generateRemovedPagesBlob = async (): Promise<void> => {
            try {
                const blob = await extractPdfBlobUsingSelectedPages(
                    baseDocumentBlob,
                    pagesToRemove,
                    true,
                );
                setReassignedPagesBlob(blob);
                loadingRef.current = false;
                hasLoadedBlob.current = true;
            } catch {
                navigate(routes.SERVER_ERROR);
            }
        };

        if (!loadingRef.current && !hasLoadedBlob.current) {
            loadingRef.current = true;
            generateRemovedPagesBlob();
        }
    }, []);

    const downloadRemovedPages = (e: React.MouseEvent<HTMLAnchorElement>): void => {
        e.preventDefault();

        downloadFile(reassignedPagesBlob!, 'removed_pages.pdf');
    };

    const viewPageClicked = (e: React.MouseEvent<HTMLAnchorElement>, pageRange: number[]): void => {
        e.preventDefault();
        if (!pdfViewerRef.current) {
            return;
        }

        const uniquePageNumbers = getUniquePageNumbersFromRanges(pagesToRemove);
        const pageIndex = uniquePageNumbers.indexOf(pageRange[0]);

        const page = pdfViewerRef.current.iframe?.contentWindow?.document.querySelector(
            `.page[data-page-number="${pageIndex + 1}"]`,
        );

        page?.scrollIntoView({ behavior: 'instant' });
        pdfViewerRef.current.scrollIntoView({ behavior: 'smooth' });
    };

    if (!baseDocumentBlob) {
        return <></>;
    }

    return (
        <>
            <BackButton />

            {reassignedPagesBlob ? (
                <>
                    <h1>{pageTitle}</h1>

                    <PatientSummary>
                        <PatientSummary.Child item={PatientInfo.FULL_NAME} />
                        <PatientSummary.Child item={PatientInfo.NHS_NUMBER} />
                        <PatientSummary.Child item={PatientInfo.BIRTH_DATE} />
                    </PatientSummary>

                    <p>
                        You can match these pages to the correct patient next. If you want to keep a
                        copy first, you can{' '}
                        <Link
                            to={''}
                            onClick={downloadRemovedPages}
                            data-testid="download-removed-pages-link"
                        >
                            download these pages
                        </Link>
                        .
                    </p>

                    <Table>
                        <Table.Head>
                            <Table.Row>
                                <Table.Cell>Page number</Table.Cell>
                                <Table.Cell className="text-right">View pages</Table.Cell>
                            </Table.Row>
                        </Table.Head>
                        <Table.Body>
                            {pagesToRemove.map((pageNumberRange) => (
                                <Table.Row key={pageNumberRange.join('-')}>
                                    <Table.Cell>
                                        Page {pageNumberRange[0]}
                                        {pageNumberRange.length > 1 &&
                                            `-${pageNumberRange.at(-1)!}`}
                                    </Table.Cell>
                                    <Table.Cell className="text-right">
                                        <Link
                                            to={''}
                                            onClick={(e): void =>
                                                viewPageClicked(e, pageNumberRange)
                                            }
                                        >
                                            View
                                        </Link>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>

                    <h3>{documentConfig?.content.chosenToRemovePagesSubtitle}</h3>
                    <PdfViewer
                        customClasses={['my-8']}
                        fileUrl={URL.createObjectURL(reassignedPagesBlob)}
                        viewerRef={pdfViewerRef}
                    />

                    <Button
                        data-testid="continue-button"
                        onClick={(): void => {
                            navigate(routeChildren.DOCUMENT_REASSIGN_SEARCH_PATIENT);
                        }}
                    >
                        Continue to match these pages to the correct patient
                    </Button>
                </>
            ) : (
                <Spinner status="Loading..." />
            )}
        </>
    );
};

export default DocumentRemovePagesConfirmStage;
