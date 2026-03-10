import { Link, useNavigate } from 'react-router-dom';
import useTitle from '../../../../helpers/hooks/useTitle';
import BackButton from '../../../generic/backButton/BackButton';
import PatientSummary, { PatientInfo } from '../../../generic/patientSummary/PatientSummary';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { useEffect, useRef, useState } from 'react';
import { getDocument } from 'pdfjs-dist';
import { Button, Table } from 'nhsuk-react-components';
import { parsePageNumbersToIndices } from '../../../../helpers/utils/documentMangement/pageNumbers';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';
import { getConfigForDocType } from '../../../../helpers/utils/documentType';
import PdfViewer from '../../../generic/pdfViewer/PdfViewer';
import Spinner from '../../../generic/spinner/Spinner';
import PdfjsViewerElement from 'pdfjs-viewer-element';
import { downloadFile } from '../../../../helpers/utils/downloadFile';

type Props = {
    documentReference: DocumentReference;
    baseDocumentBlob: Blob | null;
    pagesToRemove: string[];
};

const DocumentRemovePagesConfirmStage = ({
    documentReference,
    baseDocumentBlob,
    pagesToRemove,
}: Props): React.JSX.Element => {
    const navigate = useNavigate();
    const loadingRef = useRef(false);
    const [removedPagesBlob, setRemovedPagesBlob] = useState<Blob | null>(null);
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
                const buffer1 = await baseDocumentBlob.arrayBuffer();
                const buffer2 = await baseDocumentBlob.arrayBuffer();
                const pdf = await getDocument(buffer1).promise;
                const result = await pdf.extractPages([
                    {
                        document: new Uint8Array(buffer2),
                        includePages: parsePageNumbersToIndices(pagesToRemove),
                    },
                ]);
                setRemovedPagesBlob(
                    new Blob([result.buffer as ArrayBuffer], { type: 'application/pdf' }),
                );
                loadingRef.current = false;
            } catch {
                navigate(routes.SERVER_ERROR);
            }
        };

        if (!loadingRef.current && !removedPagesBlob) {
            loadingRef.current = true;
            generateRemovedPagesBlob();
        }
    }, []);

    const downloadRemovedPages = (e: React.MouseEvent<HTMLAnchorElement>): void => {
        e.preventDefault();

        downloadFile(removedPagesBlob!, 'removed_pages.pdf');
    };

    const viewPageClicked = (
        e: React.MouseEvent<HTMLAnchorElement>,
        pageNumberString: string,
    ): void => {
        e.preventDefault();
        if (!pdfViewerRef.current) {
            return;
        }

        pageNumberString = pageNumberString.includes('-')
            ? pageNumberString.split('-')[0]
            : pageNumberString;

        const parsedPageIndeces = parsePageNumbersToIndices(pagesToRemove);
        const pageIndex = parsedPageIndeces.indexOf(Number(pageNumberString.trim()) - 1);

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

            {removedPagesBlob ? (
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
                            {pagesToRemove.map((pageNumber) => (
                                <Table.Row key={pageNumber}>
                                    <Table.Cell>Page {pageNumber}</Table.Cell>
                                    <Table.Cell className="text-right">
                                        <Link
                                            to={''}
                                            onClick={(e): void => viewPageClicked(e, pageNumber)}
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
                        fileUrl={URL.createObjectURL(removedPagesBlob)}
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
