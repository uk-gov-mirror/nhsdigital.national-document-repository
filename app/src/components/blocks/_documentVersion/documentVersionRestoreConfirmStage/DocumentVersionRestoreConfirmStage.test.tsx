import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import DocumentVersionRestoreConfirmStage from './DocumentVersionRestoreConfirmStage';
import { buildSearchResult } from '../../../../helpers/test/testBuilders';
import { routeChildren, routes } from '../../../../types/generic/routes';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useLocation: (): unknown => mockUseLocation(),
    };
});

vi.mock('../../../../helpers/hooks/useTitle');

const mockDocRef = {
    ...buildSearchResult({
        documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
        id: 'doc-ref-123',
        version: '2',
    }),
    url: 'https://test-url',
    isPdf: true,
};

const renderPage = (): RenderResult =>
    render(<DocumentVersionRestoreConfirmStage documentReferenceToRestore={mockDocRef} />);

describe('DocumentVersionRestoreConfirmStage', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockUseLocation.mockReturnValue({
            state: { documentReference: mockDocRef },
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('page rendering', () => {
        it('renders the confirmation heading', () => {
            renderPage();

            expect(
                screen.getByRole('heading', {
                    name: /are you sure you want to restore this version/i,
                }),
            ).toBeInTheDocument();
        });

        it('renders the explanatory text', () => {
            renderPage();

            expect(
                screen.getByText(/if you restore, this will be the version you see/i),
            ).toBeInTheDocument();
        });

        it('renders the help and guidance link with correct href', () => {
            renderPage();

            const link = screen.getByTestId('help-and-guidance-link');
            expect(link).toHaveAttribute(
                'href',
                'https://digital.nhs.uk/services/access-and-store-digital-patient-documents/help-and-guidance',
            );
            expect(link).toHaveAttribute('target', '_blank');
        });

        it('renders the version label', () => {
            renderPage();

            expect(screen.getByText(/scanned paper notes: version 2/i)).toBeInTheDocument();
        });

        it('renders Yes and No radio buttons', () => {
            renderPage();

            expect(screen.getByTestId('yes-radio-btn')).toBeInTheDocument();
            expect(screen.getByTestId('no-radio-btn')).toBeInTheDocument();
        });

        it('renders the Continue button', () => {
            renderPage();

            expect(screen.getByTestId('continue-button')).toBeInTheDocument();
        });

        it('renders the Go back link', () => {
            renderPage();

            expect(screen.getByTestId('go-back-link')).toBeInTheDocument();
        });
    });

    describe('validation', () => {
        it('shows error summary when Continue clicked without selecting a radio', async () => {
            renderPage();

            await userEvent.click(screen.getByTestId('continue-button'));

            expect(screen.getByTestId('error-summary')).toBeInTheDocument();
            expect(
                screen.getAllByText('Select whether you want to restore this version').length,
            ).toBeGreaterThanOrEqual(1);
        });

        it('clears error when a radio is selected after an error', async () => {
            renderPage();

            await userEvent.click(screen.getByTestId('continue-button'));
            expect(screen.getByTestId('error-summary')).toBeInTheDocument();

            await userEvent.click(screen.getByTestId('yes-radio-btn'));

            expect(screen.queryByTestId('error-summary')).not.toBeInTheDocument();
        });
    });

    describe('No selected', () => {
        it('navigates back when No is selected and Continue is clicked', async () => {
            renderPage();

            await userEvent.click(screen.getByTestId('no-radio-btn'));
            await userEvent.click(screen.getByTestId('continue-button'));

            expect(mockNavigate).toHaveBeenCalledWith(-1);
        });
    });

    describe('Yes selected', () => {
        it('navigates to the uploading page with document reference in state', async () => {
            renderPage();

            await userEvent.click(screen.getByTestId('yes-radio-btn'));
            await userEvent.click(screen.getByTestId('continue-button'));

            expect(mockNavigate).toHaveBeenCalledWith(
                routeChildren.DOCUMENT_VERSION_RESTORE_UPLOADING,
                {
                    state: { documentReference: mockDocRef },
                },
            );
        });
    });

    describe('back navigation', () => {
        it('navigates back when Go back link is clicked', async () => {
            renderPage();

            await userEvent.click(screen.getByTestId('go-back-link'));

            expect(mockNavigate).toHaveBeenCalledWith(-1);
        });
    });

    describe('no document reference', () => {
        it('navigates to patient documents when no document reference', () => {
            mockUseLocation.mockReturnValue({ state: null });
            render(<DocumentVersionRestoreConfirmStage documentReferenceToRestore={null} />);

            expect(mockNavigate).toHaveBeenCalledWith(routes.PATIENT_DOCUMENTS);
        });
    });
});
