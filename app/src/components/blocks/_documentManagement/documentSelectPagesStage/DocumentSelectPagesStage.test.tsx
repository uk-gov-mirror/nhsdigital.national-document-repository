import { render, screen } from '@testing-library/react';
import DocumentSelectPagesStage from './DocumentSelectPagesStage';

describe('DocumentSelectPagesStage', () => {
    it('renders', () => {
        render(<DocumentSelectPagesStage />);

        expect(screen.getByText('Document select page')).toBeInTheDocument();
    });
});
