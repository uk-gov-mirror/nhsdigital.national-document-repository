import { render, screen } from '@testing-library/react';
import { FC } from 'react';
import { Pagination, childIsOfComponentType } from './Pagination';
import { PaginationLinkText } from './PaginationItem';

describe('Pagination', () => {
    it('renders the navigation element', () => {
        render(<Pagination />);
        expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders with custom aria-label', () => {
        render(<Pagination aria-label="Custom Label" />);
        expect(screen.getByRole('navigation', { name: 'Custom Label' })).toBeInTheDocument();
    });

    it('renders previous and next links correctly', () => {
        render(
            <Pagination>
                <Pagination.Link previous href="/prev">
                    Previous
                </Pagination.Link>
                <Pagination.Link next href="/next">
                    Next
                </Pagination.Link>
            </Pagination>,
        );

        const prevLink = screen.getByRole('link', { name: /previous/i });
        const nextLink = screen.getByRole('link', { name: /next/i });

        expect(prevLink).toBeInTheDocument();
        expect(nextLink).toBeInTheDocument();
        expect(prevLink).toHaveAttribute('href', '/prev');
        expect(nextLink).toHaveAttribute('href', '/next');
    });

    it('renders numbered items in a list', () => {
        render(
            <Pagination>
                <Pagination.Item href="/1" number={1}>
                    1
                </Pagination.Item>
                <Pagination.Item current href="/2" number={2}>
                    2
                </Pagination.Item>
                <Pagination.Item href="/3" number={3}>
                    3
                </Pagination.Item>
            </Pagination>,
        );

        const list = screen.getByRole('list');
        expect(list).toBeInTheDocument();
        expect(list).toHaveClass('nhsuk-pagination__list');

        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(3);

        // Check for current item
        const currentLink = screen.getByRole('link', { name: /page 2/i });
        expect(currentLink).toBeInTheDocument();
        // Note: The exact implementation of 'current' styling/aria might vary,
        // but usually it adds a class or aria-current.
        // Looking at PaginationItem.tsx:
        // if (rest.current) { itemClassName = `${itemClassName} ${className}--current`; }
        // It doesn't seem to add aria-current to the link automatically in PaginationItem,
        // but let's check if we can verify the class on the list item.

        // We can find the list item that contains the current link
        const currentItem = items[1];
        expect(currentItem).toHaveClass('nhsuk-pagination__item--current');
    });

    it('renders mixed content (previous, next, and items) correctly', () => {
        render(
            <Pagination>
                <Pagination.Link previous href="/prev">
                    Previous
                </Pagination.Link>
                <Pagination.Item href="/1" number={1}>
                    1
                </Pagination.Item>
                <Pagination.Item current href="/2" number={2}>
                    2
                </Pagination.Item>
                <Pagination.Item href="/3" number={3}>
                    3
                </Pagination.Item>
                <Pagination.Link next href="/next">
                    Next
                </Pagination.Link>
            </Pagination>,
        );

        const nav = screen.getByRole('navigation');
        expect(nav).toHaveClass('nhsuk-pagination--numbered');

        const prevLink = screen.getByRole('link', { name: /previous/i });
        const nextLink = screen.getByRole('link', { name: /next/i });
        const list = screen.getByRole('list');

        expect(nav).toContainElement(prevLink);
        expect(nav).toContainElement(list);
        expect(nav).toContainElement(nextLink);
    });

    it('renders ellipsis item correctly', () => {
        render(
            <Pagination>
                <Pagination.Item ellipsis>...</Pagination.Item>
            </Pagination>,
        );

        const items = screen.getAllByRole('listitem');
        expect(items).toHaveLength(1);
        expect(items[0]).toHaveClass('nhsuk-pagination__item--ellipsis');
        expect(items[0]).toHaveTextContent('⋯');
    });

    it('renders previous item with correct classes (legacy)', () => {
        render(
            <Pagination>
                <Pagination.Item previous href="/prev">
                    Previous
                </Pagination.Item>
            </Pagination>,
        );
        const item = screen.getByRole('listitem');
        expect(item).toHaveClass('nhsuk-pagination-item--previous');
    });

    it('renders next item with correct classes (legacy)', () => {
        render(
            <Pagination>
                <Pagination.Item next href="/next">
                    Next
                </Pagination.Item>
            </Pagination>,
        );
        const item = screen.getByRole('listitem');
        expect(item).toHaveClass('nhsuk-pagination-item--next');
    });

    it('renders legacy pagination list correctly', () => {
        render(
            <Pagination>
                <Pagination.Item previous href="/prev">
                    Previous
                </Pagination.Item>
                <Pagination.Item next href="/next">
                    Next
                </Pagination.Item>
            </Pagination>,
        );

        const list = screen.getByRole('list');
        expect(list).toHaveClass('nhsuk-list nhsuk-pagination__list');
        expect(list).not.toHaveClass('nhsuk-pagination__list--numbered');

        const nav = screen.getByRole('navigation');
        expect(nav).not.toHaveClass('nhsuk-pagination--numbered');
    });

    it('renders standard item when both previous and next are true', () => {
        render(
            <Pagination>
                {/* @ts-ignore - Testing edge case */}
                <Pagination.Item previous next href="/mixed">
                    Mixed
                </Pagination.Item>
            </Pagination>,
        );
        const item = screen.getByRole('listitem');
        // Should not have previous or next classes
        expect(item).not.toHaveClass('nhsuk-pagination-item--previous');
        expect(item).not.toHaveClass('nhsuk-pagination-item--next');
        expect(item).toHaveClass('nhsuk-pagination__item');
    });

    it('renders standard link correctly', () => {
        render(<Pagination.Link href="/link">Link</Pagination.Link>);
        const link = screen.getByRole('link', { name: /link/i });
        expect(link).toBeInTheDocument();
        expect(link).not.toHaveClass('nhsuk-pagination__previous');
        expect(link).not.toHaveClass('nhsuk-pagination__next');
    });

    it('renders non-string children directly (legacy link)', () => {
        render(
            <Pagination.Link href="/legacy">
                <span>Icon</span>
            </Pagination.Link>,
        );
        const link = screen.getByRole('link');
        expect(link).toHaveTextContent('Icon');
        expect(link.querySelector('svg')).not.toBeInTheDocument();
    });

    it('renders link with number prop correctly', () => {
        render(
            <Pagination.Link href="/1" number={1}>
                1
            </Pagination.Link>,
        );
        const link = screen.getByRole('link', { name: /page 1/i });
        expect(link).toBeInTheDocument();
    });
});

