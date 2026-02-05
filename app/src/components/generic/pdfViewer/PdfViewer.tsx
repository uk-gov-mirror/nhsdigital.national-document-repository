import { useEffect, useRef } from 'react';
import PdfjsViewerElement from 'pdfjs-viewer-element';
import { useAnalyticsContext } from '../../../providers/analyticsProvider/AnalyticsProvider';

type Props = {
    fileUrl: string;
    customClasses?: string[];
    customStyleSheet?: string;
};

const PdfViewer = ({ fileUrl, customClasses, customStyleSheet }: Props): React.JSX.Element => {
    const intervalRef = useRef<number>(null);
    const pdfViewerRef = useRef<PdfjsViewerElement>(null);
    const [awsRum] = useAnalyticsContext();

    useEffect(() => {
        if (intervalRef.current) return;

        intervalRef.current = window.setInterval(() => {
            if (pdfViewerRef.current) {
                const printButton =
                    pdfViewerRef.current.iframe?.contentWindow?.document?.getElementById(
                        'printButton',
                    );
                if (printButton) {
                    window.clearInterval(intervalRef.current!);

                    printButton.addEventListener('click', sendPrintEvent.bind(this));
                }
            }
        }, 200);
    }, []);

    const sendPrintEvent = (): void => {
        if (awsRum) {
            awsRum.recordEvent('print_pdf_button_clicked', {
                timestamp: new Date().toISOString(),
            });
        }
    };

    return (
        <pdfjs-viewer-element
            ref={pdfViewerRef}
            id="pdf-viewer"
            data-testid="pdf-viewer"
            src={fileUrl}
            title="Embedded PDF Viewer"
            viewer-path="/pdfjs"
            viewer-extra-styles={customStyleSheet}
            viewer-extra-styles-urls="['/pdf-viewer.css']"
            className={customClasses?.join(' ')}
        ></pdfjs-viewer-element>
    );
};

export default PdfViewer;
