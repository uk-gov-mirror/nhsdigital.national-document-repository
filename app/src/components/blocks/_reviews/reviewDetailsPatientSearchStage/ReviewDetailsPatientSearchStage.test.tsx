import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import { JSX } from 'react/jsx-runtime';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import getPatientDetails from '../../../../helpers/requests/getPatientDetails';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import * as documentTypeModule from '../../../../helpers/utils/documentType';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { routes } from '../../../../types/generic/routes';
import ReviewDetailsPatientSearchStage, {
    incorrectFormatMessage,
} from './ReviewDetailsPatientSearchStage';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import {
    ReviewUploadDocument,
    DOCUMENT_UPLOAD_STATE,
} from '../../../../types/pages/UploadDocumentsPage/types';

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
const mockUseBaseAPIUrl = vi.fn();
const mockUseBaseAPIHeaders = vi.fn();
const mockUseConfig = vi.fn();
const mockUseSessionContext = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): unknown => mockUseParams(),
        Link: ({ children, to }: { children: React.ReactNode; to: string }): JSX.Element => (
            <a href={to}>{children}</a>
        ),
    };
});

vi.mock('../../../../helpers/hooks/useBaseAPIUrl', () => ({
    default: (): unknown => mockUseBaseAPIUrl(),
}));

vi.mock('../../../../helpers/hooks/useBaseAPIHeaders', () => ({
    default: (): unknown => mockUseBaseAPIHeaders(),
}));

vi.mock('../../../../helpers/hooks/useConfig', () => ({
    default: (): unknown => mockUseConfig(),
}));

vi.mock('../../../../providers/sessionProvider/SessionProvider', () => ({
    useSessionContext: (): unknown => mockUseSessionContext(),
}));

vi.mock(
    '../../_documentManagement/documentUploadLloydGeorgePreview/DocumentUploadLloydGeorgePreview',
    () => ({
        default: (): React.JSX.Element => <div data-testid="lloyd-george-preview">Preview</div>,
    }),
);

let capturedDownloadAction: ((e: React.MouseEvent<HTMLElement>) => void) | null = null;
let anchorClickSpy: ReturnType<typeof vi.spyOn> | null = null;

vi.mock('../../../generic/recordLoader/RecordLoader', () => ({
    RecordLoader: ({
        downloadAction,
    }: {
        downloadAction: (e: React.MouseEvent<HTMLElement>) => void;
    }): React.JSX.Element => {
        capturedDownloadAction = downloadAction;
        return (
            <div data-testid="record-loader">
                <button onClick={downloadAction} data-testid="download-button">
                    Download
                </button>
            </div>
        );
    },
}));

vi.mock('../../../../helpers/requests/getPatientDetails');
const mockGetPatientDetails = getPatientDetails as Mock;

