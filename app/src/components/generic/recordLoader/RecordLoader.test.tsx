import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordLoader, RecordDetails } from './RecordLoader';
import { DOWNLOAD_STAGE } from '../../../types/generic/downloadStage';
import { runAxeTest } from '../../../helpers/test/axeTestHelper';
import { JSX } from 'react/jsx-runtime';

// Mock SessionProvider
const mockUseSessionContext = vi.fn();
vi.mock('../../../providers/sessionProvider/SessionProvider', () => ({
    useSessionContext: (): unknown => mockUseSessionContext(),
}));

// Mock ProgressBar
vi.mock('../progressBar/ProgressBar', () => ({
    default: ({ status, className }: { status: string; className: string }): JSX.Element => (
        <div data-testid="progress-bar" className={className}>
            {status}
        </div>
    ),
}));

describe('RecordLoader', () => {
    const mockChildrenIfFailure = <div data-testid="failure-content">Error occurred</div>;
    const defaultProps = {
        downloadStage: DOWNLOAD_STAGE.INITIAL,
        lastUpdated: '01 January 2024, 10:30am',
        childrenIfFailiure: mockChildrenIfFailure,
    };

    beforeEach(() => {
        mockUseSessionContext.mockReturnValue([{ isFullscreen: false }]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders loading state for INITIAL stage', () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.INITIAL} />);

            expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('renders loading state for PENDING stage', () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.PENDING} />);

            expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('renders loading state for REFRESH stage', () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.REFRESH} />);

            expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
            expect(screen.getByText('Loading...')).toBeInTheDocument();
        });

        it('renders record details for SUCCEEDED stage when not fullscreen', () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.SUCCEEDED} />);

            expect(screen.getByText('Last updated: 01 January 2024, 10:30am')).toBeInTheDocument();
            expect(screen.queryByTestId('progress-bar')).not.toBeInTheDocument();
        });

        it('renders empty fragment for SUCCEEDED stage when in fullscreen mode', () => {
            mockUseSessionContext.mockReturnValue([{ isFullscreen: true }]);

            const { container } = render(
                <RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.SUCCEEDED} />,
            );

            expect(container.firstChild).toBeNull();
            expect(screen.queryByText('Last updated:')).not.toBeInTheDocument();
        });

        it('renders childrenIfFailiure for FAILED stage', () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.FAILED} />);

            expect(screen.getByTestId('failure-content')).toBeInTheDocument();
            expect(screen.getByText('Error occurred')).toBeInTheDocument();
        });

        it('renders childrenIfFailiure for TIMEOUT stage', () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.TIMEOUT} />);

            expect(screen.getByTestId('failure-content')).toBeInTheDocument();
        });

        it('renders childrenIfFailiure for NO_RECORDS stage', () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.NO_RECORDS} />);

            expect(screen.getByTestId('failure-content')).toBeInTheDocument();
        });

        it('renders childrenIfFailiure for UPLOADING stage', () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.UPLOADING} />);

            expect(screen.getByTestId('failure-content')).toBeInTheDocument();
        });
    });

    describe('Props', () => {
        it('displays lastUpdated prop correctly in SUCCEEDED stage', () => {
            const lastUpdated = '15 December 2024, 3:45pm';
            render(
                <RecordLoader
                    {...defaultProps}
                    downloadStage={DOWNLOAD_STAGE.SUCCEEDED}
                    lastUpdated={lastUpdated}
                />,
            );

            expect(screen.getByText(`Last updated: ${lastUpdated}`)).toBeInTheDocument();
        });

        it('renders custom failure content when provided', () => {
            const customFailure = <div data-testid="custom-error">Custom error message</div>;

            render(
                <RecordLoader
                    {...defaultProps}
                    downloadStage={DOWNLOAD_STAGE.FAILED}
                    childrenIfFailiure={customFailure}
                />,
            );

            expect(screen.getByTestId('custom-error')).toBeInTheDocument();
            expect(screen.getByText('Custom error message')).toBeInTheDocument();
        });

        it('applies loading-bar className to ProgressBar', () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.INITIAL} />);

            const progressBar = screen.getByTestId('progress-bar');
            expect(progressBar).toHaveClass('loading-bar');
        });
    });

    describe('Session Context Integration', () => {
        it('calls useSessionContext hook', () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.SUCCEEDED} />);

            expect(mockUseSessionContext).toHaveBeenCalled();
        });

        it('respects isFullscreen flag from session context', () => {
            mockUseSessionContext.mockReturnValue([{ isFullscreen: true }]);

            const { container } = render(
                <RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.SUCCEEDED} />,
            );

            expect(container.firstChild).toBeNull();
        });

        it('shows details when isFullscreen is false', () => {
            mockUseSessionContext.mockReturnValue([{ isFullscreen: false }]);

            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.SUCCEEDED} />);

            expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('passes axe tests in loading state', async () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.INITIAL} />);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('passes axe tests in success state', async () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.SUCCEEDED} />);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });

        it('passes axe tests in failure state', async () => {
            render(<RecordLoader {...defaultProps} downloadStage={DOWNLOAD_STAGE.FAILED} />);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });
});

describe('RecordDetails', () => {
    describe('Rendering', () => {
        it('renders last updated date correctly', () => {
            const lastUpdated = '25 December 2024, 12:00pm';
            render(<RecordDetails lastUpdated={lastUpdated} />);

            expect(screen.getByText(`Last updated: ${lastUpdated}`)).toBeInTheDocument();
        });

        it('renders with correct CSS classes', () => {
            const { container } = render(<RecordDetails lastUpdated="01 Jan 2024" />);

            const detailsContainer = container.querySelector('.lloydgeorge_record-details');
            expect(detailsContainer).toBeInTheDocument();

            const detailsInner = container.querySelector('.lloydgeorge_record-details_details');
            expect(detailsInner).toBeInTheDocument();

            const lastUpdatedElement = container.querySelector(
                '.lloydgeorge_record-details_details--last-updated',
            );
            expect(lastUpdatedElement).toBeInTheDocument();
        });
    });

    describe('Edge Cases', () => {
        it('handles empty string for lastUpdated', () => {
            render(<RecordDetails lastUpdated="" />);

            expect(screen.getByText('Last updated:')).toBeInTheDocument();
        });

        it('handles long date strings', () => {
            const longDate = 'Wednesday, 25th December 2024 at 12:30:45pm GMT';
            render(<RecordDetails lastUpdated={longDate} />);

            expect(screen.getByText(`Last updated: ${longDate}`)).toBeInTheDocument();
        });

        it('handles special characters in date', () => {
            const dateWithSpecialChars = '01/01/2024 - 10:30 (UTC+0)';
            render(<RecordDetails lastUpdated={dateWithSpecialChars} />);

            expect(screen.getByText(`Last updated: ${dateWithSpecialChars}`)).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('passes axe tests', async () => {
            render(<RecordDetails lastUpdated="01 January 2024" />);

            const results = await runAxeTest(document.body);
            expect(results).toHaveNoViolations();
        });
    });
});
