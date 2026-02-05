import { render, screen, act } from '@testing-library/react';
import PdfViewer from './PdfViewer';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useAnalyticsContext } from '../../../providers/analyticsProvider/AnalyticsProvider';

const mockRecordEvent = vi.fn();

vi.mock('../../../providers/analyticsProvider/AnalyticsProvider');

describe('PdfViewer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.mocked(useAnalyticsContext).mockReturnValue([null, vi.fn()]);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders an iframe element', () => {
        const fileUrl = 'https://test';

        render(<PdfViewer fileUrl={fileUrl} />);

        const pdfjsViewer = screen.getByTestId('pdf-viewer');

        expect(pdfjsViewer).toBeInTheDocument();
    });

    it('records custom event when print button is clicked and awsRum is available', async () => {
        vi.mocked(useAnalyticsContext).mockReturnValue([
            {
                recordEvent: mockRecordEvent,
            } as any,
            vi.fn(),
        ]);

        const fileUrl = 'https://test';
        render(<PdfViewer fileUrl={fileUrl} />);

        const mockPrintButton = document.createElement('button');
        mockPrintButton.id = 'printButton';

        const mockIframeDocument = {
            getElementById: vi.fn().mockReturnValue(mockPrintButton),
        };

        const mockPdfViewerElement = document.getElementById('pdf-viewer');
        if (mockPdfViewerElement) {
            (mockPdfViewerElement as any).iframe = {
                contentWindow: {
                    document: mockIframeDocument,
                },
            };
        }

        await act(async () => {
            vi.advanceTimersByTime(200);
        });

        mockPrintButton.click();

        expect(mockRecordEvent).toHaveBeenCalledWith('print_pdf_button_clicked', {
            timestamp: expect.any(String),
        });
    });

    it('does not record event when print button is clicked but awsRum is null', async () => {
        vi.mocked(useAnalyticsContext).mockReturnValue([null, vi.fn()]);

        const fileUrl = 'https://test';
        render(<PdfViewer fileUrl={fileUrl} />);

        const mockPrintButton = document.createElement('button');
        mockPrintButton.id = 'printButton';

        const mockIframeDocument = {
            getElementById: vi.fn().mockReturnValue(mockPrintButton),
        };

        const mockPdfViewerElement = document.getElementById('pdf-viewer');
        if (mockPdfViewerElement) {
            (mockPdfViewerElement as any).iframe = {
                contentWindow: {
                    document: mockIframeDocument,
                },
            };
        }

        await act(async () => {
            vi.advanceTimersByTime(200);
        });

        mockPrintButton.click();

        expect(mockRecordEvent).not.toHaveBeenCalled();
    });
});
