import { render, screen, waitFor } from '@testing-library/react';
import UserPatientRestrictionsListStage from './UserPatientRestrictionsListStage';
import userEvent from '@testing-library/user-event';
import { Mock } from 'vitest';
import { routeChildren, routes } from '../../../../types/generic/routes';
import getUserPatientRestrictions from '../../../../helpers/requests/userPatientRestrictions/getUserPatientRestrictions';
import { buildPatientDetails, buildUserRestrictions } from '../../../../helpers/test/testBuilders';
import { UserPatientRestrictionsSubRoute } from '../../../../types/generic/userPatientRestriction';
import getPatientDetails from '../../../../helpers/requests/getPatientDetails';
import { UIErrorCode } from '../../../../types/generic/errors';
import { UserPatientRestrictionsJourneyState } from '../../../../pages/userPatientRestrictionsPage/useUserPatientRestrictionsPageHook';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        Link: ({
            children,
            onClick,
            'data-testid': dataTestId,
        }: {
            children: React.ReactNode;
            onClick?: () => void;
            'data-testid'?: string;
        }): React.JSX.Element => (
            <div onClick={onClick} data-testid={dataTestId}>
                {children}
            </div>
        ),
    };
});
vi.mock('../../../../helpers/requests/userPatientRestrictions/getUserPatientRestrictions');
vi.mock('../../../../helpers/requests/getPatientDetails');
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');
vi.mock('../../../../providers/patientProvider/PatientProvider', () => ({
    usePatientDetailsContext: (): Mock => mockUsePatientDetailsContext(),
}));

const mockNavigate = vi.fn();
const mockGetUserPatientRestrictions = getUserPatientRestrictions as Mock;
const mockGetPatientDetails = getPatientDetails as Mock;
const mockUsePatientDetailsContext = vi.fn();
const mockSetPatientDetails = vi.fn();

