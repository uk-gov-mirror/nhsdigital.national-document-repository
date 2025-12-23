import {
    AnchorHTMLAttributes,
    ButtonHTMLAttributes,
    ElementType,
    FC,
    forwardRef,
    PropsWithChildren,
} from 'react';
import { ArrowLeftIcon, ArrowRightIcon } from 'nhsuk-react-components';
import { PaginationLink } from './PaginationLink';

export type AsElementLink<T extends HTMLElement> = (T extends HTMLButtonElement
    ? ButtonHTMLAttributes<T>
    : AnchorHTMLAttributes<T>) & {
    asElement?: ElementType;
    to?: string;
};

export type PaginationLinkProps = PaginationLinkTextProps & AsElementLink<HTMLAnchorElement>;

export type PaginationItemProps = PaginationLinkProps & {
    ellipsis?: boolean;
};

export const PaginationItem = forwardRef<HTMLAnchorElement, PaginationItemProps>(
    ({ children, ...rest }, forwardedRef) => {
        const isPrevious = !!rest.previous && !rest.next;
        const isNext = !!rest.next && !rest.previous;

        const className =
            isPrevious || isNext
                ? 'nhsuk-pagination-item' // Legacy pagination class
                : 'nhsuk-pagination__item'; // Numbered pagination class

        let itemClassName = isPrevious || isNext ? undefined : className;

        if (rest.current) {
            itemClassName = `${itemClassName} ${className}--current`;
        }
        if (rest.ellipsis) {
            itemClassName = `${itemClassName} ${className}--ellipsis`;
        }
        if (rest.previous && !rest.next) {
            itemClassName = `${itemClassName} ${className}--previous`;
        }
        if (rest.next && !rest.previous) {
            itemClassName = `${itemClassName} ${className}--next`;
        }

        return (
            <li className={itemClassName}>
                {rest.ellipsis ? (
                    '⋯'
                ) : (
                    <PaginationLink
                        className={
                            isPrevious
                                ? 'nhsuk-pagination__link nhsuk-pagination__link--prev'
                                : isNext
                                  ? 'nhsuk-pagination__link nhsuk-pagination__link--next'
                                  : 'nhsuk-pagination__link'
                        }
                        ref={forwardedRef}
                        {...rest}
                    >
                        <PaginationLinkText {...rest}>{children}</PaginationLinkText>
                        {rest.previous ? <ArrowLeftIcon /> : null}
                        {rest.next ? <ArrowRightIcon /> : null}
                    </PaginationLink>
                )}
            </li>
        );
    },
);

PaginationItem.displayName = 'Pagination.Item';

export type PaginationLinkTextProps = PropsWithChildren &
    (
        | WithLabelText<{
              previous: true;
              next?: never;
          }>
        | WithLabelText<{
              previous?: never;
              next: true;
          }>
        | WithoutLabelText<{
              current?: never;
              number?: never;
              visuallyHiddenText?: never;
          }>
        | WithoutLabelText<{
              current?: boolean;
              number: number;
              visuallyHiddenText?: string;
          }>
    );

type WithLabelText<T> = T & {
    labelText?: string;
    current?: never;
    number?: never;
    visuallyHiddenText?: never;
};

type WithoutLabelText<T> = T & {
    labelText?: never;
    previous?: never;
    next?: never;
};

export const PaginationLinkText: FC<PaginationLinkTextProps> = ({
    children,
    previous,
    next,
    labelText,
    number,
}) => {
    if (typeof number === 'number') {
        return Number.isFinite(number) ? number : null;
    }

    return (
        <>
            {children || previous || next ? (
                <span className="nhsuk-pagination__title">
                    {children || (
                        <>
                            {previous ? 'Previous' : 'Next'}
                            <span className="nhsuk-u-visually-hidden"> page</span>
                        </>
                    )}
                </span>
            ) : null}
            {labelText ? (
                <>
                    <span className="nhsuk-u-visually-hidden">:</span>
                    <span className="nhsuk-pagination__page">{labelText}</span>
                </>
            ) : null}
        </>
    );
};
