import { UploadDocument } from '../../../../types/pages/UploadDocumentsPage/types';
import { JSX, useEffect, useRef, useState } from 'react';
import PdfViewer from '../../../generic/pdfViewer/PdfViewer';
import getMergedPdfBlob from '../../../../helpers/utils/pdfMerger';
import { DOCUMENT_TYPE_CONFIG } from '../../../../helpers/utils/documentType';
import { getJourney } from '../../../../helpers/utils/urlManipulations';

type Props = {
    documents: UploadDocument[];
    setMergedPdfBlob?: (blob: Blob) => void;
    stitchedBlobLoaded?: (value: boolean) => void;
    documentConfig: DOCUMENT_TYPE_CONFIG;
    isReview?: boolean;
    showCurrentlyViewingText?: boolean;
};

const DocumentUploadLloydGeorgePreview = ({
    documents,
    setMergedPdfBlob,
    stitchedBlobLoaded,
    documentConfig,
    isReview = false,
    showCurrentlyViewingText,
}: Props): JSX.Element => {
    const [mergedPdfUrl, setMergedPdfUrl] = useState('');
    const journey = getJourney();

    const runningRef = useRef(false);
    useEffect(() => {
        // If no docs or effect already running, ensure state cleared and exit
        if (!documents || documents.length === 0) {
            if (mergedPdfUrl) {
                setMergedPdfUrl('');
            }
            return;
        }

        if (runningRef.current) return;

        runningRef.current = true;

        const render = async (): Promise<void> => {
            if (stitchedBlobLoaded) {
                stitchedBlobLoaded(false);
            }

            const blob = await getMergedPdfBlob(documents.map((doc) => doc.file));
            if (setMergedPdfBlob) {
                setMergedPdfBlob(blob);
            }

            const url = URL.createObjectURL(blob);
            runningRef.current = false;
            setMergedPdfUrl(url);

            if (stitchedBlobLoaded) {
                stitchedBlobLoaded(true);
            }
        };

        render().catch((err) => {
            runningRef.current = false;
            throw err;
        });
    }, [JSON.stringify(documents)]);

    return (
        <>
            {!isReview && (
                <>
                    <h2>{documentConfig.content.previewUploadTitle}</h2>
                    {documentConfig.stitched ? (
                        <>
                            <p>
                                This shows how the final record will look when combined into a
                                single document.{' '}
                                {journey === 'update' &&
                                    `Any files added will appear after the existing ${documentConfig.displayName}.`}
                            </p>
                            <p>
                                Preview may take longer to load if there are many files or if
                                individual files are large.
                            </p>
                            {showCurrentlyViewingText && (
                                <p>
                                    You are currently viewing the stitched{' '}
                                    {documentConfig.displayName}
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <p>
                                You can preview your PDF files to check they are for the correct
                                patient. If some of your files are not PDFs, you will not see them
                                in this preview.
                            </p>
                            <p>
                                Preview may take longer to load if there are many files or if
                                individual files are large.
                            </p>
                            {showCurrentlyViewingText && (
                                <p>You are currently viewing: {documents[0]?.file.name}</p>
                            )}
                        </>
                    )}
                </>
            )}
            {documents && mergedPdfUrl && (
                <PdfViewer customClasses={['upload-preview']} fileUrl={mergedPdfUrl} />
            )}
            {!documents && <div>No documents to preview</div>}
            {!mergedPdfUrl && <div>No merged PDF available</div>}
        </>
    );
};

export default DocumentUploadLloydGeorgePreview;
