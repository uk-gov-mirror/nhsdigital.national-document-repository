import { buildPatientDetails } from '../../helpers/test/testBuilders';
import { render, screen } from '@testing-library/react';
import { runAxeTest } from '../../helpers/test/axeTestHelper';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import DownloadCompletePage from './DownloadCompletePage';
import userEvent from '@testing-library/user-event';
import { routes } from '../../types/generic/routes';
import usePatient from '../../helpers/hooks/usePatient';

vi.mock('../../helpers/hooks/usePatient');

const mockedUseNavigate = vi.fn();
const mockUsePatient = usePatient as Mock;

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockedUseNavigate,
}));

describe('DownloadCompletePage', () => {
    const mockPatient = buildPatientDetails();

    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockUsePatient.mockReturnValue(mockPatient);
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders the download complete screen', () => {
        render(<DownloadCompletePage />);

        expect(screen.getByTestId('page-title')).toBeInTheDocument();
        expect(
            screen.getByText(`Patient name: ${mockPatient.familyName}, ${mockPatient.givenName}`),
        ).toBeInTheDocument();
        expect(screen.getByText('Your responsibilities with this record')).toBeInTheDocument();
        expect(
            screen.getByText('Follow the Record Management Code of Practice'),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', {
                name: 'Go to home',
            }),
        ).toBeInTheDocument();
    });

    it('navigates to the home screen when go to home is clicked', async () => {
        render(<DownloadCompletePage />);

        await userEvent.click(screen.getByRole('button', {name: 'Go to home'}));

        expect(mockedUseNavigate).toHaveBeenCalledWith(routes.HOME);
    });

    it('navigates to the home screen if patient details are undefined', async () => {
        mockUsePatient.mockReturnValue(undefined);
        render(<DownloadCompletePage />);

        expect(mockedUseNavigate).toHaveBeenCalledWith(routes.HOME);
    });

    describe('Accessibility', () => {
        it('passes accessibility checks', async () => {
            render(<DownloadCompletePage />);
            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });
});
