import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { routes } from '../../types/generic/routes';
import MockLoginPage from './MockLoginPage';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';

const mockedUseNavigate = vi.fn();
const mockGetSearchParam = vi.fn();

vi.mock('react-router-dom', async () => ({
    ...(await vi.importActual('react-router-dom')),
    useNavigate: (): Mock => mockedUseNavigate,
    useSearchParams: (): [{ get: Mock }, Mock] => [{ get: mockGetSearchParam }, vi.fn()],
}));

const MOCK_STATE = 'mock-state-value';
const MOCK_KEY = 'test-secret-key';
const MOCK_ODS_CODE = 'Y12345';
const MOCK_SMARTCARD_ID = '123456789012';

describe('<MockLoginPage />', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockGetSearchParam.mockReturnValue(MOCK_STATE);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders all form fields and the submit button', () => {
            renderPage();

            expect(screen.getByLabelText('Key')).toBeInTheDocument();
            expect(screen.getByLabelText('ODS Code')).toBeInTheDocument();
            expect(
                screen.getByLabelText('Smartcard ID (optional 12-digit id)'),
            ).toBeInTheDocument();
            expect(screen.getByLabelText('Select Repository role')).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'GP Admin' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'GP Clinical' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'PCSE' })).toBeInTheDocument();
            expect(screen.getByRole('option', { name: 'No Role' })).toBeInTheDocument();
            expect(screen.getByRole('combobox')).toHaveValue('gp_admin');
            expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
        });
    });

    describe('User interactions', () => {
        it('updates each field as the user types and changes role selection', async () => {
            renderPage();

            await userEvent.type(screen.getByLabelText('Key'), MOCK_KEY);
            await userEvent.type(screen.getByLabelText('ODS Code'), MOCK_ODS_CODE);
            await userEvent.type(
                screen.getByLabelText('Smartcard ID (optional 12-digit id)'),
                MOCK_SMARTCARD_ID,
            );
            await userEvent.selectOptions(screen.getByRole('combobox'), 'pcse');

            expect(screen.getByLabelText('Key')).toHaveValue(MOCK_KEY);
            expect(screen.getByLabelText('ODS Code')).toHaveValue(MOCK_ODS_CODE);
            expect(screen.getByLabelText('Smartcard ID (optional 12-digit id)')).toHaveValue(
                MOCK_SMARTCARD_ID,
            );
            expect(screen.getByRole('combobox')).toHaveValue('pcse');
        });
    });

    describe('Form submission', () => {
        it('navigates to AUTH_CALLBACK with all encoded form data and state on submit', async () => {
            renderPage();

            await fillAndSubmit({ smartcardId: MOCK_SMARTCARD_ID });

            expect(mockedUseNavigate).toHaveBeenCalledOnce();

            const navigatedTo: string = mockedUseNavigate.mock.calls[0][0];
            expect(navigatedTo).toContain(routes.AUTH_CALLBACK);
            expect(navigatedTo).toContain(`state=${MOCK_STATE}`);

            const codeParam = new URL(`http://localhost${navigatedTo}`).searchParams.get('code');
            const decoded = JSON.parse(decodeURIComponent(codeParam!));
            expect(decoded.key).toBe(MOCK_KEY);
            expect(decoded.odsCode).toBe(MOCK_ODS_CODE);
            expect(decoded.repositoryRole).toBe('gp_admin');
            expect(decoded.smartcardId).toBe(MOCK_SMARTCARD_ID);
        });

        it('encodes an empty smartcard ID when none is provided', async () => {
            renderPage();

            await fillAndSubmit();

            const navigatedTo: string = mockedUseNavigate.mock.calls[0][0];
            const codeParam = new URL(`http://localhost${navigatedTo}`).searchParams.get('code');
            const decoded = JSON.parse(decodeURIComponent(codeParam!));
            expect(decoded.smartcardId).toBe('');
        });
    });
});

const renderPage = (): void => {
    render(<MockLoginPage />);
};

const fillAndSubmit = async (
    overrides: Partial<{
        key: string;
        odsCode: string;
        smartcardId: string;
        repositoryRole: string;
    }> = {},
): Promise<void> => {
    const { key = MOCK_KEY, odsCode = MOCK_ODS_CODE, smartcardId = '', repositoryRole } = overrides;

    await userEvent.type(screen.getByLabelText('Key'), key);
    await userEvent.type(screen.getByLabelText('ODS Code'), odsCode);

    if (smartcardId) {
        await userEvent.type(
            screen.getByLabelText('Smartcard ID (optional 12-digit id)'),
            smartcardId,
        );
    }

    if (repositoryRole) {
        await userEvent.selectOptions(screen.getByRole('combobox'), repositoryRole);
    }

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
};
