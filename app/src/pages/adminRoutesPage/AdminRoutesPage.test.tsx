// @vitest-environment happy-dom
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import React from 'react';
import AdminRoutesPage, { CompleteState } from './AdminRoutesPage';
import { REPOSITORY_ROLE } from '../../types/generic/authRole';
import { buildPatientDetails } from '../../helpers/test/testBuilders';
import { routes } from '../../types/generic/routes';

// Mock hooks
const mockUseConfig = vi.fn();
const mockUseNavigate = vi.fn();
const mockUseRole = vi.fn();
const mockUsePatient = vi.fn();

vi.mock('../../helpers/hooks/useConfig', () => ({
    default: (): unknown => mockUseConfig(),
}));

vi.mock('react-router', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockUseNavigate,
    };
});

vi.mock('../../helpers/hooks/useRole', () => ({
    default: (): unknown => mockUseRole(),
}));

vi.mock('../../helpers/hooks/usePatient', () => ({
    default: (): unknown => mockUsePatient(),
}));

// Mock all the page components to avoid rendering complex child components
vi.mock('../../components/blocks/_admin/reviewsPage/ReviewsPage', () => ({
    ReviewsPage: (): React.JSX.Element => <div data-testid="reviews-page">Reviews Page</div>,
}));

vi.mock('../../components/blocks/_admin/reviewDetailsPage/ReviewDetailsPage', () => ({
    default: (): React.JSX.Element => <div data-testid="review-details-page">Review Details</div>,
}));

vi.mock(
    '../../components/blocks/_admin/reviewDetailsAssessmentPage/ReviewDetailsAssessmentPage',
    () => ({
        default: (): React.JSX.Element => <div data-testid="assessment-page">Assessment</div>,
    }),
);

vi.mock(
    '../../components/blocks/_admin/reviewDetailsCompletePage/ReviewDetailsCompletePage',
    () => ({
        default: (): React.JSX.Element => <div data-testid="complete-page">Complete</div>,
    }),
);

vi.mock(
    '../../components/blocks/_admin/reviewDetailsDontKnowNHSNumberPage/ReviewDetailsDontKnowNHSNumberPage',
    () => ({
        default: (): React.JSX.Element => (
            <div data-testid="dont-know-nhs-page">Don't Know NHS</div>
        ),
    }),
);

vi.mock(
    '../../components/blocks/_admin/reviewDetailsDownloadChoice/ReviewDetailsDownloadChoice',
    () => ({
        default: (): React.JSX.Element => (
            <div data-testid="download-choice-page">Download Choice</div>
        ),
    }),
);

vi.mock(
    '../../components/blocks/_admin/reviewDetailsFileSelectPage/ReviewDetailsFileSelectPage',
    () => ({
        default: (): React.JSX.Element => <div data-testid="file-select-page">File Select</div>,
    }),
);

vi.mock(
    '../../components/blocks/_admin/reviewDetailsNoFilesChoicePage/ReviewDetailsNoFilesChoicePage',
    () => ({
        default: (): React.JSX.Element => (
            <div data-testid="no-files-choice-page">No Files Choice</div>
        ),
    }),
);

vi.mock(
    '../../components/blocks/_admin/reviewDetailsPatientSearchPage/ReviewDetailsPatientSearchPage',
    () => ({
        default: (): React.JSX.Element => (
            <div data-testid="patient-search-page">Patient Search</div>
        ),
    }),
);

vi.mock('../../components/blocks/generic/patientVerifyPage/PatientVerifyPage', () => ({
    default: (): React.JSX.Element => <div data-testid="patient-verify-page">Patient Verify</div>,
}));

vi.mock(
    '../../components/blocks/_admin/reviewDetailsAddMoreChoicePage/ReviewDetailsAddMoreChoicePage',
    () => ({
        default: (): React.JSX.Element => (
            <div data-testid="add-more-choice-page">Add More Choice</div>
        ),
    }),
);

vi.mock('../../pages/adminPage/AdminPage', () => ({
    AdminPage: (): React.JSX.Element => <div data-testid="admin-page">Admin Page</div>,
}));

const renderWithRouter = (initialPath: string): ReturnType<typeof render> => {
    const router = createMemoryRouter(
        [
            {
                path: '/admin/*',
                element: <AdminRoutesPage />,
            },
        ],
        {
            initialEntries: [initialPath],
        },
    );

    return render(<RouterProvider router={router} />);
};

