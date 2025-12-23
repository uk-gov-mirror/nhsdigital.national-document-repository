import {
    Children,
    FC,
    forwardRef,
    HTMLAttributes,
    isValidElement,
    ReactElement,
    ReactNode,
    type ComponentPropsWithoutRef,
} from 'react';
import { PaginationItem } from './PaginationItem';
import { PaginationLink } from './PaginationLink';

export type PaginationProps = ComponentPropsWithoutRef<'nav'>;

type WithProps<T extends ReactElement> = T & {
    props: HTMLAttributes<T>;
};

const isValidComponent = <T extends ReactNode>(
    child: T,
): child is WithProps<Extract<T, ReactElement>> =>
    isValidElement(child) && !!child.props && typeof child.props === 'object';

export const childIsOfComponentType = <T extends HTMLElement, P extends HTMLAttributes<T>>(
    child: ReactNode,
    component: FC<P>,
    fallback?: Required<Pick<P, 'className'>>,
): child is ReactElement<P, typeof component> => {
    if (!isValidComponent(child)) {
        return false;
    }

    // Check type for client only components
    if (child.type === component) {
        return true;
    }

    // Check props for lazy or deferred server components
    return child.props.className && fallback?.className
        ? child.props.className.split(' ').includes(fallback.className)
        : false;
};

const PaginationComponent = forwardRef<HTMLElement, PaginationProps>(
    ({ className, children, 'aria-label': ariaLabel = 'Pagination', ...rest }, forwardedRef) => {
        const items = Children.toArray(children);

        // Filter previous and next links
        const links = items.filter((child) => childIsOfComponentType(child, PaginationLink));
        const linkPrevious = links.find(({ props }) => props.previous);
        const linkNext = links.find(({ props }) => props.next);

        // Filter numbered list items
        const listItems = items.filter((child) => childIsOfComponentType(child, PaginationItem));
        const listItemsNumbered = listItems.filter(({ props }) => props.number || props.ellipsis);

        return (
            <nav
                className={[
                    'nhsuk-pagination',
                    listItemsNumbered.length ? 'nhsuk-pagination--numbered' : '',
                    className,
                ].join(' ')}
                role="navigation"
                aria-label={ariaLabel}
                ref={forwardedRef}
                {...rest}
            >
                {linkPrevious}
                <ul
                    className={
                        listItemsNumbered.length
                            ? 'nhsuk-pagination__list' // Standard pagination list class
                            : 'nhsuk-list nhsuk-pagination__list' // Legacy pagination list class
                    }
                >
                    {listItems}
                </ul>
                {linkNext}
            </nav>
        );
    },
);

PaginationComponent.displayName = 'Pagination';

export const Pagination = Object.assign(PaginationComponent, {
    Item: PaginationItem,
    Link: PaginationLink,
});