describe('ReviewDetailsPatientSearchPage', () => {
    const mockReviewId = 'review-123';
    const mockBaseUrl = 'https://api.example.com';
    const mockBaseHeaders = { Authorization: 'Bearer token' };

    const mockReviewData = {} as ReviewDetails;
    const mockSession = {
        auth: { authorisation_token: 'test-token' },
        isFullscreen: false,
    };

    beforeEach(() => {
        mockUseSessionContext.mockReturnValue([mockSession, vi.fn()]);
        const mockGetConfig = vi.spyOn(documentTypeModule, 'getConfigForDocType');
        mockGetConfig.mockReturnValue({
            ...documentTypeModule.getConfigForDocType('16521000000101' as DOCUMENT_TYPE),
            multifileZipped: true,
        });
        mockUseParams.mockReturnValue({ reviewId: mockReviewId });
        mockUseBaseAPIUrl.mockReturnValue(mockBaseUrl);
        mockUseBaseAPIHeaders.mockReturnValue(mockBaseHeaders);
        mockUseConfig.mockReturnValue({
            mockLocal: { patientIsActive: true, patientIsDeceased: false },
            featureFlags: {},
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders page heading', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Search for the correct patient' }),
            ).toBeInTheDocument();
        });

        it('renders descriptive text', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(
                screen.getByText(
                    'Enter the NHS number to find the correct patient demographics for this document.',
                ),
            ).toBeInTheDocument();
        });

        it('renders NHS number input field', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(screen.getByTestId('nhs-number-input')).toBeInTheDocument();
            expect(screen.getByLabelText(/A 10-digit number/)).toBeInTheDocument();
        });

        it('renders continue button', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(screen.getByTestId('continue-button')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
        });

        it('renders back button', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(screen.getByRole('link', { name: /back/i })).toBeInTheDocument();
        });

        it('renders link to unknown NHS number page', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const link = screen.getByRole('link', { name: "I don't know the NHS number" });

            await waitFor(() => {
                expect(link).toBeInTheDocument();
            });
        });

        it('does not show error box initially', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
        });
    });

    describe('Form Validation', () => {
        it('shows error when submitting empty form', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const continueButton = screen.getByTestId('continue-button');
            await userEvent.click(continueButton);

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('displays incorrectFormatMessage in both ErrorBox and TextInput on validation failure', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            const continueButton = screen.getByTestId('continue-button');

            // Submit with invalid NHS number
            await userEvent.type(input, '12345');
            await userEvent.click(continueButton);

            await waitFor(() => {
                // Check that incorrectFormatMessage appears twice (ErrorBox + TextInput)
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages).toHaveLength(2);
            });
        });

        it('shows error for invalid NHS number format', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '123');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('accepts 10-digit NHS number without spaces', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockGetPatientDetails).toHaveBeenCalled();
            });
        });

        it('accepts NHS number with spaces (XXX XXX XXXX)', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '900 000 0009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockGetPatientDetails).toHaveBeenCalled();
            });
        });

        it('accepts NHS number with hyphens (XXX-XXX-XXXX)', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '900-000-0009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockGetPatientDetails).toHaveBeenCalled();
            });
        });

        it('rejects NHS number with letters', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '900000000A');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('rejects NHS number with 9 digits', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '900000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('rejects NHS number with 11 digits', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '90000000099');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Successful Search', () => {
        it('calls getPatientDetails with cleaned NHS number', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '900-000-0009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockGetPatientDetails).toHaveBeenCalledWith({
                    nhsNumber: '9000000009',
                    baseUrl: mockBaseUrl,
                    baseHeaders: mockBaseHeaders,
                });
            });
        });

        it('shows spinner during search', async () => {
            mockGetPatientDetails.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 1000)),
            );

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            expect(screen.getByText('Searching...')).toBeInTheDocument();
            expect(screen.queryByTestId('continue-button')).not.toBeInTheDocument();
        });

        it('disables input during search', async () => {
            mockGetPatientDetails.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 1000)),
            );

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            expect(input).toHaveAttribute('readonly');
        });

        it('navigates to patient verify page on success', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalled();
                const callArgs = mockNavigate.mock.calls[0];
                expect(callArgs[0]).toBe(
                    `/reviews/${mockReviewId}/dont-know-nhs-number/patient/verify`,
                );
            });
        });

        it('clears error state on successful submission', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.clear(input);
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalled();
            });
        });
    });

    describe('Error Handling', () => {
        it('shows error message for 400 Bad Request', async () => {
            const error = {
                response: { status: 400 },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
                const errorMessages = screen.getAllByText('Enter a valid patient NHS number.');
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('navigates to session expired page for 403 Forbidden', async () => {
            const error = {
                response: { status: 403 },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
            });
        });

        it('shows patient not found message for 404', async () => {
            const error = {
                response: {
                    status: 404,
                    data: { err_code: 'PATIENT_NOT_FOUND' },
                },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
            });
        });

        it('shows service error for 500 Internal Server Error', async () => {
            const error = {
                response: { status: 500 },
                message: 'Server error',
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });

        it('shows service error for network error without status', async () => {
            const error = {
                message: 'Network error',
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });

        it('error box links to NHS number input', async () => {
            const error = {
                response: { status: 400 },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorLinks = screen.getAllByText('Enter a valid patient NHS number.');
                const linkWithHref = errorLinks.find((el) => el.closest('a')?.hasAttribute('href'));
                expect(linkWithHref?.closest('a')).toHaveAttribute('href', '#nhs-number-input');
            });
        });
    });

    describe('Input Features', () => {
        it('has autocomplete disabled', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            expect(input).toHaveAttribute('autocomplete', 'off');
        });

        it('has correct input width class', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            expect(input).toHaveClass('nhsuk-input--width-10');
        });

        it('has text input type', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            expect(input).toHaveAttribute('type', 'text');
        });
    });

    describe('Props', () => {
        it('accepts reviewData prop', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('redirects to admin review page when reviewData is null', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={null}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('/reviews'));
        });

        it('renders empty fragment when reviewData is null', () => {
            const { container } = render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={null}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('Download Action', () => {
        beforeEach(() => {
            capturedDownloadAction = null;
            global.URL.createObjectURL = vi.fn(() => 'blob:mock-url-123');
            global.URL.revokeObjectURL = vi.fn();
            anchorClickSpy = vi
                .spyOn(HTMLAnchorElement.prototype, 'click')
                .mockImplementation(() => {});
        });

        afterEach(() => {
            anchorClickSpy?.mockRestore();
            anchorClickSpy = null;
            vi.clearAllMocks();
        });

        it('download action is provided to RecordLoader', () => {
            const reviewDataWithFiles = {
                ...mockReviewData,
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
                addReviewFiles: vi.fn(),
            } as any as ReviewDetails;

            const mockUploadDocuments = [
                {
                    file: new File(['content'], 'test.pdf', { type: 'application/pdf' }),
                    blob: new Blob(['content'], { type: 'application/pdf' }),
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    id: '1',
                    docType: '16521000000101' as DOCUMENT_TYPE,
                },
            ] as ReviewUploadDocument[];

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={mockUploadDocuments}
                    reviewData={reviewDataWithFiles}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(capturedDownloadAction).not.toBeNull();
            expect(typeof capturedDownloadAction).toBe('function');
        });

        it('triggers URL.createObjectURL for multiple file blobs when download is clicked', async () => {
            const reviewDataWithFiles = {
                ...mockReviewData,
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
                addReviewFiles: vi.fn(),
            } as any as ReviewDetails;

            const mockBlob1 = new Blob(['content1'], { type: 'application/pdf' });
            const mockBlob2 = new Blob(['content2'], { type: 'application/pdf' });
            const mockUploadDocuments = [
                {
                    file: new File(['content1'], 'test1.pdf', { type: 'application/pdf' }),
                    blob: mockBlob1,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    id: '1',
                    docType: '16521000000101' as DOCUMENT_TYPE,
                },
                {
                    file: new File(['content2'], 'test2.pdf', { type: 'application/pdf' }),
                    blob: mockBlob2,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    id: '2',
                    docType: '16521000000101' as DOCUMENT_TYPE,
                },
            ] as ReviewUploadDocument[];

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={mockUploadDocuments}
                    reviewData={reviewDataWithFiles}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            if (capturedDownloadAction) {
                const mockEvent = { preventDefault: vi.fn() } as any;
                capturedDownloadAction(mockEvent);

                expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);
                expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob1);
                expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob2);
            }
        });

        it('triggers URL.createObjectURL for single file', async () => {
            const reviewDataWithSingleFile = {
                ...mockReviewData,
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
                addReviewFiles: vi.fn(),
            } as any as ReviewDetails;

            const mockBlob = new Blob(['content'], { type: 'application/pdf' });
            const mockUploadDocuments = [
                {
                    file: new File(['content'], 'single-file.pdf', { type: 'application/pdf' }),
                    blob: mockBlob,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    id: '1',
                    docType: '16521000000101' as DOCUMENT_TYPE,
                },
            ] as ReviewUploadDocument[];

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={mockUploadDocuments}
                    reviewData={reviewDataWithSingleFile}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            if (capturedDownloadAction) {
                const mockEvent = { preventDefault: vi.fn() } as any;
                capturedDownloadAction(mockEvent);

                expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
            }
        });

        it('handles download with no files gracefully', async () => {
            const reviewDataWithoutFiles = {
                ...mockReviewData,
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
                addReviewFiles: vi.fn(),
            } as any as ReviewDetails;

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={reviewDataWithoutFiles}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            if (capturedDownloadAction) {
                const mockEvent = { preventDefault: vi.fn() } as any;
                capturedDownloadAction(mockEvent);

                expect(global.URL.createObjectURL).not.toHaveBeenCalled();
            }
        });

        it('handles download when files is null', async () => {
            const reviewDataWithNullFiles = {
                ...mockReviewData,
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
                addReviewFiles: vi.fn(),
            } as any as ReviewDetails;

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={null as any}
                    reviewData={reviewDataWithNullFiles}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            if (capturedDownloadAction) {
                const mockEvent = { preventDefault: vi.fn() } as any;
                capturedDownloadAction(mockEvent);

                expect(global.URL.createObjectURL).not.toHaveBeenCalled();
            }
        });

        it('prevents default event behavior', () => {
            const reviewDataWithFiles = {
                ...mockReviewData,
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
                addReviewFiles: vi.fn(),
            } as any as ReviewDetails;

            const mockUploadDocuments = [
                {
                    file: new File(['content'], 'test.pdf', { type: 'application/pdf' }),
                    blob: new Blob(['content'], { type: 'application/pdf' }),
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    id: '1',
                    docType: '16521000000101' as DOCUMENT_TYPE,
                },
            ] as ReviewUploadDocument[];

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={mockUploadDocuments}
                    reviewData={reviewDataWithFiles}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(capturedDownloadAction).not.toBeNull();

            if (capturedDownloadAction) {
                const mockEvent = {
                    preventDefault: vi.fn(),
                } as unknown as React.MouseEvent<HTMLElement>;

                capturedDownloadAction(mockEvent);

                expect(mockEvent.preventDefault).toHaveBeenCalled();
            }
        });
    });

    describe('File Filtering', () => {
        it('renders with mixed PDF and non-PDF files', () => {
            const mockPdfFile1 = new File(['pdf1'], 'document1.pdf', {
                type: 'application/pdf',
            });
            const mockPdfFile2 = new File(['pdf2'], 'document2.pdf', {
                type: 'application/pdf',
            });
            const mockNonPdfFile = new File(['txt'], 'document.txt', { type: 'text/plain' });

            const uploadDocs = [
                {
                    file: mockPdfFile1,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    id: '1',
                    docType: '16521000000101' as DOCUMENT_TYPE,
                },
                {
                    file: mockPdfFile2,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    id: '2',
                    docType: '16521000000101' as DOCUMENT_TYPE,
                },
                {
                    file: mockNonPdfFile,
                    state: DOCUMENT_UPLOAD_STATE.SELECTED,
                    id: '3',
                    docType: '16521000000101' as DOCUMENT_TYPE,
                },
            ] as ReviewUploadDocument[];

            const reviewDataWithLastUpdated = {
                ...mockReviewData,
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
            } as ReviewDetails;

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={uploadDocs}
                    reviewData={reviewDataWithLastUpdated}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Search for the correct patient' }),
            ).toBeInTheDocument();
        });

        it('handles empty uploadDocuments array', () => {
            const reviewDataWithLastUpdated = {
                ...mockReviewData,
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
            } as ReviewDetails;

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={reviewDataWithLastUpdated}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Search for the correct patient' }),
            ).toBeInTheDocument();
        });

        it('handles undefined uploadDocuments', () => {
            const reviewDataWithLastUpdated = {
                ...mockReviewData,
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
            } as ReviewDetails;

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={undefined as any}
                    reviewData={reviewDataWithLastUpdated}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Search for the correct patient' }),
            ).toBeInTheDocument();
        });
    });

    describe('Callback Functions', () => {
        it('calls setNewPatientDetails when patient search succeeds', async () => {
            const mockSetNewPatientDetails = vi.fn();
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={mockSetNewPatientDetails}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockSetNewPatientDetails).toHaveBeenCalledWith(mockPatient);
            });
        });

        it('does not call setNewPatientDetails on search failure', async () => {
            const mockSetNewPatientDetails = vi.fn();
            const error = {
                response: { status: 404, data: { err_code: 'PATIENT_NOT_FOUND' } },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={mockSetNewPatientDetails}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
            });

            expect(mockSetNewPatientDetails).not.toHaveBeenCalled();
        });
    });

    describe('RecordLoader Props', () => {
        it('renders with single file in non-multifile review', () => {
            const mockGetConfig = vi.spyOn(documentTypeModule, 'getConfigForDocType');
            mockGetConfig.mockReturnValue({
                ...documentTypeModule.getConfigForDocType('16521000000101' as DOCUMENT_TYPE),
                multifileReview: false,
            });

            const reviewDataWithSingleFile = {
                ...mockReviewData,
                files: [{ fileName: 'single-file.pdf', blob: new Blob(['content']) }],
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
            } as ReviewDetails;

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={reviewDataWithSingleFile}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Search for the correct patient' }),
            ).toBeInTheDocument();
        });

        it('renders with multiple files in multifile review', () => {
            const mockGetConfig = vi.spyOn(documentTypeModule, 'getConfigForDocType');
            mockGetConfig.mockReturnValue({
                ...documentTypeModule.getConfigForDocType('16521000000101' as DOCUMENT_TYPE),
                multifileReview: true,
            });

            const reviewDataWithMultipleFiles = {
                ...mockReviewData,
                files: [
                    { fileName: 'file1.pdf', blob: new Blob(['content1']) },
                    { fileName: 'file2.pdf', blob: new Blob(['content2']) },
                ],
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
            } as ReviewDetails;

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={reviewDataWithMultipleFiles}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Search for the correct patient' }),
            ).toBeInTheDocument();
        });

        it('renders when no files present', () => {
            const reviewDataNoFiles = {
                ...mockReviewData,
                files: undefined,
                lastUpdated: '2024-01-01T10:00:00Z',
                snomedCode: '16521000000101',
                addReviewFiles: vi.fn(),
            } as any as ReviewDetails;

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={reviewDataNoFiles}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Search for the correct patient' }),
            ).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('passes axe tests in initial state', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('passes axe tests with validation error', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(async () => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
                const results = await runAxeTest(document.body);
                expect(results).toHaveNoViolations();
            });
        });

        it('passes axe tests with API error', async () => {
            const error = {
                response: { status: 400 },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    uploadDocuments={[]}
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(async () => {
                const errorMessages = screen.getAllByText('Enter a valid patient NHS number.');
                expect(errorMessages.length).toBeGreaterThan(0);
                const results = await runAxeTest(document.body);
                expect(results).toHaveNoViolations();
            });
        });
    });
});