describe('AdminRoutesPage', () => {
    const mockPatient = buildPatientDetails({
        active: true,
        deceased: false,
    });

    beforeEach(() => {
        mockUseConfig.mockReturnValue({
            featureFlags: { uploadDocumentIteration3Enabled: true },
        });
        mockUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);
        mockUsePatient.mockReturnValue(mockPatient);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Feature Flag', () => {
        it('calls navigate to home when feature flag is disabled', () => {
            mockUseConfig.mockReturnValue({
                featureFlags: { uploadDocumentIteration3Enabled: false },
            });

            renderWithRouter('/admin/reviews');

            expect(mockUseNavigate).toHaveBeenCalledWith(routes.HOME);
        });

        it('renders routes when feature flag is enabled', async () => {
            renderWithRouter('/admin/reviews');

            // Should not navigate away
            expect(mockUseNavigate).not.toHaveBeenCalledWith(routes.HOME);

            await waitFor(() => {
                expect(screen.getByTestId('reviews-page')).toBeInTheDocument();
            });
        });
    });

    describe('Route Rendering', () => {
        it('renders ReviewsPage at /admin/reviews', async () => {
            renderWithRouter('/admin/reviews');

            await waitFor(() => {
                expect(screen.getByTestId('reviews-page')).toBeInTheDocument();
            });
        });

        it('renders ReviewDetailsPage at /admin/reviews/:reviewId', async () => {
            renderWithRouter('/admin/reviews/review-123');

            await waitFor(() => {
                expect(screen.getByTestId('review-details-page')).toBeInTheDocument();
            });
        });

        it('renders ReviewDetailsAssessmentPage at /admin/reviews/:reviewId/assess', async () => {
            renderWithRouter('/admin/reviews/review-123/assess');

            await waitFor(() => {
                expect(screen.getByTestId('assessment-page')).toBeInTheDocument();
            });
        });

        it('renders ReviewDetailsFileSelectPage at /admin/reviews/:reviewId/files', async () => {
            renderWithRouter('/admin/reviews/review-123/files');

            await waitFor(() => {
                expect(screen.getByTestId('file-select-page')).toBeInTheDocument();
            });
        });

        it('renders ReviewDetailsDownloadChoice at /admin/reviews/:reviewId/download-choice', async () => {
            renderWithRouter('/admin/reviews/review-123/download-choice');

            await waitFor(() => {
                expect(screen.getByTestId('download-choice-page')).toBeInTheDocument();
            });
        });

        it('renders ReviewDetailsNoFilesChoicePage at /admin/reviews/:reviewId/no-files-choice', async () => {
            renderWithRouter('/admin/reviews/review-123/no-files-choice');

            await waitFor(() => {
                expect(screen.getByTestId('no-files-choice-page')).toBeInTheDocument();
            });
        });

        it('renders ReviewDetailsAddMoreChoicePage at /admin/reviews/:reviewId/add-more-choice', async () => {
            renderWithRouter('/admin/reviews/review-123/add-more-choice');

            await waitFor(() => {
                expect(screen.getByTestId('add-more-choice-page')).toBeInTheDocument();
            });
        });

        it('renders ReviewDetailsPatientSearchPage at /admin/reviews/:reviewId/search-patient', async () => {
            renderWithRouter('/admin/reviews/review-123/search-patient');

            await waitFor(() => {
                expect(screen.getByTestId('patient-search-page')).toBeInTheDocument();
            });
        });

        it('renders ReviewDetailsDontKnowNHSNumberPage at /admin/reviews/:reviewId/dont-know-nhs-number', async () => {
            renderWithRouter('/admin/reviews/review-123/dont-know-nhs-number');

            await waitFor(() => {
                expect(screen.getByTestId('dont-know-nhs-page')).toBeInTheDocument();
            });
        });

        it('renders PatientVerifyPage at /admin/reviews/:reviewId/dont-know-nhs-number/patient/verify', async () => {
            renderWithRouter('/admin/reviews/review-123/dont-know-nhs-number/patient/verify');

            await waitFor(() => {
                expect(screen.getByTestId('patient-verify-page')).toBeInTheDocument();
            });
        });

        it('renders AdminPage for wildcard routes', async () => {
            renderWithRouter('/admin/unknown-route');

            await waitFor(() => {
                expect(screen.getByTestId('admin-page')).toBeInTheDocument();
            });
        });
    });

    describe('Complete State Routes', () => {
        it('renders complete page with PATIENT_MATCHED state', async () => {
            renderWithRouter('/admin/reviews/review-123/complete/patient-matched');

            await waitFor(() => {
                expect(screen.getByTestId('complete-page')).toBeInTheDocument();
            });
        });

        it('renders complete page with PATIENT_UNKNOWN state', async () => {
            renderWithRouter('/admin/reviews/review-123/complete/patient-unknown');

            await waitFor(() => {
                expect(screen.getByTestId('complete-page')).toBeInTheDocument();
            });
        });

        it('renders complete page with NO_FILES_CHOICE state', async () => {
            renderWithRouter('/admin/reviews/review-123/complete/no-files-choice');

            await waitFor(() => {
                expect(screen.getByTestId('complete-page')).toBeInTheDocument();
            });
        });

        it('renders complete page with REVIEW_COMPLETE state', async () => {
            renderWithRouter('/admin/reviews/review-123/complete');

            await waitFor(() => {
                expect(screen.getByTestId('complete-page')).toBeInTheDocument();
            });
        });
    });

    describe('CompleteState Enum Export', () => {
        it('exports CompleteState enum with correct values', () => {
            expect(CompleteState.PATIENT_MATCHED).toBe('PATIENT_MATCHED');
            expect(CompleteState.PATIENT_UNKNOWN).toBe('PATIENT_UNKNOWN');
            expect(CompleteState.NO_FILES_CHOICE).toBe('NO_FILES_CHOICE');
            expect(CompleteState.REVIEW_COMPLETE).toBe('REVIEW_COMPLETE');
        });
    });
});
