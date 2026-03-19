import { render, screen } from '@testing-library/react';
import HomePage from './HomePage';
import { buildConfig } from '../../helpers/test/testBuilders';
import useConfig from '../../helpers/hooks/useConfig';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import { routes } from '../../types/generic/routes';
import { REPORT_TYPE } from '../../types/generic/reports';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

vi.mock('../../helpers/hooks/useConfig');
vi.mock('../../styles/right-chevron-circle.svg', () => ({
    ReactComponent: (): string => 'svg',
}));
const mockUseConfig = useConfig as Mock;
const mockNavigate = vi.fn();

describe('HomePage', () => {
    beforeEach(() => {
        mockUseConfig.mockReturnValue(buildConfig());
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render home page with patient search and download report when uploadDocumentIteration3Enabled is false', async () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, { uploadDocumentIteration3Enabled: false }),
            );
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

    describe('Admin hub button', () => {
        it('renders admin hub button when feature flag is enabled and user is GP_ADMIN', () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, { uploadDocumentIteration3Enabled: true }),
            );

            render(<HomePage />);

            const adminHubButton = screen.getByTestId('admin-hub-btn') as HTMLAnchorElement;
            expect(adminHubButton).toBeInTheDocument();
            expect(adminHubButton).toHaveTextContent('Admin hub');
        });

        it('does not render admin hub button when feature flag is disabled', () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, { uploadDocumentIteration3Enabled: false }),
            );

            render(<HomePage />);

            expect(screen.queryByTestId('admin-hub-btn')).not.toBeInTheDocument();
        });

        it('should render home page with patient search and admin hub when uploadDocumentIteration3Enabled is true', async () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, { uploadDocumentIteration3Enabled: true }),
            );
            render(<HomePage />);
            const searchPatientButton = screen.getByTestId(
                'search-patient-btn',
            ) as HTMLAnchorElement;
            const adminHubButton = screen.getByTestId('admin-hub-btn') as HTMLAnchorElement;
            expect(searchPatientButton).toBeInTheDocument();
            expect(adminHubButton).toBeInTheDocument();
            expect(adminHubButton).toHaveTextContent('Admin hub');
            expect(adminHubButton).toHaveAttribute('href', '#');
            expect(screen.queryByTestId('download-report-btn')).not.toBeInTheDocument();
        });

        it('does not render admin hub button when feature flag is disabled', () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, { uploadDocumentIteration3Enabled: false }),
            );

            render(<HomePage />);

            expect(screen.queryByTestId('admin-hub-btn')).not.toBeInTheDocument();
        });
    });

    describe('User restrictions bullet point', () => {
        it('does not render user restrictions bullet point when flag is disabled', () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, {
                    uploadDocumentIteration3Enabled: true,
                    userRestrictionEnabled: false,
                }),
            );
            render(<HomePage />);
            expect(
                screen.queryByText('add and manage restrictions on accessing patient records'),
            ).not.toBeInTheDocument();
        });

        it('renders user restrictions bullet point when flag is enabled', () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, {
                    uploadDocumentIteration3Enabled: true,
                    userRestrictionEnabled: true,
                }),
            );
            render(<HomePage />);
            expect(
                screen.getByText('add and manage restrictions on accessing patient records'),
            ).toBeInTheDocument();
        });
    });

    describe('Navigation', () => {
        it('navigates to patient search when search patient button is clicked', async () => {
            render(<HomePage />);

            const searchPatientButton = screen.getByTestId('search-patient-btn');
            await userEvent.click(searchPatientButton);

            expect(mockNavigate).toHaveBeenCalledWith(routes.SEARCH_PATIENT);
        });

        it('navigates to report download when download report button is clicked', async () => {
            render(<HomePage />);

            const downloadReportButton = screen.getByTestId('download-report-btn');
            await userEvent.click(downloadReportButton);

            expect(mockNavigate).toHaveBeenCalledWith(
                `${routes.REPORT_DOWNLOAD}?reportType=${REPORT_TYPE.ODS_PATIENT_SUMMARY}`,
            );
        });

        it('navigates to admin hub when admin hub button is clicked', async () => {
            mockUseConfig.mockReturnValue(
                buildConfig(undefined, { uploadDocumentIteration3Enabled: true }),
            );

            render(<HomePage />);

            const adminHubButton = screen.getByTestId('admin-hub-btn');
            await userEvent.click(adminHubButton);

            expect(mockNavigate).toHaveBeenCalledWith(routes.ADMIN_ROUTE);
        });
    });
});
