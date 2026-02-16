import { render, screen, waitFor } from '@testing-library/react';
import ServerErrorPage from './ServerErrorPage';
import userEvent from '@testing-library/user-event';
import { unixTimestamp } from '../../helpers/utils/createTimestamp';
import { runAxeTest } from '../../helpers/test/axeTestHelper';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import { routes } from '../../types/generic/routes';

const mockedUseNavigate = vi.fn();
const mockSearchParamsGet = vi.fn();

Date.now = (): number => new Date('2020-01-01T00:00:00.000Z').getTime();

vi.mock('react-router-dom', () => ({
    useSearchParams: (): [{ get: Mock }] => [{ get: mockSearchParamsGet }],
    useNavigate: (): Mock => mockedUseNavigate,
    useLocation: (): Mock => vi.fn(),
}));

describe('ServerErrorPage', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
    });
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders page content with default error message when there are no url params', () => {
            const mockInteractionId = unixTimestamp();
            render(<ServerErrorPage />);

            expect(
                screen.getByRole('heading', {
                    name: 'Sorry, there is a problem with the service',
                }),
            ).toBeInTheDocument();
            expect(screen.getByText('There was an unexplained error')).toBeInTheDocument();
            expect(
                screen.getByText(
                    "Try again by returning to the home page. You'll need to enter any information you submitted again.",
                ),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', {
                    name: 'Go to home',
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('heading', {
                    name: 'If this error keeps appearing',
                }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('link', {
                    name: 'Contact the NHS National Service Desk - this link will open in a new tab',
                }),
            ).toBeInTheDocument();
            expect(screen.getByText(mockInteractionId)).toBeInTheDocument();
        });

        it('renders page content with error message and id when there is a valid error code with interaction id', () => {
            const mockErrorCode = 'CDR_5001';
            const mockInteractionId = '000-000';
            const mockEncoded = btoa(JSON.stringify([mockErrorCode, mockInteractionId]));
            mockSearchParamsGet.mockReturnValue(mockEncoded);
            render(<ServerErrorPage />);

            expect(
                screen.getByRole('heading', {
                    name: 'Sorry, there is a problem with the service',
                }),
            ).toBeInTheDocument();
            expect(screen.getByText('There was an unexplained error')).toBeInTheDocument();
            expect(screen.getByText(mockInteractionId)).toBeInTheDocument();
        });

        it('renders page content with non-default error message and id when there is a valid error code with interaction id', () => {
            const mockErrorCode = 'CDR_5002';
            const mockInteractionId = '000-000';
            const mockEncoded = btoa(JSON.stringify([mockErrorCode, mockInteractionId]));
            mockSearchParamsGet.mockReturnValue(mockEncoded);
            render(<ServerErrorPage />);

            expect(
                screen.getByRole('heading', {
                    name: 'Sorry, there is a problem with the service',
                }),
            ).toBeInTheDocument();
            expect(screen.getByText('There is a technical issue on our side')).toBeInTheDocument();
            expect(screen.queryByText('There was an unexplained error')).not.toBeInTheDocument();
            expect(screen.getByText(mockInteractionId)).toBeInTheDocument();
        });

        it('renders page content with default error message and id when there is an invalid error code', () => {
            const mockErrorCode = 'XXX';
            const mockInteractionId = '000-000';
            const mockEncoded = btoa(JSON.stringify([mockErrorCode, mockInteractionId]));
            mockSearchParamsGet.mockReturnValue(mockEncoded);
            render(<ServerErrorPage />);

            expect(
                screen.getByRole('heading', {
                    name: 'Sorry, there is a problem with the service',
                }),
            ).toBeInTheDocument();
            expect(screen.getByText('There was an unexplained error')).toBeInTheDocument();
            expect(screen.getByText(mockInteractionId)).toBeInTheDocument();
            expect(screen.queryByText(mockErrorCode)).not.toBeInTheDocument();
        });

        it('pass accessibility checks', async () => {
            const mockEncoded = btoa(JSON.stringify(['mockErrorCode', 'mockInteractionid']));
            mockSearchParamsGet.mockReturnValue(mockEncoded);

            render(<ServerErrorPage />);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });

    describe('Navigation', () => {
        it('navigates user to previous two pages when return home is clicked', async () => {
            const mockErrorCode = 'XXX';
            const mockInteractionId = '000-000';
            const mockEncoded = btoa(JSON.stringify([mockErrorCode, mockInteractionId]));
            mockSearchParamsGet.mockReturnValue(mockEncoded);

            render(<ServerErrorPage />);
            const homeButtonLink = screen.getByRole('button', {
                name: 'Go to home',
            });
            expect(homeButtonLink).toBeInTheDocument();
            await userEvent.click(homeButtonLink);

            await waitFor(() => {
                expect(mockedUseNavigate).toHaveBeenCalledWith(routes.HOME);
            });
        });
    });
});
