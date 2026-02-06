import { describe, expect, it } from 'vitest';
import { sortDocumentsForReview } from './sortReviewDocs';
import {
    DOCUMENT_UPLOAD_STATE,
    ReviewUploadDocument,
    UploadDocumentType,
} from '../../types/pages/UploadDocumentsPage/types';
import { DOCUMENT_TYPE } from './documentType';

const createMockDocument = (
    id: string,
    fileName: string,
    options: Partial<ReviewUploadDocument> = {},
): ReviewUploadDocument => ({
    id,
    file: new File(['content'], fileName, { type: 'application/pdf' }),
    state: DOCUMENT_UPLOAD_STATE.SELECTED,
    docType: DOCUMENT_TYPE.LLOYD_GEORGE,
    attempts: 0,
    ...options,
});

describe('sortDocumentsForReview', () => {
    describe('position updates', () => {
        it('updates position for existing documents when additionalFiles contains matching IDs', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf'),
                createMockDocument('doc-2', 'file2.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf', { position: 5 }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result).toHaveLength(2);
            expect(result[0].position).toBe(5);
            expect(result[1].position).toBeUndefined();
        });

        it('handles position value of 0 correctly', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf', { position: 0 }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result[0].position).toBe(0);
        });

        it('updates multiple documents with positions', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf'),
                createMockDocument('doc-2', 'file2.pdf'),
                createMockDocument('doc-3', 'file3.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf', { position: 2 }),
                createMockDocument('doc-3', 'file3.pdf', { position: 1 }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result[0].position).toBe(2);
            expect(result[1].position).toBeUndefined();
            expect(result[2].position).toBe(1);
        });

        it('preserves documents without matching additionalFiles entries', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf', {
                    attempts: 3,
                    state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                }),
                createMockDocument('doc-2', 'file2.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(uploadDocuments[0]);
            expect(result[1]).toEqual(uploadDocuments[1]);
        });
    });

    describe('new file additions', () => {
        it('adds new files when type is undefined and file name not in uploadDocuments', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-2', 'file2.pdf', { type: undefined }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('doc-1');
            expect(result[1].id).toBe('doc-2');
        });

        it('does not duplicate files if file name already exists in uploadDocuments', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-2', 'file1.pdf', { type: undefined }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('doc-1');
        });

        it('does not add files with defined type', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-2', 'file2.pdf', { type: UploadDocumentType.EXISTING }),
                createMockDocument('doc-3', 'file3.pdf', { type: UploadDocumentType.REVIEW }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('doc-1');
        });

        it('adds multiple new files at once', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-2', 'file2.pdf', { type: undefined }),
                createMockDocument('doc-3', 'file3.pdf', { type: undefined }),
                createMockDocument('doc-4', 'file4.pdf', { type: undefined }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result).toHaveLength(4);
            expect(result.map((d) => d.id)).toEqual(['doc-1', 'doc-2', 'doc-3', 'doc-4']);
        });
    });

    describe('combined operations', () => {
        it('combines position updates and new file additions correctly', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf'),
                createMockDocument('doc-2', 'file2.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf', { position: 10 }),
                createMockDocument('doc-3', 'file3.pdf', { type: undefined }),
                createMockDocument('doc-4', 'file4.pdf', { type: UploadDocumentType.EXISTING }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result).toHaveLength(3);
            expect(result[0].id).toBe('doc-1');
            expect(result[0].position).toBe(10);
            expect(result[1].id).toBe('doc-2');
            expect(result[1].position).toBeUndefined();
            expect(result[2].id).toBe('doc-3');
        });

        it('handles complex scenario with mixed operations', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('existing-1', 'file1.pdf', { position: 1 }),
                createMockDocument('existing-2', 'file2.pdf'),
                createMockDocument('existing-3', 'file3.pdf', { position: 3 }),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                // Update position for existing-1
                createMockDocument('existing-1', 'file1.pdf', { position: 5 }),
                // Add new file with undefined type
                createMockDocument('new-1', 'newfile1.pdf', { type: undefined }),
                // Try to add file with existing name (should be filtered)
                createMockDocument('duplicate', 'file2.pdf', { type: undefined }),
                // Add another new file
                createMockDocument('new-2', 'newfile2.pdf', { type: undefined }),
                // File with defined type (should not be added)
                createMockDocument('typed', 'typed.pdf', { type: UploadDocumentType.REVIEW }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result).toHaveLength(5);
            expect(result[0].id).toBe('existing-1');
            expect(result[0].position).toBe(5);
            expect(result[1].id).toBe('existing-2');
            expect(result[2].id).toBe('existing-3');
            expect(result[2].position).toBe(3);
            expect(result[3].id).toBe('new-1');
            expect(result[4].id).toBe('new-2');
        });
    });

    describe('edge cases', () => {
        it('handles empty uploadDocuments array', () => {
            const uploadDocuments: ReviewUploadDocument[] = [];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf', { type: undefined }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('doc-1');
        });

        it('handles empty additionalFiles array', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(uploadDocuments[0]);
        });

        it('handles both arrays being empty', () => {
            const result = sortDocumentsForReview([], []);

            expect(result).toHaveLength(0);
        });

        it('does not mutate original arrays', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf'),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf', { position: 5 }),
            ];

            const originalUploadDocs = [...uploadDocuments];
            const originalAdditionalFiles = [...additionalFiles];

            sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(uploadDocuments).toEqual(originalUploadDocs);
            expect(additionalFiles).toEqual(originalAdditionalFiles);
            expect(uploadDocuments[0].position).toBeUndefined();
        });

        it('preserves all document properties when updating position', () => {
            const uploadDocuments: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf', {
                    state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                    attempts: 2,
                    progress: 100,
                    ref: 'some-ref',
                    key: 'some-key',
                    blob: new Blob(['test'], { type: 'application/pdf' }),
                }),
            ];

            const additionalFiles: ReviewUploadDocument[] = [
                createMockDocument('doc-1', 'file1.pdf', { position: 3 }),
            ];

            const result = sortDocumentsForReview(uploadDocuments, additionalFiles);

            expect(result[0]).toMatchObject({
                id: 'doc-1',
                state: DOCUMENT_UPLOAD_STATE.SUCCEEDED,
                attempts: 2,
                progress: 100,
                ref: 'some-ref',
                key: 'some-key',
                position: 3,
            });
            expect(result[0].blob).toBeDefined();
        });
    });
});
