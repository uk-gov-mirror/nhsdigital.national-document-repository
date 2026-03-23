import React, { JSX } from 'react';

export enum TimelineStatus {
    Active = 'active',
    Inactive = 'inactive',
    None = 'none',
}

type TimelineProps = {
    children: React.ReactNode;
};

type TimelineItemProps = {
    status?: TimelineStatus;
    children?: React.ReactNode;
    className?: string;
};

type TimelineDescriptionProps = {
    className?: string;
    children: React.ReactNode;
};

type TimelineHeadingProps = {
    status?: TimelineStatus;
    className?: string;
    children: React.ReactNode;
};

const ActiveBadge = (): JSX.Element => (
    <svg
        className="nhsapp-timeline__badge"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="28"
        height="28"
        viewBox="0 0 28 28"
    >
        <circle cx="14" cy="14" r="13" fill="#005EB8" />
    </svg>
);

const InactiveBadge = (): JSX.Element => (
    <svg
        className="nhsapp-timeline__badge nhsapp-timeline__badge--small"
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 14 14"
    >
        <circle cx="7" cy="7" r="6" fill="white" stroke="#AEB7BD" strokeWidth="2" />
    </svg>
);

const TimelineHeading = ({
    status = TimelineStatus.Inactive,
    className = '',
    children,
}: TimelineHeadingProps): JSX.Element => (
    <h3
        className={`nhsapp-timeline__header${
            status === TimelineStatus.Active ? ' nhsuk-u-font-weight-bold' : ''
        } ${className}`}
    >
        {children}
    </h3>
);

const TimelineDescription = ({
    children,
    className = '',
}: TimelineDescriptionProps): JSX.Element => (
    <p className={`nhsapp-timeline__description ${className}`}>{children}</p>
);

const TimelineItem = ({
    status = TimelineStatus.Inactive,
    className = '',
    children,
}: TimelineItemProps): JSX.Element => (
    <li className={`nhsapp-timeline__item ${className}`}>
        {status === TimelineStatus.Active ? <ActiveBadge /> : <></>}
        {status === TimelineStatus.Inactive ? <InactiveBadge /> : <></>}
        <div className="nhsapp-timeline__content">{children}</div>
    </li>
);

const Timeline = ({ children }: TimelineProps): JSX.Element => (
    <ol className="nhsapp-timeline">{children}</ol>
);

Timeline.Item = TimelineItem;
Timeline.Description = TimelineDescription;
Timeline.Heading = TimelineHeading;

export default Timeline;