describe('UserPatientRestrictionsListStage', () => {
    const mockPatientDetails = buildPatientDetails();

    beforeEach(() => {
        mockGetUserPatientRestrictions.mockResolvedValue({
            restrictions: buildUserRestrictions(),
        });
        mockUsePatientDetailsContext.mockReturnValue([mockPatientDetails, mockSetPatientDetails]);
        mockGetPatientDetails.mockResolvedValue(mockPatientDetails);
    });

    it('renders correctly', () => {
        renderPage();

        expect(
            screen.getByText('Manage restrictions on access to patient records'),
        ).toBeInTheDocument();
        expect(mockSetJourneyState).toHaveBeenCalledWith(
            UserPatientRestrictionsJourneyState.INITIAL,
        );
    });

    it('should navigate to add restrictions stage when add restriction button is clicked', async () => {
        renderPage();

        const addRestrictionButton = screen.getByRole('button', { name: 'Add a restriction' });
        expect(addRestrictionButton).toBeInTheDocument();

        await userEvent.click(addRestrictionButton);

        expect(mockSetSubRoute).toHaveBeenCalledWith(UserPatientRestrictionsSubRoute.ADD);
        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.USER_PATIENT_RESTRICTIONS_SEARCH_PATIENT,
        );
    });

    it('should navigate to view restrictions stage when view restriction button is clicked', async () => {
        const restrictions = buildUserRestrictions();
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
        });

        renderPage();

        await waitFor(async () => {
            const viewRestrictionButton = screen.getByTestId(
                `view-record-link-${restrictions[0].id}`,
            );
            expect(viewRestrictionButton).toBeInTheDocument();

            await userEvent.click(viewRestrictionButton);
        });

        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.USER_PATIENT_RESTRICTIONS_VERIFY_PATIENT,
        );
    });

    it('should show error message when restrictions fail to load', async () => {
        mockGetUserPatientRestrictions.mockRejectedValueOnce(
            new Error('Failed to load restrictions'),
        );

        renderPage();

        await waitFor(() => {
            expect(screen.getByTestId('failed-to-load-error')).toBeInTheDocument();
        });
    });

    it('should show loading state when restrictions are loading', async () => {
        mockGetUserPatientRestrictions.mockReturnValueOnce(
            new Promise(() => {
                // never resolves to simulate loading state
            }),
        );

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Searching...')).toBeInTheDocument();
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    it('should show no restrictions message when there are no restrictions', async () => {
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions: [],
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('No user patient restrictions found')).toBeInTheDocument();
        });
    });

    it('should show pagination when there are more than 10 restrictions', async () => {
        const restrictions = buildUserRestrictions();
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
            nextPageToken: 'next-page-token',
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Next')).toBeInTheDocument();
        });
    });

    it('should load next page of restrictions when next button is clicked', async () => {
        const restrictions = buildUserRestrictions();
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
            nextPageToken: 'next-page-token',
        });

        renderPage();

        await waitFor(async () => {
            const nextButton = screen.getByTestId('next-page-link');
            expect(nextButton).toBeInTheDocument();
            await userEvent.click(nextButton);
        });

        await waitFor(() => {
            expect(mockGetUserPatientRestrictions).toHaveBeenCalledWith(
                expect.objectContaining({
                    pageToken: 'next-page-token',
                }),
            );
        });
    });

    it('should show previous button when on next page of restrictions', async () => {
        const restrictions = buildUserRestrictions();
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
            nextPageToken: 'next-page-token',
        });

        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Next')).toBeInTheDocument();
        });

        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
            nextPageToken: 'next-page-token-2',
        });

        await waitFor(async () => {
            const nextButton = screen.getByText('Next');
            expect(nextButton).toBeInTheDocument();
            await userEvent.click(nextButton);
        });

        await waitFor(() => {
            expect(screen.getByText('Previous')).toBeInTheDocument();
        });
    });

    it('should load previous page of restrictions when previous button is clicked', async () => {
        const restrictions = buildUserRestrictions();
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
            nextPageToken: 'next-page-token',
        });

        renderPage();

        await waitFor(async () => {
            const nextButton = screen.getByText('Next');
            expect(nextButton).toBeInTheDocument();
            await userEvent.click(nextButton);
        });

        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
            nextPageToken: 'next-page-token-2',
        });

        await waitFor(async () => {
            const previousButton = screen.getByText('Previous');
            expect(previousButton).toBeInTheDocument();
            await userEvent.click(previousButton);
        });

        expect(mockGetUserPatientRestrictions).toHaveBeenCalledWith(
            expect.objectContaining({
                pageToken: undefined, // should go back to first page
            }),
        );
    });

    it('should load selected page of restrictions when pagination buttons are clicked', async () => {
        const restrictions = buildUserRestrictions();
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
            nextPageToken: 'next-page-token',
        });

        renderPage();

        await waitFor(async () => {
            const nextButton = screen.getByText('Next');
            expect(nextButton).toBeInTheDocument();
            await userEvent.click(nextButton);
        });

        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
            nextPageToken: 'next-page-token-2',
        });

        await waitFor(async () => {
            const page1Button = screen.getByRole('link', { name: 'Page 1' });
            expect(page1Button).toBeInTheDocument();
            await userEvent.click(page1Button);
        });

        expect(mockGetUserPatientRestrictions).toHaveBeenCalledWith(
            expect.objectContaining({
                pageToken: undefined, // should load first page
            }),
        );
    });

    it('should send nhsNumber parameter when searching by valid nhs number', async () => {
        renderPage();

        const nhsNumber = '2222222222';
        await userEvent.click(screen.getByTestId('nhs-number-radio-button'));
        await userEvent.type(screen.getByTestId('search-input'), nhsNumber);
        await userEvent.click(screen.getByRole('button', { name: 'Search' }));

        await waitFor(() => {
            expect(mockGetUserPatientRestrictions).toHaveBeenCalledWith(
                expect.objectContaining({
                    nhsNumber,
                    smartcardNumber: undefined,
                }),
            );
        });
    });

    it('should send smartcardNumber parameter when searching by valid smartcard number', async () => {
        renderPage();

        const smartcardNumber = '123456789012';
        await userEvent.click(screen.getByTestId('smartcard-number-radio-button'));
        await userEvent.type(screen.getByTestId('search-input'), smartcardNumber);
        await userEvent.click(screen.getByTestId('search-button'));

        await waitFor(() => {
            expect(mockGetUserPatientRestrictions).toHaveBeenCalledWith(
                expect.objectContaining({
                    nhsNumber: undefined,
                    smartcardNumber,
                }),
            );
        });
    });

    it.each(['123', 'abc', '123456789', '12345678901', '1234567890'])(
        'should show validation error when searching by invalid nhs number: %s',
        async (invalidNhsNumber) => {
            renderPage();

            await userEvent.click(screen.getByTestId('nhs-number-radio-button'));
            await userEvent.type(screen.getByTestId('search-input'), invalidNhsNumber);
            await userEvent.click(screen.getByRole('button', { name: 'Search' }));

            await waitFor(() => {
                expect(
                    screen.getByText('Please enter a valid 10-digit NHS number'),
                ).toBeInTheDocument();
            });
        },
    );

    it.each(['123', 'abc', '123456789', '12345678901', '1234567890', '12345678901a'])(
        'should show validation error when searching by invalid smartcard number: %s',
        async (invalidSmartcardNumber) => {
            renderPage();

            await userEvent.click(screen.getByTestId('smartcard-number-radio-button'));
            await userEvent.type(screen.getByTestId('search-input'), invalidSmartcardNumber);
            await userEvent.click(screen.getByRole('button', { name: 'Search' }));

            await waitFor(() => {
                expect(
                    screen.getByText('Please enter a valid 12-digit NHS smartcard number'),
                ).toBeInTheDocument();
            });
        },
    );

    it('should navigate to error page when viewing restriction for patient you are restricted from viewing', async () => {
        const restrictions = buildUserRestrictions();
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
        });
        mockGetPatientDetails.mockRejectedValueOnce({
            response: {
                data: {
                    err_code: 'SP_4006',
                },
            },
        });

        renderPage();

        await waitFor(async () => {
            const viewRestrictionButton = screen.getByTestId(
                `view-record-link-${restrictions[0].id}`,
            );
            expect(viewRestrictionButton).toBeInTheDocument();
            await userEvent.click(viewRestrictionButton);
        });

        expect(mockNavigate).toHaveBeenCalledWith(
            routes.GENERIC_ERROR + '?errorCode=' + UIErrorCode.PATIENT_ACCESS_RESTRICTED,
        );
    });

    it('should navigate to session expired page when viewing restriction and receiving 403 error', async () => {
        const restrictions = buildUserRestrictions();
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
        });
        mockGetPatientDetails.mockRejectedValueOnce({
            response: {
                status: 403,
            },
        });

        renderPage();

        await waitFor(async () => {
            const viewRestrictionButton = screen.getByTestId(
                `view-record-link-${restrictions[0].id}`,
            );
            expect(viewRestrictionButton).toBeInTheDocument();
            await userEvent.click(viewRestrictionButton);
        });

        expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
    });

    it('should navigate to server error page when viewing restriction and receiving unexpected error', async () => {
        const restrictions = buildUserRestrictions();
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
        });
        mockGetPatientDetails.mockRejectedValueOnce(new Error('Unexpected error'));

        renderPage();

        await waitFor(async () => {
            const viewRestrictionButton = screen.getByTestId(
                `view-record-link-${restrictions[0].id}`,
            );
            expect(viewRestrictionButton).toBeInTheDocument();
            await userEvent.click(viewRestrictionButton);
        });

        expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining(routes.SERVER_ERROR));
    });
});

const mockSetSubRoute = vi.fn();
const mockSetJourneyState = vi.fn();

const renderPage = (): void => {
    render(
        <UserPatientRestrictionsListStage
            setSubRoute={mockSetSubRoute}
            setJourneyState={mockSetJourneyState}
        />,
    );
};
