import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';
import ReviewDetailsDownloadChoiceStage from './ReviewDetailsDownloadChoiceStage';
import { routeChildren } from '../../../../types/generic/routes';
import {
    DOCUMENT_UPLOAD_STATE,
    ReviewUploadDocument,
} from '../../../../types/pages/UploadDocumentsPage/types';
import { ReviewDetails } from '../../../../types/generic/reviews';
import { DOCUMENT_TYPE } from '../../../../helpers/utils/documentType';
import useReviewId from '../../../../helpers/hooks/useReviewId';

const mockNavigate = vi.fn();
let mockReviewId: string | undefined = 'test-review-123';
const mockUseReviewId = useReviewId as Mock;

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        Link: (props: any): React.JSX.Element => <a {...props} role="link" href={props.to} />,
        useNavigate: (): Mock => mockNavigate,
    };
});

vi.mock('../../../generic/backButton/BackButton', () => ({
    default: ({
        backLinkText,
        dataTestid,
    }: {
        backLinkText: string;
        dataTestid: string;
    }): React.JSX.Element => <div data-testid={dataTestid}>{backLinkText}</div>,
}));

vi.mock('../../../../helpers/utils/documentType', async () => {
    const actual = await vi.importActual<typeof import('../../../../helpers/utils/documentType')>(
        '../../../../helpers/utils/documentType',
    );
    return {
        ...actual,
        getConfigForDocType: vi.fn(() => ({ displayName: 'electronic health record' }) as any),
    };
});
vi.mock('../../../../helpers/hooks/useReviewId');

const buildDoc = (fileName: string, state: DOCUMENT_UPLOAD_STATE): ReviewUploadDocument => {
    const blob = new Blob(['test'], { type: 'application/pdf' });
    return {
        state,
        file: new File([blob], fileName, { type: 'application/pdf' }),
        id: `id-${fileName}`,
        docType: DOCUMENT_TYPE.LLOYD_GEORGE,
        attempts: 0,
        blob,
    };
};

const buildReviewData = (): ReviewDetails =>
    ({ snomedCode: DOCUMENT_TYPE.LLOYD_GEORGE }) as unknown as ReviewDetails;

describe('ReviewDetailsDownloadChoiceStage', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockReviewId = 'test-review-123';
        mockNavigate.mockClear();

        Object.defineProperty(globalThis.URL, 'createObjectURL', {
            writable: true,
            value: vi.fn().mockReturnValue('blob:http://localhost/test'),
        });
        mockUseReviewId.mockReturnValue(mockReviewId);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('renders a loading spinner when reviewData is null', () => {
        render(
            <ReviewDetailsDownloadChoiceStage
                reviewData={null}
                documents={[buildDoc('a.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED)]}
            />,
        );

        expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    });

    it('navigates back to choose-files page when there are no unselected files', async () => {
        render(
            <ReviewDetailsDownloadChoiceStage
                reviewData={buildReviewData()}
                documents={[
                    buildDoc('a.pdf', DOCUMENT_UPLOAD_STATE.SELECTED),
                    buildDoc('b.pdf', DOCUMENT_UPLOAD_STATE.SELECTED),
                ]}
            />,
        );

        const expectedPath = routeChildren.REVIEW_CHOOSE_WHICH_FILES.replace(
            ':reviewId',
            mockReviewId!,
        );

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith(expectedPath, { replace: true });
        });
    });

    it('renders the header and only the unselected file names', () => {
        render(
            <ReviewDetailsDownloadChoiceStage
                reviewData={buildReviewData()}
                documents={[
                    buildDoc('unselected-1.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED),
                    buildDoc('selected.pdf', DOCUMENT_UPLOAD_STATE.SELECTED),
                    buildDoc('unselected-2.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED),
                ]}
            />,
        );

        expect(
            screen.getByRole('heading', {
                name: "Do you want to download the files you didn't choose?",
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByText(
                "You didn't select these files to add to the existing Electronic health record:",
            ),
        ).toBeInTheDocument();

        expect(screen.getByText('unselected-1.pdf')).toBeInTheDocument();
        expect(screen.getByText('unselected-2.pdf')).toBeInTheDocument();
        expect(screen.queryByText('selected.pdf')).not.toBeInTheDocument();
    });

    it('downloads all provided documents when clicking the download link', async () => {
        const user = userEvent.setup();

        const appendSpy = vi.spyOn(document.body, 'appendChild');
        const clickSpy = vi
            .spyOn(HTMLAnchorElement.prototype, 'click')
            .mockImplementation(() => undefined);
        const removeSpy = vi
            .spyOn(HTMLElement.prototype, 'remove')
            .mockImplementation(() => undefined);

        const documents = [
            buildDoc('a.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED),
            buildDoc('b.pdf', DOCUMENT_UPLOAD_STATE.SELECTED),
            buildDoc('c.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED),
        ];

        render(
            <ReviewDetailsDownloadChoiceStage
                reviewData={buildReviewData()}
                documents={documents}
            />,
        );

        const appendCallsBefore = appendSpy.mock.calls.length;
        const clickCallsBefore = clickSpy.mock.calls.length;
        const removeCallsBefore = removeSpy.mock.calls.length;

        await user.click(screen.getByRole('link', { name: 'download these files' }));

        expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(documents.length);
        expect(appendSpy.mock.calls.length - appendCallsBefore).toBe(documents.length);
        expect(clickSpy.mock.calls.length - clickCallsBefore).toBe(documents.length);
        expect(removeSpy.mock.calls.length - removeCallsBefore).toBe(documents.length);
    });

    it('navigates to add-more-choice when clicking Continue', async () => {
        const user = userEvent.setup();

        render(
            <ReviewDetailsDownloadChoiceStage
                reviewData={buildReviewData()}
                documents={[buildDoc('a.pdf', DOCUMENT_UPLOAD_STATE.UNSELECTED)]}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Continue' }));

        const expectedPath = routeChildren.REVIEW_ADD_MORE_CHOICE.replace(
            ':reviewId',
            mockReviewId!,
        );
        expect(mockNavigate).toHaveBeenCalledWith(expectedPath, undefined);
    });
});
