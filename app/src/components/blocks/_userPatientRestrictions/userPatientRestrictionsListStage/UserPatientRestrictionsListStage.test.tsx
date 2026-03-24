import { render, screen, waitFor } from '@testing-library/react';
import UserPatientRestrictionsListStage from './UserPatientRestrictionsListStage';
import userEvent from '@testing-library/user-event';
import { Mock } from 'vitest';
import { routeChildren } from '../../../../types/generic/routes';
import getUserPatientRestrictions from '../../../../helpers/requests/userPatientRestrictions/getUserPatientRestrictions';
import { buildUserRestrictions } from '../../../../helpers/test/testBuilders';

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
vi.mock('../../../../helpers/hooks/useBaseAPIHeaders');
vi.mock('../../../../helpers/hooks/useBaseAPIUrl');

const mockNavigate = vi.fn();
const mockGetUserPatientRestrictions = getUserPatientRestrictions as Mock;

describe('UserPatientRestrictionsListStage', () => {
    beforeEach(() => {
        mockGetUserPatientRestrictions.mockResolvedValue({
            restrictions: buildUserRestrictions(),
        });
    });

    it('renders correctly', () => {
        render(<UserPatientRestrictionsListStage />);

        expect(
            screen.getByText('Manage restrictions on access to patient records'),
        ).toBeInTheDocument();
    });

    it('should navigate to add restrictions stage when add restriction button is clicked', async () => {
        render(<UserPatientRestrictionsListStage />);

        const addRestrictionButton = screen.getByRole('button', { name: 'Add a restriction' });
        expect(addRestrictionButton).toBeInTheDocument();

        await userEvent.click(addRestrictionButton);

        expect(mockNavigate).toHaveBeenCalledWith(routeChildren.USER_PATIENT_RESTRICTIONS_ADD);
    });

    it('should navigate to view restrictions stage when view restriction button is clicked', async () => {
        const restrictions = buildUserRestrictions();
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions,
        });

        render(<UserPatientRestrictionsListStage />);

        await waitFor(async () => {
            const viewRestrictionButton = screen.getByTestId(
                `view-record-link-${restrictions[0].id}`,
            );
            expect(viewRestrictionButton).toBeInTheDocument();

            await userEvent.click(viewRestrictionButton);
        });

        expect(mockNavigate).toHaveBeenCalledWith(
            routeChildren.USER_PATIENT_RESTRICTIONS_VIEW.replace(
                ':restrictionId',
                restrictions[0].id,
            ),
        );
    });

    it('should show error message when restrictions fail to load', async () => {
        mockGetUserPatientRestrictions.mockRejectedValueOnce(
            new Error('Failed to load restrictions'),
        );

        render(<UserPatientRestrictionsListStage />);

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

        render(<UserPatientRestrictionsListStage />);

        await waitFor(() => {
            expect(screen.getByText('Searching...')).toBeInTheDocument();
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });
    });

    it('should show no restrictions message when there are no restrictions', async () => {
        mockGetUserPatientRestrictions.mockResolvedValueOnce({
            restrictions: [],
        });

        render(<UserPatientRestrictionsListStage />);

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

        render(<UserPatientRestrictionsListStage />);

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

        render(<UserPatientRestrictionsListStage />);

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

        render(<UserPatientRestrictionsListStage />);

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

        render(<UserPatientRestrictionsListStage />);

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

        render(<UserPatientRestrictionsListStage />);

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
        render(<UserPatientRestrictionsListStage />);

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
        render(<UserPatientRestrictionsListStage />);

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
            render(<UserPatientRestrictionsListStage />);

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
            render(<UserPatientRestrictionsListStage />);

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
});
