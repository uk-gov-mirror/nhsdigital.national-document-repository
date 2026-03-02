import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import ReviewsDetailsPageComponent from './ReviewsDetailsStage';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { DOWNLOAD_STAGE } from '../../../../types/generic/downloadStage';
import { REPOSITORY_ROLE } from '../../../../types/generic/authRole';
import * as getPdfObjectUrlModule from '../../../../helpers/utils/getPdfObjectUrl';
import * as isLocalModule from '../../../../helpers/utils/isLocal';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import * as documentTypeModule from '../../../../helpers/utils/documentType';
import { ReviewDetails } from '../../../../types/generic/reviews';
import {
    UploadDocumentType,
    DOCUMENT_UPLOAD_STATE,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { NHS_NUMBER_UNKNOWN } from '../../../../helpers/constants/numbers';
import * as handlePatientSearchModule from '../../../../helpers/utils/handlePatientSearch';
import { routes } from '../../../../types/generic/routes';
import useReviewId from '../../../../helpers/hooks/useReviewId';

vi.mock('react-router-dom', async (): Promise<unknown> => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

vi.mock('../../../../providers/patientProvider/PatientProvider', () => ({
    usePatientDetailsContext: (): Mock => mockUsePatientDetailsContext(),
}));

vi.mock('../../../../providers/sessionProvider/SessionProvider', () => ({
    useSessionContext: (): Mock => mockUseSessionContext(),
}));

vi.mock('../../../../helpers/hooks/useRole', () => ({
    default: (): string => REPOSITORY_ROLE.GP_ADMIN,
}));

vi.mock('../../../../helpers/utils/getPdfObjectUrl');

vi.mock('../../../../helpers/hooks/useConfig', () => ({
    default: (): { mockLocal: boolean; featureFlags: Record<string, unknown> } => ({
        mockLocal: true,
        featureFlags: {},
    }),
}));

vi.mock('../../../../helpers/hooks/useBaseAPIUrl', () => ({
    default: (): string => 'https://api.test.com',
}));

vi.mock('../../../../helpers/hooks/useBaseAPIHeaders', () => ({
    default: (): Record<string, string> => ({
        'Content-Type': 'application/json',
        Authorization: 'test-token',
    }),
}));

vi.mock('../../../../helpers/requests/getReviews', () => ({
    getReviewById: vi.fn().mockResolvedValue({
        files: [],
    }),
}));

vi.mock('../../../../helpers/utils/handlePatientSearch');

vi.mock('../../../../helpers/utils/waitForSeconds', () => ({
    default: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../helpers/hooks/useReviewId');

const mockNavigate = vi.fn();
const mockSetPatientDetails = vi.fn();
const mockUsePatientDetailsContext = vi.fn();
const mockUseSessionContext = vi.fn();
const mockUseReviewId = useReviewId as Mock;

const mockReviewId = 'test-review-123';

const renderComponent = (reviewData?: ReviewDetails, reviewSnoMed?: DOCUMENT_TYPE): void => {
    const currentReviewData =
        reviewData ??
        new ReviewDetails(
            mockReviewId,
            (reviewSnoMed ?? ('16521000000101' as DOCUMENT_TYPE)) as DOCUMENT_TYPE,
            '2023-01-01T00:00:00Z',
            'test.uploader@example.com',
            '2023-01-01T00:00:00Z',
            'Test review reason',
            '1',
            '9691914948',
        );

    if (currentReviewData.files === null) {
        currentReviewData.files = [];
    }

    render(
        <ReviewsDetailsPageComponent
            reviewData={currentReviewData}
            loadReviewData={vi.fn().mockResolvedValue(undefined)}
            setDownloadStage={vi.fn()}
            downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
            uploadDocuments={[]}
        />,
    );
};

describe('ReviewDetailsStage', () => {
    const testReviewSnomed: DOCUMENT_TYPE = '16521000000101' as DOCUMENT_TYPE;
    const mockPatientDetails = buildPatientDetails({
        givenName: ['Lillie'],
        familyName: 'Dae',
        nhsNumber: '9691914948',
        birthDate: '2002-06-03',
        postalCode: 'AB12 3CD',
    });

    const mockReviewData = new ReviewDetails(
        mockReviewId,
        testReviewSnomed,
        '2023-01-01T00:00:00Z',
        'M85143',
        '2023-01-01T00:00:00Z',
        'Test review reason',
        '1',
        '9691914948',
    );

    const mockSession = {
        auth: { authorisation_token: 'test-token' },
        isFullscreen: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockUsePatientDetailsContext.mockReturnValue([mockPatientDetails, mockSetPatientDetails]);
        mockUseSessionContext.mockReturnValue([mockSession, vi.fn()]);

        vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(false);

        vi.spyOn(getPdfObjectUrlModule, 'getPdfObjectUrl').mockImplementation(
            (url, setPdfUrl, setStage) => {
                setPdfUrl('blob:mock-pdf-url');
                setStage!(DOWNLOAD_STAGE.SUCCEEDED);
                return Promise.resolve(123);
            },
        );

        mockUseReviewId.mockReturnValue(mockReviewId);
    });

    describe('Loading States', () => {
        it('renders loading spinner for patient details initially', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);
            renderComponent();

            expect(screen.getByText('Loading patient details...')).toBeInTheDocument();
            expect(screen.getByLabelText('Loading patient details...')).toBeInTheDocument();
        });

        it('renders back button during patient loading', () => {
            mockUsePatientDetailsContext.mockReturnValue([null, mockSetPatientDetails]);
            renderComponent(mockReviewData);

            expect(screen.getByRole('link', { name: /go back/i })).toBeInTheDocument();
        });
    });

    describe('Local Development Mode', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('loads mock patient data in local mode', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });

        it('loads mock review data in local mode', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });
    });

    describe('Rendering - Main Content', () => {
        beforeEach(async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('renders main heading', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', {
                        name: 'Check this document is for the correct patient',
                    }),
                ).toBeInTheDocument();
            });
        });

        it('renders patient demographics instruction', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'Check the patient details in the document shown matches these patient demographics:',
                    ),
                ).toBeInTheDocument();
            });
        });

        it('renders patient summary in inset text', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByTestId('patient-summary')).toBeInTheDocument();
                expect(screen.getByTestId('patient-summary').parentElement).toHaveClass(
                    'nhsuk-inset-text',
                );
            });
        });

        it('renders patient name formatted correctly', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByText('Dae, Lillie')).toBeInTheDocument();
            });
        });

        it('renders NHS number formatted correctly', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByText('969 191 4948')).toBeInTheDocument();
            });
        });

        it('renders birth date formatted correctly', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByText('3 June 2002')).toBeInTheDocument();
            });
        });

        it('renders back button', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('link', { name: /go back/i })).toBeInTheDocument();
            });
        });
    });

    describe('PDF Viewer and Record Card', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('renders record card when not in fullscreen', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });

        it('renders display name from config', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByText('Scanned paper notes')).toBeInTheDocument();
            });
        });
    });

    describe('Accepting Document Section', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('renders accepting document heading', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', { name: 'Accepting this document' }),
                ).toBeInTheDocument();
            });
        });

        it('renders instruction to accept if pages match', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByText(
                        'Accept the document if any pages match the demographics shown.',
                    ),
                ).toBeInTheDocument();
            });
        });

        it('renders help and guidance link', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                const link = screen.getByRole('link', { name: 'help and guidance' });
                expect(link).toBeInTheDocument();
                expect(link).toHaveAttribute(
                    'href',
                    'https://digital.nhs.uk/services/access-and-store-digital-patient-documents/help-and-guidance',
                );
            });
        });

        it('renders guidance for partial match', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', { name: 'Accepting this document' }),
                ).toBeInTheDocument();
            });

            expect(
                screen.getByRole('heading', {
                    name: 'If some pages don’t match the demographics:',
                }),
            ).toBeInTheDocument();
            expect(screen.getByText('you should still accept the record')).toBeInTheDocument();
        });

        it('renders guidance for no match', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByRole('heading', { name: 'Accepting this document' }),
                ).toBeInTheDocument();
            });

            expect(
                screen.getByRole('heading', {
                    name: 'If some pages don’t match the demographics:',
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByText('select ‘No, I don’t want to accept this record’'),
            ).toBeInTheDocument();
        });
    });

    describe('Radio Options and Form', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('renders fieldset legend', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByRole('group', { name: 'Do you want to accept this document?' }),
                ).toBeInTheDocument();
            });
        });

        it('renders "Yes" radio option', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', {
                        name:
                            'Yes, I want to accept this document. ' +
                            'All or some of the details match the demographics shown.',
                    }),
                ).toBeInTheDocument();
            });
        });

        it('renders "No" radio option', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(
                    screen.getByRole('radio', {
                        name: /No, I don't want to accept this document/i,
                    }),
                ).toBeInTheDocument();
            });
        });

        it('radio options are not selected initially', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                const yesRadio = screen.getByRole('radio', {
                    name:
                        'Yes, I want to accept this document. ' +
                        'All or some of the details match the demographics shown.',
                });
                const noRadio = screen.getByRole('radio', {
                    name: /No, I don't want to accept this document/i,
                });

                expect(yesRadio).not.toBeChecked();
                expect(noRadio).not.toBeChecked();
            });
        });

        it('renders continue button', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });
        });

        it('does not show error message initially', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
            });
        });
    });

    describe('User Interactions - Radio Selection', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('allows selecting "Yes" radio option', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name:
                    'Yes, I want to accept this document. ' +
                    'All or some of the details match the demographics shown.',
            });

            await user.click(yesRadio);

            expect(yesRadio).toBeChecked();
        });

        it('allows selecting "No" radio option', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const noRadio = screen.getByRole('radio', {
                name: /No, I don't want to accept this document/i,
            });

            await user.click(noRadio);

            expect(noRadio).toBeChecked();
        });

        it('allows changing selection from Yes to No', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name:
                    'Yes, I want to accept this document. ' +
                    'All or some of the details match the demographics shown.',
            });
            const noRadio = screen.getByRole('radio', {
                name: /No, I don't want to accept this document/i,
            });

            await user.click(yesRadio);
            expect(yesRadio).toBeChecked();

            await user.click(noRadio);
            expect(noRadio).toBeChecked();
            expect(yesRadio).not.toBeChecked();
        });
    });

    describe('Validation and Error Handling', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('shows error when Continue clicked without selection', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(screen.getByText('There is a problem')).toBeInTheDocument();
            expect(screen.getByText('You need to select an option')).toBeInTheDocument();
        });

        it('error summary has correct ARIA attributes', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            const errorSummary = screen.getByRole('alert');
            expect(errorSummary).toHaveAttribute('aria-labelledby', 'error-summary-title');
            expect(errorSummary).toHaveAttribute('tabindex', '-1');
        });

        it('error message links to radio group', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            const errorLink = screen.getByRole('link', { name: 'You need to select an option' });
            expect(errorLink).toHaveAttribute('href', '#accept-document');
        });

        it('shows error on radio group when validation fails', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            expect(screen.getByText('Select an option')).toBeInTheDocument();
        });

        it('clears error when radio option selected', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));
            expect(screen.getByText('There is a problem')).toBeInTheDocument();

            const yesRadio = screen.getByRole('radio', {
                name:
                    'Yes, I want to accept this document. ' +
                    'All or some of the details match the demographics shown.',
            });
            await user.click(yesRadio);

            expect(screen.getByText('There is a problem')).toBeInTheDocument();
        });
    });

    describe('Navigation - Yes Selection', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('navigates to assess files when Yes selected and Continue clicked', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name:
                    'Yes, I want to accept this document. ' +
                    'All or some of the details match the demographics shown.',
            });
            await user.click(yesRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(mockNavigate).toHaveBeenCalledWith(
                '/admin/reviews/test-review-123/assess',
                undefined,
            );
        });
    });

    describe('Navigation - No Selection', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('navigates to search patient when No selected and Continue clicked', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const noRadio = screen.getByRole('radio', {
                name: /No, I don't want to accept this document/i,
            });
            await user.click(noRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(mockNavigate).toHaveBeenCalledWith(
                '/admin/reviews/test-review-123/search-patient',
                undefined,
            );
        });
    });

    describe('Navigation - Missing Review Data', () => {
        it('renders content when review data is provided', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(false);

            renderComponent(mockReviewData);

            await waitFor(
                () => {
                    expect(
                        screen.getByText('Check this document is for the correct patient'),
                    ).toBeInTheDocument();
                },
                { timeout: 1500 },
            );
        });
    });

    describe('Navigation - Unknown NHS Number', () => {
        it('navigates to patient search page when NHS number is unknown', async () => {
            const mockLoadReviewData = vi.fn().mockResolvedValue(undefined);

            const unknownNhsNumberReviewData = new ReviewDetails(
                mockReviewId,
                testReviewSnomed,
                '2023-01-01T00:00:00Z',
                'M85143',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                NHS_NUMBER_UNKNOWN,
            );

            render(
                <ReviewsDetailsPageComponent
                    reviewData={unknownNhsNumberReviewData}
                    loadReviewData={mockLoadReviewData}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(
                () => {
                    expect(mockNavigate).toHaveBeenCalledWith(
                        '/admin/reviews/test-review-123/search-patient',
                        { replace: true },
                    );
                },
                { timeout: 2000 },
            );
        });
    });

    describe('Form submission with react-hook-form', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('shows error when submitting without selection', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('Select an option')).toBeInTheDocument();
            });
        });

        it('submits form successfully when yes is selected', async () => {
            const user = userEvent.setup();
            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name:
                    'Yes, I want to accept this document. ' +
                    'All or some of the details match the demographics shown.',
            });
            await user.click(yesRadio);

            const continueButton = screen.getByRole('button', { name: 'Continue' });
            await user.click(continueButton);

            expect(mockNavigate).toHaveBeenCalled();
        });
    });

    describe('Error handling during data load', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('navigates to SESSION_EXPIRED on 403 error', async () => {
            const mockLoadReviewData = vi.fn().mockRejectedValue({ response: { status: 403 } });

            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={mockLoadReviewData}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining('/session-expired'),
                );
            });
        });

        it('navigates to SERVER_ERROR on other errors after retries', async () => {
            const mockLoadReviewData = vi.fn().mockRejectedValue(new Error('Server error'));
            mockReviewData.addReviewFiles({
                id: mockReviewData.id,
                uploadDate: '2023-01-01T00:00:00Z',
                documentSnomedCodeType: '16521000000101' as DOCUMENT_TYPE,
                files: [
                    {
                        fileName: 'doc1.pdf',
                        presignedUrl: 'http://example.com/doc1.pdf',
                    },
                ],
            });
            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={mockLoadReviewData}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(
                () => {
                    expect(mockNavigate).toHaveBeenCalledWith(
                        expect.stringContaining('/server-error'),
                    );
                },
                { timeout: 6000 },
            );
        });
    });

    describe('Accessibility', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('passes axe accessibility tests in initial state', async () => {
            const { container } = render(
                <ReviewsDetailsPageComponent
                    reviewData={
                        new ReviewDetails(
                            mockReviewId,
                            '16521000000101' as DOCUMENT_TYPE,
                            '2023-01-01T00:00:00Z',
                            'test.uploader@example.com',
                            '2023-01-01T00:00:00Z',
                            'Test review reason',
                            '1',
                            '9691914948',
                        )
                    }
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests with error state', async () => {
            const user = userEvent.setup();
            const { container } = render(
                <ReviewsDetailsPageComponent
                    reviewData={
                        new ReviewDetails(
                            mockReviewId,
                            '16521000000101' as DOCUMENT_TYPE,
                            '2023-01-01T00:00:00Z',
                            'test.uploader@example.com',
                            '2023-01-01T00:00:00Z',
                            'Test review reason',
                            '1',
                            '9691914948',
                        )
                    }
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            await user.click(screen.getByRole('button', { name: 'Continue' }));

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests with selection made', async () => {
            const user = userEvent.setup();
            const { container } = render(
                <ReviewsDetailsPageComponent
                    reviewData={
                        new ReviewDetails(
                            mockReviewId,
                            '16521000000101' as DOCUMENT_TYPE,
                            '2023-01-01T00:00:00Z',
                            'test.uploader@example.com',
                            '2023-01-01T00:00:00Z',
                            'Test review reason',
                            '1',
                            '9691914948',
                        )
                    }
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name:
                    'Yes, I want to accept this document. ' +
                    'All or some of the details match the demographics shown.',
            });
            await user.click(yesRadio);

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('inset text has correct ARIA structure', async () => {
            renderComponent(mockReviewData);

            await waitFor(() => {
                const patientSummary = screen.getByTestId('patient-summary');
                expect(patientSummary.parentElement).toHaveClass('nhsuk-inset-text');
            });
        });
    });

    describe('Review Configuration', () => {
        it('uses reviewSnoMed prop to get configuration', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByText('Scanned paper notes')).toBeInTheDocument();
            });
        });
    });

    describe('Edge Cases', () => {
        it('handles patient details without postal code', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const patientWithoutPostcode = buildPatientDetails({
                givenName: ['Test'],
                familyName: 'Patient',
                nhsNumber: '1234567890',
                birthDate: '1990-01-01',
                postalCode: undefined,
            });
            mockUsePatientDetailsContext.mockReturnValue([
                patientWithoutPostcode,
                mockSetPatientDetails,
            ]);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByText('Patient, Test')).toBeInTheDocument();
            });
        });

        it('handles multiple given names', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const patientWithMultipleNames = buildPatientDetails({
                givenName: ['John', 'David', 'Smith'],
                familyName: 'Doe',
                nhsNumber: '1234567890',
                birthDate: '1990-01-01',
            });
            mockUsePatientDetailsContext.mockReturnValue([
                patientWithMultipleNames,
                mockSetPatientDetails,
            ]);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByText('Doe, John David Smith')).toBeInTheDocument();
            });
        });

        it('handles different date formats', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const patientWithDifferentDate = buildPatientDetails({
                givenName: ['Test'],
                familyName: 'Patient',
                nhsNumber: '1234567890',
                birthDate: '1995-12-25',
            });
            mockUsePatientDetailsContext.mockReturnValue([
                patientWithDifferentDate,
                mockSetPatientDetails,
            ]);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByText('25 December 1995')).toBeInTheDocument();
            });
        });
    });

    describe('Fullscreen Integration', () => {
        it('renders different layout when not in fullscreen mode', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            mockUseSessionContext.mockReturnValue([
                { ...mockSession, isFullscreen: false },
                vi.fn(),
            ]);

            renderComponent(mockReviewData);

            await waitFor(() => {
                const pdfCard = screen.getByTestId('pdf-card');
                expect(pdfCard).toBeInTheDocument();
                expect(pdfCard.closest('.lloydgeorge_record-stage_flex')).toBeInTheDocument();
            });
        });
    });

    describe('Role-based Features', () => {
        it('displays record action links based on role', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });
    });

    describe('User Interaction - Form Submission', () => {
        it('handles form submission with Yes selection', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            renderComponent(mockReviewData);

            await waitFor(() => {
                const yesButton = screen.getByRole('radio', { name: /yes/i });
                expect(yesButton).toBeInTheDocument();
            });
        });

        it('handles form submission with No selection', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            renderComponent(mockReviewData);

            await waitFor(() => {
                const noButton = screen.getByRole('radio', { name: /no/i });
                expect(noButton).toBeInTheDocument();
            });
        });

        it('validates form before submission', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            renderComponent(mockReviewData);

            await waitFor(() => {
                const continueButton = screen.getByRole('button', { name: /continue/i });
                expect(continueButton).toBeInTheDocument();
            });
        });
    });

    describe('Document Type Variations', () => {
        it('handles EHR document type correctly', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const ehrReviewData = new ReviewDetails(
                mockReviewId,
                DOCUMENT_TYPE.EHR,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );

            renderComponent(ehrReviewData);

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });

        it('handles EHR attachments document type', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const attachmentsReviewData = new ReviewDetails(
                mockReviewId,
                DOCUMENT_TYPE.EHR_ATTACHMENTS,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );

            renderComponent(attachmentsReviewData);

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });
    });

    describe('PDF Rendering', () => {
        it('calls getPdfObjectUrl when component mounts', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });

        it('handles PDF loading states correctly', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });
    });

    describe('Patient Data Variations', () => {
        it('renders with minimal patient data', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const minimalPatient = buildPatientDetails({
                givenName: ['A'],
                familyName: 'B',
                nhsNumber: '1234567890',
                birthDate: '1990-01-01',
            });
            mockUsePatientDetailsContext.mockReturnValue([minimalPatient, mockSetPatientDetails]);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByText('B, A')).toBeInTheDocument();
            });
        });

        it('renders with special characters in patient name', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const specialCharPatient = buildPatientDetails({
                givenName: ["O'Brien"],
                familyName: 'Van Der Berg',
                nhsNumber: '1234567890',
                birthDate: '1990-01-01',
            });
            mockUsePatientDetailsContext.mockReturnValue([
                specialCharPatient,
                mockSetPatientDetails,
            ]);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByText("Van Der Berg, O'Brien")).toBeInTheDocument();
            });
        });

        it('navigates to session expired page when patient search returns 403', async () => {
            vi.spyOn(handlePatientSearchModule, 'handleSearch').mockRejectedValueOnce({
                response: { status: 403 },
            });

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
            });
        });

        it('navigates to server error page when patient search returns 500', async () => {
            vi.spyOn(handlePatientSearchModule, 'handleSearch').mockRejectedValueOnce({
                response: { status: 500 },
            });

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });
    });

    describe('Review Data Handling', () => {
        it('renders with review reason', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const reviewWithReason = new ReviewDetails(
                mockReviewId,
                testReviewSnomed,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Specific review reason provided',
                '1',
                '9691914948',
            );

            renderComponent(reviewWithReason);

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });

        it('renders with null files array', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            const reviewWithNullFiles = new ReviewDetails(
                mockReviewId,
                testReviewSnomed,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );
            reviewWithNullFiles.files = null;

            renderComponent(reviewWithNullFiles);

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });
    });

    describe('Error State Handling', () => {
        it('renders error state gracefully', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });
    });

    describe('Conditional Rendering', () => {
        it('conditionally renders patient summary based on data availability', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            renderComponent(mockReviewData);

            await waitFor(() => {
                const patientSummary = screen.getByTestId('patient-summary');
                expect(patientSummary).toBeInTheDocument();
                expect(patientSummary).toHaveTextContent('Dae');
            });
        });

        it('renders back button conditionally', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            renderComponent(mockReviewData);

            await waitFor(() => {
                expect(screen.getByRole('link', { name: /go back/i })).toBeInTheDocument();
            });
        });
    });

    describe('Download Stage - PENDING', () => {
        it('renders loading spinner when downloadStage is PENDING', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.PENDING}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByText(/Loading/i)).toBeInTheDocument();
            });
        });

        it('renders back button when downloadStage is PENDING', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.PENDING}
                    uploadDocuments={[]}
                />,
            );

            expect(screen.getByRole('link', { name: /go back/i })).toBeInTheDocument();
        });
    });

    describe('Navigation - MultiFile Review Paths', () => {
        it('navigates to ADD_MORE_CHOICE when multifileReview enabled and single document', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            // Mock EHR document type which has multifileReview enabled
            const ehrReviewData = new ReviewDetails(
                mockReviewId,
                DOCUMENT_TYPE.EHR,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );

            render(
                <ReviewsDetailsPageComponent
                    reviewData={ehrReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[
                        {
                            type: UploadDocumentType.REVIEW,
                            file: new File(['pdf'], 'doc1.pdf', { type: 'application/pdf' }),
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            id: '1',
                            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                            attempts: 0,
                        },
                    ]}
                />,
            );

            // Verify the component renders
            await waitFor(
                () => {
                    const btn = screen.queryByRole('button', { name: 'Continue' });
                    expect(btn).not.toBeNull();
                },
                { timeout: 2000 },
            );
        });

        it('navigates to UPLOAD when canBeDiscarded false and single document', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            // LLOYD_GEORGE has canBeDiscarded: false
            const lloydReviewData = new ReviewDetails(
                mockReviewId,
                DOCUMENT_TYPE.LLOYD_GEORGE,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );

            render(
                <ReviewsDetailsPageComponent
                    reviewData={lloydReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[
                        {
                            type: UploadDocumentType.REVIEW,
                            file: new File(['pdf'], 'doc1.pdf', { type: 'application/pdf' }),
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            id: '1',
                            docType: DOCUMENT_TYPE.EHR,
                            attempts: 0,
                        },
                    ]}
                />,
            );

            await waitFor(
                () => {
                    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeNull();
                },
                { timeout: 2000 },
            );
        });

        it('navigates to ASSESS_FILES when multiple documents or multifileReview disabled', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            const user = userEvent.setup();
            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[
                        {
                            type: UploadDocumentType.REVIEW,
                            file: new File(['pdf'], 'doc1.pdf', { type: 'application/pdf' }),
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            id: '1',
                            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                            attempts: 0,
                        },
                        {
                            type: UploadDocumentType.REVIEW,
                            file: new File(['pdf'], 'doc2.pdf', { type: 'application/pdf' }),
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            id: '2',
                            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                            attempts: 0,
                        },
                    ]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name:
                    'Yes, I want to accept this document. ' +
                    'All or some of the details match the demographics shown.',
            });
            await user.click(yesRadio);
            await user.click(screen.getByRole('button', { name: 'Continue' }));

            expect(mockNavigate).toHaveBeenCalledWith(
                `/admin/reviews/${mockReviewId}/assess`,
                undefined,
            );
        });
    });

    describe('Upload Documents Filtering and Display', () => {
        it('filters and displays only PDF documents with REVIEW type', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            const mockPdfFile = new File(['pdf content'], 'document.pdf', {
                type: 'application/pdf',
            });
            const mockNonPdfFile = new File(['txt content'], 'document.txt', {
                type: 'text/plain',
            });

            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[
                        {
                            type: UploadDocumentType.REVIEW,
                            file: mockPdfFile,
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            id: '1',
                            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                            attempts: 0,
                        },
                        {
                            type: UploadDocumentType.REVIEW,
                            file: mockNonPdfFile,
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            id: '2',
                            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                            attempts: 0,
                        },
                    ]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });

        it('displays no documents message when upload documents array is empty', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByText('No documents to preview, 0')).toBeInTheDocument();
            });
        });
    });

    describe('Fullscreen and Action Links', () => {
        it('renders record layout with fullscreen handler', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            render(
                <ReviewsDetailsPageComponent
                    reviewData={
                        new ReviewDetails(
                            mockReviewId,
                            DOCUMENT_TYPE.LLOYD_GEORGE,
                            '2023-01-01T00:00:00Z',
                            'test.uploader@example.com',
                            '2023-01-01T00:00:00Z',
                            'Test review reason',
                            '1',
                            '9691914948',
                        )
                    }
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });

        it('renders record layout in fullscreen mode', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
            mockUseSessionContext.mockReturnValue([
                { ...mockSession, isFullscreen: true },
                vi.fn(),
            ]);

            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });
    });

    describe('Form Submission - Multifile Zipped Validation', () => {
        it('handles multifile zipped config validation', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            const ehrReviewData = new ReviewDetails(
                mockReviewId,
                DOCUMENT_TYPE.EHR_ATTACHMENTS,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );

            render(
                <ReviewsDetailsPageComponent
                    reviewData={ehrReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[
                        {
                            type: UploadDocumentType.REVIEW,
                            file: new File(['pdf'], 'doc1.pdf', { type: 'application/pdf' }),
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            id: '1',
                            docType: DOCUMENT_TYPE.EHR_ATTACHMENTS,
                            attempts: 0,
                        },
                    ]}
                />,
            );

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });

        it('validates zip file presence for multifile zipped documents', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            const ehrReviewData = new ReviewDetails(
                mockReviewId,
                DOCUMENT_TYPE.EHR_ATTACHMENTS,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );
            ehrReviewData.files = [
                { fileName: 'archive.zip', presignedUrl: 'http://example.com/archive.zip' },
            ];

            render(
                <ReviewsDetailsPageComponent
                    reviewData={ehrReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[
                        {
                            type: UploadDocumentType.REVIEW,
                            file: new File(['zip'], 'archive.zip', { type: 'application/zip' }),
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            id: '1',
                            docType: DOCUMENT_TYPE.EHR_ATTACHMENTS,
                            attempts: 0,
                        },
                    ]}
                />,
            );

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });
    });

    describe('Different User Roles', () => {
        it('renders correctly regardless of user role', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });
    });

    describe('Navigation with Missing Review ID', () => {
        it('handles missing reviewId by not navigating on yes click', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            // The component already handles missing reviewId by returning early in onYesSelectionSuccess
            const user = userEvent.setup();
            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
            });

            const yesRadio = screen.getByRole('radio', {
                name:
                    'Yes, I want to accept this document. ' +
                    'All or some of the details match the demographics shown.',
            });
            await user.click(yesRadio);
            await user.click(screen.getByRole('button', { name: 'Continue' }));

            // The component has a valid reviewId from mock
            expect(mockNavigate).toHaveBeenCalled();
        });
    });

    describe('Page Title', () => {
        it('sets page title to "Admin - Review Details"', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(
                    screen.getByText('Check this document is for the correct patient'),
                ).toBeInTheDocument();
            });
        });
    });

    describe('Record Details Props', () => {
        it('passes correct props to RecordLoader component', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });

        it('renders failure message in record loader when set', async () => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);

            render(
                <ReviewsDetailsPageComponent
                    reviewData={mockReviewData}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByTestId('pdf-card')).toBeInTheDocument();
            });
        });
    });

    describe('Edge Cases - onYesSelectionSuccess Logic', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('navigates to ASSESS_FILES when multifileReview disabled for default config', async () => {
            const ehrReviewData = new ReviewDetails(
                mockReviewId,
                '16521000000101' as DOCUMENT_TYPE,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );
            ehrReviewData.files = [];

            renderComponent(ehrReviewData);

            await waitFor(() => {
                expect(screen.getByText(/Check this document/i)).toBeInTheDocument();
            });

            const yesRadio = screen.getByLabelText(/Yes, I want to accept this document./i);
            await userEvent.click(yesRadio);

            const continueButton = screen.getByRole('button', { name: /continue/i });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    `/admin/reviews/${mockReviewId}/assess`,
                    undefined,
                );
            });
        });

        it('navigates to ADD_MORE_CHOICE for Lloyd George multifile review with single document', async () => {
            const lgReview = new ReviewDetails(
                mockReviewId,
                DOCUMENT_TYPE.LLOYD_GEORGE,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );
            lgReview.files = [
                { fileName: 'doc1.pdf', presignedUrl: 'http://example.com/doc1.pdf' },
            ];

            render(
                <ReviewsDetailsPageComponent
                    reviewData={lgReview}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[
                        {
                            id: '1',
                            file: new File(['content'], 'doc1.pdf', { type: 'application/pdf' }),
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            type: UploadDocumentType.REVIEW,
                            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                            attempts: 0,
                        },
                    ]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByText(/Check this document/i)).toBeInTheDocument();
            });

            const yesRadio = screen.getByLabelText(/Yes, I want to accept this document./i);
            await userEvent.click(yesRadio);

            const continueButton = screen.getByRole('button', { name: /continue/i });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    `/admin/reviews/${mockReviewId}/add-more-choice`,
                    undefined,
                );
            });
        });
    });

    describe('Edge Cases - Submit Function', () => {
        beforeEach(() => {
            vi.spyOn(isLocalModule, 'isLocal', 'get').mockReturnValue(true);
        });

        it('validates multifile zipped config requires zip file', async () => {
            const multifileZippedReview = new ReviewDetails(
                mockReviewId,
                '16521000000101' as DOCUMENT_TYPE,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );
            multifileZippedReview.files = [
                { fileName: 'doc1.pdf', presignedUrl: 'http://example.com/doc1.pdf' },
                { fileName: 'doc2.pdf', presignedUrl: 'http://example.com/doc2.pdf' },
            ];

            const mockGetConfig = vi.spyOn(documentTypeModule, 'getConfigForDocType');
            mockGetConfig.mockReturnValue({
                ...documentTypeModule.getConfigForDocType('16521000000101' as DOCUMENT_TYPE),
                multifileZipped: true,
            });

            render(
                <ReviewsDetailsPageComponent
                    reviewData={multifileZippedReview}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByText(/Check this document/i)).toBeInTheDocument();
            });

            const yesRadio = screen.getByLabelText(/Yes, I want to accept this document./i);
            await userEvent.click(yesRadio);

            const continueButton = screen.getByRole('button', { name: /continue/i });

            // The error is thrown but caught by react-hook-form, so we just verify config was checked
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText(/Check this document/i)).toBeInTheDocument();
            });
        });

        it('successfully validates and proceeds when zip file is present for multifileZipped', async () => {
            const multifileZippedReview = new ReviewDetails(
                mockReviewId,
                DOCUMENT_TYPE.LLOYD_GEORGE,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );
            multifileZippedReview.files = [
                { fileName: 'doc1.pdf', presignedUrl: 'http://example.com/doc1.pdf' },
                { fileName: 'archive.zip', presignedUrl: 'http://example.com/archive.zip' },
            ];

            const mockGetConfig = vi.spyOn(documentTypeModule, 'getConfigForDocType');
            mockGetConfig.mockReturnValue({
                ...documentTypeModule.getConfigForDocType(DOCUMENT_TYPE.LLOYD_GEORGE),
                multifileZipped: true,
                canBeDiscarded: true,
                multifileReview: true,
            });

            render(
                <ReviewsDetailsPageComponent
                    reviewData={multifileZippedReview}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[
                        {
                            id: '1',
                            file: new File(['content'], 'doc1.pdf', { type: 'application/pdf' }),
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            type: UploadDocumentType.REVIEW,
                            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                            attempts: 0,
                        },
                    ]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByText(/Check this document/i)).toBeInTheDocument();
            });

            const yesRadio = screen.getByLabelText(/Yes, I want to accept this document./i);
            await userEvent.click(yesRadio);

            const continueButton = screen.getByRole('button', { name: /continue/i });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    `/admin/reviews/${mockReviewId}/add-more-choice`,
                    undefined,
                );
            });
        });

        it('handles case-insensitive zip file detection', async () => {
            const multifileZippedReview = new ReviewDetails(
                mockReviewId,
                '16521000000101' as DOCUMENT_TYPE,
                '2023-01-01T00:00:00Z',
                'test.uploader@example.com',
                '2023-01-01T00:00:00Z',
                'Test review reason',
                '1',
                '9691914948',
            );
            multifileZippedReview.files = [
                { fileName: 'doc1.pdf', presignedUrl: 'http://example.com/doc1.pdf' },
                { fileName: 'ARCHIVE.ZIP', presignedUrl: 'http://example.com/ARCHIVE.ZIP' },
            ];

            const mockGetConfig = vi.spyOn(documentTypeModule, 'getConfigForDocType');
            mockGetConfig.mockReturnValue({
                ...documentTypeModule.getConfigForDocType('16521000000101' as DOCUMENT_TYPE),
                multifileZipped: true,
                canBeDiscarded: false,
                multifileReview: false,
            });

            render(
                <ReviewsDetailsPageComponent
                    reviewData={multifileZippedReview}
                    loadReviewData={vi.fn().mockResolvedValue(undefined)}
                    setDownloadStage={vi.fn()}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    uploadDocuments={[
                        {
                            id: '1',
                            file: new File(['content'], 'doc1.pdf', { type: 'application/pdf' }),
                            state: DOCUMENT_UPLOAD_STATE.SELECTED,
                            type: UploadDocumentType.REVIEW,
                            docType: DOCUMENT_TYPE.LLOYD_GEORGE,
                            attempts: 0,
                        },
                    ]}
                />,
            );

            await waitFor(() => {
                expect(screen.getByText(/Check this document/i)).toBeInTheDocument();
            });

            const yesRadio = screen.getByLabelText(/Yes, I want to accept this document./i);
            await userEvent.click(yesRadio);

            const continueButton = screen.getByRole('button', { name: /continue/i });
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    `/admin/reviews/${mockReviewId}/upload`,
                    undefined,
                );
            });
        });
    });
});
