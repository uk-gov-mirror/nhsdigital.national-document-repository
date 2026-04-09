import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JSX } from 'react';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import usePatient from '../../../../helpers/hooks/usePatient';
import { buildPatientDetails, buildSearchResult } from '../../../../helpers/test/testBuilders';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import { routeChildren, routes } from '../../../../types/generic/routes';
import DocumentVersionRestoreCompleteStage from './DocumentVersionRestoreCompleteStage';
import { DocumentReference } from '../../../../types/pages/documentSearchResultsPage/types';

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useLocation: (): unknown => mockUseLocation(),
        Link: ({ children, to, ...props }: any): JSX.Element => (
            <a href={to} {...props}>
                {children}
            </a>
        ),
    };
});

vi.mock('../../../../helpers/hooks/usePatient');
vi.mock('../../../../helpers/hooks/useTitle');

const mockUsePatient = usePatient as Mock;

const mockPatient = buildPatientDetails();
const mockDocRef = {
    ...buildSearchResult({
        documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
        id: 'doc-ref-123',
        version: '2',
    }),
    url: 'https://test-url',
    isPdf: true,
};

const renderApp = (mockDocRef?: DocumentReference | null): RenderResult =>
    render(
        <DocumentVersionRestoreCompleteStage
            resetState={vi.fn()}
            documentReference={mockDocRef!}
        />,
    );

describe('DocumentVersionRestoreCompleteStage', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockUsePatient.mockReturnValue(mockPatient);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders the green confirmation panel with correct title', () => {
        renderApp(mockDocRef);

        expect(screen.getByTestId('restore-complete-panel')).toBeInTheDocument();
        expect(screen.getByTestId('page-title')).toHaveTextContent('Version restored');
    });

    it('displays patient name', () => {
        renderApp(mockDocRef);

        expect(screen.getByTestId('patient-name')).toBeInTheDocument();
    });

    it('displays NHS number', () => {
        renderApp(mockDocRef);

        expect(screen.getByTestId('nhs-number')).toBeInTheDocument();
    });

    it('displays date of birth', () => {
        renderApp(mockDocRef);

        expect(screen.getByTestId('dob')).toBeInTheDocument();
    });

    it('displays the restored version description', () => {
        renderApp(mockDocRef);

        expect(screen.getByTestId('restore-version-description')).toBeInTheDocument();
        expect(screen.getByText(/scanned paper notes V3/i)).toBeInTheDocument();
    });

    it('renders What happens next section', () => {
        renderApp(mockDocRef);

        expect(screen.getByRole('heading', { name: /what happens next/i })).toBeInTheDocument();
    });

    it('renders go to version history link', () => {
        renderApp(mockDocRef);

        const link = screen.getByTestId('version-history-link');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', routeChildren.DOCUMENT_VERSION_HISTORY);
    });

    it('navigates to patient documents when Go to Lloyd George records is clicked', async () => {
        renderApp(mockDocRef);

        await userEvent.click(screen.getByTestId('go-to-records-button'));

        expect(mockNavigate).toHaveBeenCalledWith(routes.PATIENT_DOCUMENTS);
    });

    it('navigates to home when patient details are not available', () => {
        mockUsePatient.mockReturnValue(undefined);

        renderApp(mockDocRef);

        expect(mockNavigate).toHaveBeenCalledWith(routes.HOME);
    });
});
