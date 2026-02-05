import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { MemoryRouter } from 'react-router';
import CookiePolicy from './CookiesPolicy';
import { routeChildren } from '../../../../types/generic/routes';
import { useAnalyticsContext } from '../../../../providers/analyticsProvider/AnalyticsProvider';

const mockNavigate = vi.fn();

vi.mock('../../../../providers/analyticsProvider/AnalyticsProvider');
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

describe('CookiePolicy', () => {
    const mockNHSCookieConsent = {
        getStatistics: vi.fn(),
        setStatistics: vi.fn(),
        getConsented: vi.fn(),
        setConsented: vi.fn(),
    };
    const mockedAwsRum = {
        disable: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        window.NHSCookieConsent = mockNHSCookieConsent;
        vi.mocked(useAnalyticsContext).mockReturnValue([mockedAwsRum as any, vi.fn()]);
    });

    const renderComponent = (): RenderResult => {
        return render(
            <MemoryRouter>
                <CookiePolicy />
            </MemoryRouter>,
        );
    };

    it('renders', () => {
        renderComponent();

        expect(
            screen.getByRole('heading', { name: 'Cookies policy', level: 1 }),
        ).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'What are cookies?' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'How we use cookies' })).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Cookies that make our website work' }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole('heading', { name: 'Cookies that measure website use' }),
        ).toBeInTheDocument();

        expect(screen.getByTestId('yes-radio-button')).toBeInTheDocument();
        expect(screen.getByTestId('no-radio-button')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save my cookie settings' })).toBeInTheDocument();
    });

    it('sets the yes radio button as checked when statistics consent is true', async () => {
        mockNHSCookieConsent.getStatistics.mockReturnValue(true);
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('yes-radio-button')).toBeChecked();
        });
    });

    it('sets the no radio button as checked when statistics consent is false', async () => {
        mockNHSCookieConsent.getStatistics.mockReturnValue(false);
        renderComponent();

        await waitFor(() => {
            expect(screen.getByTestId('no-radio-button')).toBeChecked();
        });
    });

    it('submits the form with yes consent and navigates to updated page', async () => {
        mockNHSCookieConsent.getStatistics.mockReturnValue(false);
        renderComponent();

        const yesRadio = screen.getByTestId('yes-radio-button');
        await userEvent.click(yesRadio);

        const submitButton = screen.getByRole('button', { name: 'Save my cookie settings' });
        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(mockedAwsRum.disable).not.toHaveBeenCalled();
            expect(mockNHSCookieConsent.setStatistics).toHaveBeenCalledWith(true);
            expect(mockNHSCookieConsent.setConsented).toHaveBeenCalledWith(true);
            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.COOKIES_POLICY_UPDATED);
        });
    });

    it('submits the form with no consent and navigates to updated page', async () => {
        mockNHSCookieConsent.getStatistics.mockReturnValue(true);
        renderComponent();

        const noRadio = screen.getByTestId('no-radio-button');
        await userEvent.click(noRadio);

        const submitButton = screen.getByRole('button', { name: 'Save my cookie settings' });
        await userEvent.click(submitButton);

        await waitFor(() => {
            expect(mockedAwsRum.disable).toHaveBeenCalled();
            expect(mockNHSCookieConsent.setStatistics).toHaveBeenCalledWith(false);
            expect(mockNHSCookieConsent.setConsented).toHaveBeenCalledWith(true);
            expect(mockNavigate).toHaveBeenCalledWith(routeChildren.COOKIES_POLICY_UPDATED);
        });
    });
});
