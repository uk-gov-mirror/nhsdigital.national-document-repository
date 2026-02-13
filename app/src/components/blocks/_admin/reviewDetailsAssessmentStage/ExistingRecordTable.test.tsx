import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExistingRecordTable from './ExistingRecordTable';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { SearchResult } from '../../../../types/generic/searchResult';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';

describe('ExistingRecordTable', () => {
    const mockOnFileView = vi.fn();

    const mockExistingFiles: SearchResult[] = [
        {
            fileName: 'existing-file-1.pdf',
            id: 'file-id-1',
            created: '2024-01-01',
            author: 'Y1234',
            virusScannerResult: 'Clean',
            fileSize: 1024,
            version: '1',
            documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
            contentType: 'application/pdf',
        },
        {
            fileName: 'existing-file-2.pdf',
            id: 'file-id-2',
            created: '2024-01-02',
            author: 'Y1234',
            virusScannerResult: 'Clean',
            fileSize: 2048,
            version: '1',
            documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
            contentType: 'application/pdf',
        },
        {
            fileName: 'existing-file-3.pdf',
            id: 'file-id-3',
            created: '2024-01-03',
            author: 'Y1234',
            virusScannerResult: 'Clean',
            fileSize: 3072,
            version: '1',
            documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
            contentType: 'application/pdf',
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
            expect(mockOnFileView).toHaveBeenCalledWith('existing-file-1.pdf', 'file-id-1');
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
            expect(mockOnFileView).toHaveBeenCalledWith('existing-file-2.pdf', 'file-id-2');
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
            expect(mockOnFileView).toHaveBeenNthCalledWith(1, 'existing-file-1.pdf', 'file-id-1');
            expect(mockOnFileView).toHaveBeenNthCalledWith(2, 'existing-file-3.pdf', 'file-id-3');
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
            const specialFiles: SearchResult[] = [
                {
                    fileName: 'file-with-special-chars_123.pdf',
                    id: 'special-id',
                    created: '2024-01-01',
                    author: 'Y1234',
                    virusScannerResult: 'Clean',
                    fileSize: 1024,
                    version: '1',
                    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                    contentType: 'application/pdf',
                },
            ];

            render(
                <ExistingRecordTable existingFiles={specialFiles} onFileView={mockOnFileView} />,
            );

            expect(screen.getByText('file-with-special-chars_123.pdf')).toBeInTheDocument();
        });

        it('handles files with long filenames', () => {
            const longFilenameFiles: SearchResult[] = [
                {
                    fileName:
                        'this-is-a-very-long-filename-that-might-cause-layout-issues-in-the-table.pdf',
                    id: 'long-id',
                    created: '2024-01-01',
                    author: 'Y1234',
                    virusScannerResult: 'Clean',
                    fileSize: 1024,
                    version: '1',
                    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                    contentType: 'application/pdf',
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

        it('handles files with IDs containing special characters', async () => {
            const filesWithSpecialIds: SearchResult[] = [
                {
                    fileName: 'file-with-params.pdf',
                    id: 'file-id-with-special-chars-abc123',
                    created: '2024-01-01',
                    author: 'Y1234',
                    virusScannerResult: 'Clean',
                    fileSize: 1024,
                    version: '1',
                    documentSnomedCodeType: DOCUMENT_TYPE.LLOYD_GEORGE,
                    contentType: 'application/pdf',
                },
            ];

            render(
                <ExistingRecordTable
                    existingFiles={filesWithSpecialIds}
                    onFileView={mockOnFileView}
                />,
            );

            const viewButton = screen.getByRole('button', { name: 'View file-with-params.pdf' });
            await userEvent.click(viewButton);

            expect(mockOnFileView).toHaveBeenCalledWith(
                'file-with-params.pdf',
                'file-id-with-special-chars-abc123',
            );
        });
    });
});