describe('PaginationLinkText', () => {
    it('renders number when provided', () => {
        render(<PaginationLinkText number={5} />);
        expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('renders label text correctly', () => {
        render(
            <PaginationLinkText next labelText="Page 1">
                Title
            </PaginationLinkText>,
        );
        expect(screen.getByText('Title')).toBeInTheDocument();
        expect(screen.getByText('Page 1')).toBeInTheDocument();
        expect(screen.getByText(':')).toHaveClass('nhsuk-u-visually-hidden');
    });

    it('renders default Previous text when no children provided', () => {
        render(<PaginationLinkText previous={true} />);
        expect(screen.getByText('Previous')).toBeInTheDocument();
        expect(screen.getByText('page')).toHaveClass('nhsuk-u-visually-hidden');
    });

    it('renders default Next text when no children provided', () => {
        render(<PaginationLinkText next={true} />);
        expect(screen.getByText('Next')).toBeInTheDocument();
        expect(screen.getByText('page')).toHaveClass('nhsuk-u-visually-hidden');
    });

    it('returns null for infinite number', () => {
        const { container } = render(<PaginationLinkText number={Infinity} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('renders children instead of default text when both provided', () => {
        render(<PaginationLinkText previous={true}>Custom Previous</PaginationLinkText>);
        expect(screen.getByText('Custom Previous')).toBeInTheDocument();
    });

    it('renders nothing when no props provided', () => {
        const { container } = render(<PaginationLinkText />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('childIsOfComponentType', () => {
    const TestComponent: FC<{ className?: string }> = () => <div>Test</div>;

    it('returns false for invalid component', () => {
        expect(childIsOfComponentType(null, TestComponent)).toBe(false);
        expect(childIsOfComponentType('string', TestComponent)).toBe(false);
    });

    it('returns true for matching component type', () => {
        const element = <TestComponent />;
        expect(childIsOfComponentType(element, TestComponent)).toBe(true);
    });

    it('returns true for matching fallback className', () => {
        const element = <div className="test-class" />;
        // @ts-ignore - mocking a component check where type doesn't match but class does
        expect(childIsOfComponentType(element, TestComponent, { className: 'test-class' })).toBe(
            true,
        );
    });

    it('returns false for non-matching fallback className', () => {
        const element = <div className="other-class" />;
        // @ts-ignore
        expect(childIsOfComponentType(element, TestComponent, { className: 'test-class' })).toBe(
            false,
        );
    });

    it('returns false when fallback is not provided', () => {
        const element = <div className="test-class" />;
        // @ts-ignore
        expect(childIsOfComponentType(element, TestComponent)).toBe(false);
    });

    it('returns false when child has no className', () => {
        const element = <div></div>;
        // @ts-ignore
        expect(childIsOfComponentType(element, TestComponent, { className: 'test-class' })).toBe(
            false,
        );
    });
});
