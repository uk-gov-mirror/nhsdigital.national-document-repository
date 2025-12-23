import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ExistingRecordTable from './ExistingRecordTable';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';

describe('ExistingRecordTable', () => {
    const mockOnFileView = vi.fn();

    const mockExistingFiles = [
        {
            filename: 'existing-file-1.pdf',
            documentUrl: 'https://example.com/file1.pdf',
        },
        {
            filename: 'existing-file-2.pdf',
            documentUrl: 'https://example.com/file2.pdf',
        },
        {
            filename: 'existing-file-3.pdf',
            documentUrl: 'https://example.com/file3.pdf',
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders the section heading', () => {
            render(
                <ExistingRecordTable
                    existingFiles={mockExistingFiles}
                    onFileView={mockOnFileView}
                />,
            );

            expect(screen.getByRole('heading', { name: 'Existing files' })).toBeInTheDocument();
        });

        it('renders table with correct headers', () => {
            render(
                <ExistingRecordTable
                    existingFiles={mockExistingFiles}
                    onFileView={mockOnFileView}
                />,
            );

            expect(screen.getByRole('columnheader', { name: 'Filename' })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'View file' })).toBeInTheDocument();
        });

        it('renders all provided files as table rows', () => {
            render(
                <ExistingRecordTable
                    existingFiles={mockExistingFiles}
                    onFileView={mockOnFileView}
                />,
            );

            expect(screen.getByText('existing-file-1.pdf')).toBeInTheDocument();
            expect(screen.getByText('existing-file-2.pdf')).toBeInTheDocument();
            expect(screen.getByText('existing-file-3.pdf')).toBeInTheDocument();
        });

        it('renders filenames in bold', () => {
            render(
                <ExistingRecordTable
                    existingFiles={mockExistingFiles}
                    onFileView={mockOnFileView}
                />,
            );

            const filename = screen.getByText('existing-file-1.pdf');
            expect(filename.tagName).toBe('STRONG');
        });

        it('renders a view button for each file', () => {
            render(
                <ExistingRecordTable
                    existingFiles={mockExistingFiles}
                    onFileView={mockOnFileView}
                />,
            );

            const viewButtons = screen.getAllByRole('button', { name: /View/i });
            expect(viewButtons).toHaveLength(3);
        });

        it('renders view buttons with accessible aria-labels', () => {
            render(
                <ExistingRecordTable
                    existingFiles={mockExistingFiles}
                    onFileView={mockOnFileView}
                />,
            );

            expect(
                screen.getByRole('button', { name: 'View existing-file-1.pdf' }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'View existing-file-2.pdf' }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: 'View existing-file-3.pdf' }),
            ).toBeInTheDocument();
        });

        it('renders correctly with empty files array', () => {
            render(<ExistingRecordTable existingFiles={[]} onFileView={mockOnFileView} />);

            expect(screen.getByRole('heading', { name: 'Existing files' })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'Filename' })).toBeInTheDocument();
            expect(screen.getByRole('columnheader', { name: 'View file' })).toBeInTheDocument();

            const viewButtons = screen.queryAllByRole('button', { name: /View/i });
            expect(viewButtons).toHaveLength(0);
        });

        it('renders correctly with single file', () => {
            const singleFile = [mockExistingFiles[0]];

            render(<ExistingRecordTable existingFiles={singleFile} onFileView={mockOnFileView} />);

            expect(screen.getByText('existing-file-1.pdf')).toBeInTheDocument();
            const viewButtons = screen.getAllByRole('button', { name: /View/i });
            expect(viewButtons).toHaveLength(1);
        });
    });

    describe('User Interactions', () => {
        it('calls onFileView with correct parameters when view button clicked', async () => {
            render(
                <ExistingRecordTable
                    existingFiles={mockExistingFiles}
                    onFileView={mockOnFileView}
                />,
            );

            const firstViewButton = screen.getByRole('button', {
                name: 'View existing-file-1.pdf',
            });
            await userEvent.click(firstViewButton);

            expect(mockOnFileView).toHaveBeenCalledTimes(1);
            expect(mockOnFileView).toHaveBeenCalledWith(
                'existing-file-1.pdf',
                'https://example.com/file1.pdf',
            );
        });

        it('calls onFileView with correct parameters for different files', async () => {
            render(
                <ExistingRecordTable
                    existingFiles={mockExistingFiles}
                    onFileView={mockOnFileView}
                />,
            );

            const secondViewButton = screen.getByRole('button', {
                name: 'View existing-file-2.pdf',
            });
            await userEvent.click(secondViewButton);

            expect(mockOnFileView).toHaveBeenCalledTimes(1);
            expect(mockOnFileView).toHaveBeenCalledWith(
                'existing-file-2.pdf',
                'https://example.com/file2.pdf',
            );
        });

        it('handles multiple view button clicks', async () => {
            render(
                <ExistingRecordTable
                    existingFiles={mockExistingFiles}
                    onFileView={mockOnFileView}
                />,
            );

            const firstViewButton = screen.getByRole('button', {
                name: 'View existing-file-1.pdf',
            });
            const thirdViewButton = screen.getByRole('button', {
                name: 'View existing-file-3.pdf',
            });

            await userEvent.click(firstViewButton);
            await userEvent.click(thirdViewButton);

            expect(mockOnFileView).toHaveBeenCalledTimes(2);
            expect(mockOnFileView).toHaveBeenNthCalledWith(
                1,
                'existing-file-1.pdf',
                'https://example.com/file1.pdf',
            );
            expect(mockOnFileView).toHaveBeenNthCalledWith(
                2,
                'existing-file-3.pdf',
                'https://example.com/file3.pdf',
            );
        });
    });

    describe('Accessibility', () => {
        it('passes axe accessibility tests with files', async () => {
            const { container } = render(
                <ExistingRecordTable
                    existingFiles={mockExistingFiles}
                    onFileView={mockOnFileView}
                />,
            );

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });

        it('passes axe accessibility tests with empty files array', async () => {
            const { container } = render(
                <ExistingRecordTable existingFiles={[]} onFileView={mockOnFileView} />,
            );

            const results = await runAxeTest(container);
            expect(results).toHaveNoViolations();
        });
    });

    describe('Edge Cases', () => {
        it('handles files with special characters in filename', () => {
            const specialFiles = [
                {
                    filename: 'file-with-special-chars_123.pdf',
                    documentUrl: 'https://example.com/special.pdf',
                },
            ];

            render(
                <ExistingRecordTable existingFiles={specialFiles} onFileView={mockOnFileView} />,
            );

            expect(screen.getByText('file-with-special-chars_123.pdf')).toBeInTheDocument();
        });

        it('handles files with long filenames', () => {
            const longFilenameFiles = [
                {
                    filename:
                        'this-is-a-very-long-filename-that-might-cause-layout-issues-in-the-table.pdf',
                    documentUrl: 'https://example.com/long.pdf',
                },
            ];

            render(
                <ExistingRecordTable
                    existingFiles={longFilenameFiles}
                    onFileView={mockOnFileView}
                />,
            );

            expect(
                screen.getByText(
                    'this-is-a-very-long-filename-that-might-cause-layout-issues-in-the-table.pdf',
                ),
            ).toBeInTheDocument();
        });

        it('handles files with URLs containing query parameters', async () => {
            const filesWithQueryParams = [
                {
                    filename: 'file-with-params.pdf',
                    documentUrl: 'https://example.com/file.pdf?token=abc123&user=test',
                },
            ];

            render(
                <ExistingRecordTable
                    existingFiles={filesWithQueryParams}
                    onFileView={mockOnFileView}
                />,
            );

            const viewButton = screen.getByRole('button', { name: 'View file-with-params.pdf' });
            await userEvent.click(viewButton);

            expect(mockOnFileView).toHaveBeenCalledWith(
                'file-with-params.pdf',
                'https://example.com/file.pdf?token=abc123&user=test',
            );
        });
    });
});
