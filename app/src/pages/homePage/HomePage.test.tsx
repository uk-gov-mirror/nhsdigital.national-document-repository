import { render, screen } from '@testing-library/react';
import HomePage from './HomePage';
import { buildConfig } from '../../helpers/test/testBuilders';
import useConfig from '../../helpers/hooks/useConfig';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { routes } from '../../types/generic/routes';

const mockedUseNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useNavigate: (): typeof mockedUseNavigate => mockedUseNavigate,
    };
});

vi.mock('../../helpers/hooks/useConfig');
vi.mock('../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: (): string => 'svg',
}));
const mockUseConfig = useConfig as Mock;

describe('HomePage', () => {
    beforeEach(() => {
        mockUseConfig.mockReturnValue(buildConfig());
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render home page with patient search and download report', async () => {
            render(<HomePage />);

            const searchPatientButton = screen.getByTestId(
                'search-patient-btn',
            ) as HTMLAnchorElement;
            const downloadReportButton = screen.getByTestId(
                'download-report-btn',
            ) as HTMLAnchorElement;
            expect(searchPatientButton).toBeInTheDocument();
            expect(downloadReportButton).toBeInTheDocument();
        });
    });

    describe('Admin Console button', () => {
        it('renders admin console button when feature flag is enabled', () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, { uploadDocumentIteration3Enabled: true }),
            );

            render(<HomePage />);

            const adminConsoleButton = screen.getByTestId('admin-console-btn') as HTMLAnchorElement;
            expect(adminConsoleButton).toBeInTheDocument();
            expect(adminConsoleButton).toHaveTextContent('Admin console');
            expect(adminConsoleButton).toHaveAttribute('href', routes.ADMIN_ROUTE);
        });

        it('does not render admin console button when feature flag is disabled', () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, { uploadDocumentIteration3Enabled: false }),
            );

            render(<HomePage />);

            expect(screen.queryByTestId('admin-console-btn')).not.toBeInTheDocument();
        });
    });

    describe('Admin Console button', () => {
        it('renders admin console button when feature flag is enabled and user is GP_ADMIN', () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, { uploadDocumentIteration3Enabled: true }),
            );

            render(<HomePage />);

            const adminConsoleButton = screen.getByTestId('admin-console-btn') as HTMLAnchorElement;
            expect(adminConsoleButton).toBeInTheDocument();
            expect(adminConsoleButton).toHaveTextContent('Admin console');
            expect(adminConsoleButton).toHaveAttribute('href', routes.ADMIN_ROUTE);
        });

        it('does not render admin console button when feature flag is disabled', () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, { uploadDocumentIteration3Enabled: false }),
            );

            render(<HomePage />);

            expect(screen.queryByTestId('admin-console-btn')).not.toBeInTheDocument();
        });
    });
});
