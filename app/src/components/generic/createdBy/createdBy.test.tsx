import { render, screen } from '@testing-library/react';
import { CreatedByCard, CreatedByText } from './createdBy';

describe('createdBy.tsx', () => {
    describe('CreatedByCard', () => {
        const defaultProps = {
            odsCode: 'Y12345',
            dateUploaded: '2024-01-15',
        };

        it('renders the card with odsCode and dateUploaded', () => {
            render(<CreatedByCard {...defaultProps} />);

            expect(
                screen.getByText(
                    `Created by practice ${defaultProps.odsCode} on ${defaultProps.dateUploaded}`,
                ),
            ).toBeInTheDocument();
        });

        it('applies custom cssClass when provided', () => {
            const customClass = 'custom-test-class';
            const { container } = render(
                <CreatedByCard {...defaultProps} cssClass={customClass} />,
            );

            const cardContent = container.querySelector(`.${customClass}`);
            expect(cardContent).toBeInTheDocument();
        });

        it('renders without cssClass when not provided', () => {
            const { container } = render(<CreatedByCard {...defaultProps} />);

            const cardContent = container.firstChild;
            expect(cardContent).not.toHaveClass('custom-test-class');
        });
    });

    describe('CreatedByText', () => {
        const defaultProps = {
            odsCode: 'A98765',
            dateUploaded: '2024-06-20',
        };

        it('renders the text with odsCode and dateUploaded', () => {
            render(<CreatedByText {...defaultProps} />);

            expect(
                screen.getByText(
                    `Created by practice ${defaultProps.odsCode} on ${defaultProps.dateUploaded}`,
                ),
            ).toBeInTheDocument();
        });

        it('renders as a paragraph element', () => {
            render(<CreatedByText {...defaultProps} />);

            const paragraph = screen.getByText(/Created by practice/);
            expect(paragraph.tagName).toBe('P');
        });

        it('applies custom cssClass when provided', () => {
            const customClass = 'text-style-class';
            const { container } = render(
                <CreatedByText {...defaultProps} cssClass={customClass} />,
            );

            const paragraph = container.querySelector(`.${customClass}`);
            expect(paragraph).toBeInTheDocument();
        });

        it('renders without cssClass when not provided', () => {
            const { container } = render(<CreatedByText {...defaultProps} />);

            const paragraph = container.firstChild;
            expect(paragraph).not.toHaveClass('text-style-class');
        });
    });
});
