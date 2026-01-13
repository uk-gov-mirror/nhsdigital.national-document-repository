import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsPatientSearchStage, {
    incorrectFormatMessage,
} from './ReviewDetailsPatientSearchStage';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import getPatientDetails from '../../../../helpers/requests/getPatientDetails';
import { routes } from '../../../../types/generic/routes';
import { AxiosError } from 'axios';
import { JSX } from 'react/jsx-runtime';
import { ReviewDetails } from '../../../../types/generic/reviews';

const mockNavigate = vi.fn();
const mockUseParams = vi.fn();
const mockUseBaseAPIUrl = vi.fn();
const mockUseBaseAPIHeaders = vi.fn();
const mockUseConfig = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        useParams: (): unknown => mockUseParams(),
        Link: ({ children, to }: { children: React.ReactNode; to: string }): JSX.Element => (
            <a href={to}>{children}</a>
        ),
    };
});

vi.mock('../../../../helpers/hooks/useBaseAPIUrl', () => ({
    default: (): unknown => mockUseBaseAPIUrl(),
}));

vi.mock('../../../../helpers/hooks/useBaseAPIHeaders', () => ({
    default: (): unknown => mockUseBaseAPIHeaders(),
}));

vi.mock('../../../../helpers/hooks/useConfig', () => ({
    default: (): unknown => mockUseConfig(),
}));

vi.mock('../../../../helpers/requests/getPatientDetails');
const mockGetPatientDetails = getPatientDetails as Mock;

