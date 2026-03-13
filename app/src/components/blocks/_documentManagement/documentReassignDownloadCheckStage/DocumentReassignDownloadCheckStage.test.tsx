import { render, screen, waitFor } from '@testing-library/react';
import DocumentReassignDownloadCheckStage from './DocumentReassignDownloadCheckStage';
import userEvent from '@testing-library/user-event';
import { Mock } from 'vitest';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
    };
});

const mockNavigate = vi.fn();

describe('DocumentReassignDownloadCheckStage', () => {
    it('renders', () => {
        render(<DocumentReassignDownloadCheckStage removePages={vi.fn()} />);

        expect(
            screen.getByText('Check these pages have downloaded to your computer'),
        ).toBeInTheDocument();
    });

    it('calls removePages when Finish button is clicked', async () => {
        const mockRemovePages = vi.fn();
        render(<DocumentReassignDownloadCheckStage removePages={mockRemovePages} />);

        const finishButton = screen.getByTestId('finish-button');
        await userEvent.click(finishButton);

        expect(mockRemovePages).toHaveBeenCalled();

        await waitFor(() => {
            expect(screen.getByTestId('processing-spinner')).toBeInTheDocument();
            expect(finishButton).not.toBeInTheDocument();
        });
    });

    it('should navigate back when Go back to download the pages link is clicked', async () => {
        render(<DocumentReassignDownloadCheckStage removePages={vi.fn()} />);

        const goBackLink = screen.getByTestId('go-back-link');
        await userEvent.click(goBackLink);

        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
});
