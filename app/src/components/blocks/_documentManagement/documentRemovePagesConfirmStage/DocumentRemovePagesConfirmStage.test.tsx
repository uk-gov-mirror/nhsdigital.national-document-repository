import { render, screen } from '@testing-library/react';
import DocumentRemovePagesConfirmStage from './DocumentRemovePagesConfirmStage';

describe('DocumentRemovePagesConfirmStage', () => {
    it('renders the pages to remove', () => {
        const pagesToRemove = [1, 3, 5];
        render(
            <DocumentRemovePagesConfirmStage
                baseDocumentBlob={null}
                pagesToRemove={pagesToRemove}
            />,
        );

        expect(screen.getByText('Pages to remove: 1, 3, 5')).toBeInTheDocument();
    });
});