describe('ReviewDetailsPatientSearchPage', () => {
    const mockReviewId = 'review-123';
    const mockBaseUrl = 'https://api.example.com';
    const mockBaseHeaders = { Authorization: 'Bearer token' };

    const mockReviewData = {} as ReviewDetails;

    beforeEach(() => {
        mockUseParams.mockReturnValue({ reviewId: mockReviewId });
        mockUseBaseAPIUrl.mockReturnValue(mockBaseUrl);
        mockUseBaseAPIHeaders.mockReturnValue(mockBaseHeaders);
        mockUseConfig.mockReturnValue({
            mockLocal: { patientIsActive: true, patientIsDeceased: false },
            featureFlags: {},
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders page heading', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(
                screen.getByRole('heading', { name: 'Search for the correct patient' }),
            ).toBeInTheDocument();
        });

        it('renders descriptive text', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(
                screen.getByText(
                    'Enter the NHS number to find the correct patient demographics for this document.',
                ),
            ).toBeInTheDocument();
        });

        it('renders NHS number input field', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(screen.getByTestId('nhs-number-input')).toBeInTheDocument();
            expect(screen.getByLabelText(/A 10-digit number/)).toBeInTheDocument();
        });

        it('renders continue button', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(screen.getByTestId('continue-button')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
        });

        it('renders back button', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(screen.getByRole('link', { name: /back/i })).toBeInTheDocument();
        });

        it('renders link to unknown NHS number page', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const link = screen.getByRole('link', { name: "I don't know the NHS number" });
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute(
                'href',
                `/admin/reviews/${mockReviewId}/dont-know-nhs-number`,
            );
        });

        it('does not show error box initially', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(screen.queryByText('There is a problem')).not.toBeInTheDocument();
        });
    });

    describe('Form Validation', () => {
        it('shows error when submitting empty form', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const continueButton = screen.getByTestId('continue-button');
            await userEvent.click(continueButton);

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('shows error for invalid NHS number format', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '123');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('accepts 10-digit NHS number without spaces', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockGetPatientDetails).toHaveBeenCalled();
            });
        });

        it('accepts NHS number with spaces (XXX XXX XXXX)', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '900 000 0009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockGetPatientDetails).toHaveBeenCalled();
            });
        });

        it('accepts NHS number with hyphens (XXX-XXX-XXXX)', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '900-000-0009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockGetPatientDetails).toHaveBeenCalled();
            });
        });

        it('rejects NHS number with letters', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '900000000A');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('rejects NHS number with 9 digits', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '900000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('rejects NHS number with 11 digits', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '90000000099');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });
    });

    describe('Successful Search', () => {
        it('calls getPatientDetails with cleaned NHS number', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '900-000-0009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockGetPatientDetails).toHaveBeenCalledWith({
                    nhsNumber: '9000000009',
                    baseUrl: mockBaseUrl,
                    baseHeaders: mockBaseHeaders,
                });
            });
        });

        it('shows spinner during search', async () => {
            mockGetPatientDetails.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 1000)),
            );

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            expect(screen.getByText('Searching...')).toBeInTheDocument();
            expect(screen.queryByTestId('continue-button')).not.toBeInTheDocument();
        });

        it('disables input during search', async () => {
            mockGetPatientDetails.mockImplementation(
                () => new Promise((resolve) => setTimeout(resolve, 1000)),
            );

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            expect(input).toHaveAttribute('readonly');
        });

        it('navigates to patient verify page on success', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalled();
                const callArgs = mockNavigate.mock.calls[0];
                expect(callArgs[0]).toBe(
                    `/admin/reviews/${mockReviewId}/dont-know-nhs-number/patient/verify`,
                );
            });
        });

        it('clears error state on successful submission', async () => {
            const mockPatient = buildPatientDetails({ nhsNumber: '9000000009' });
            mockGetPatientDetails.mockResolvedValue(mockPatient);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText(incorrectFormatMessage);
                expect(errorMessages.length).toBeGreaterThan(0);
            });

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.clear(input);
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalled();
            });
        });
    });

    describe('Error Handling', () => {
        it('shows error message for 400 Bad Request', async () => {
            const error = {
                response: { status: 400 },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
                const errorMessages = screen.getAllByText('Enter a valid patient NHS number.');
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('navigates to session expired page for 403 Forbidden', async () => {
            const error = {
                response: { status: 403 },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(routes.SESSION_EXPIRED);
            });
        });

        it('shows patient not found message for 404', async () => {
            const error = {
                response: {
                    status: 404,
                    data: { err_code: 'PATIENT_NOT_FOUND' },
                },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
            });
        });

        it('shows default message for 404 without error code', async () => {
            const error = {
                response: {
                    status: 404,
                    data: {},
                },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorMessages = screen.getAllByText('Sorry, patient data not found.');
                expect(errorMessages.length).toBeGreaterThan(0);
            });
        });

        it('shows service error for 500 Internal Server Error', async () => {
            const error = {
                response: { status: 500 },
                message: 'Server error',
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });

        it('shows service error for network error without status', async () => {
            const error = {
                message: 'Network error',
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith(
                    expect.stringContaining(routes.SERVER_ERROR),
                );
            });
        });

        it('error box links to NHS number input', async () => {
            const error = {
                response: { status: 400 },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(() => {
                const errorLinks = screen.getAllByText('Enter a valid patient NHS number.');
                const linkWithHref = errorLinks.find((el) => el.closest('a')?.hasAttribute('href'));
                expect(linkWithHref?.closest('a')).toHaveAttribute('href', '#nhs-number-input');
            });
        });
    });

    describe('Input Features', () => {
        it('has autocomplete disabled', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            expect(input).toHaveAttribute('autocomplete', 'off');
        });

        it('has correct input width class', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            expect(input).toHaveClass('nhsuk-input--width-10');
        });

        it('has text input type', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            expect(input).toHaveAttribute('type', 'text');
        });
    });

    describe('Props', () => {
        it('accepts reviewData prop', () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            expect(screen.getByRole('heading')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('passes axe tests in initial state', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('passes axe tests with validation error', async () => {
            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(async () => {
                expect(screen.getByText('There is a problem')).toBeInTheDocument();
                const results = await runAxeTest(document.body);
                expect(results).toHaveNoViolations();
            });
        });

        it('passes axe tests with API error', async () => {
            const error = {
                response: { status: 400 },
            } as AxiosError;
            mockGetPatientDetails.mockRejectedValue(error);

            render(
                <ReviewDetailsPatientSearchStage
                    reviewData={mockReviewData}
                    setNewPatientDetails={(): void => {}}
                />,
            );

            const input = screen.getByTestId('nhs-number-input');
            await userEvent.type(input, '9000000009');
            await userEvent.click(screen.getByTestId('continue-button'));

            await waitFor(async () => {
                const errorMessages = screen.getAllByText('Enter a valid patient NHS number.');
                expect(errorMessages.length).toBeGreaterThan(0);
                const results = await runAxeTest(document.body);
                expect(results).toHaveNoViolations();
            });
        });
    });
});
