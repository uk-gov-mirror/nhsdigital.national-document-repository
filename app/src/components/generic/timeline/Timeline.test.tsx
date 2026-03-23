import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Timeline, { TimelineStatus } from './Timeline';

describe('Timeline', () => {
    it('renders an ordered list with the nhsapp-timeline class', () => {
        const { container } = render(
            <Timeline>
                <li>item</li>
            </Timeline>,
        );
        const ol = container.querySelector('ol.nhsapp-timeline');
        expect(ol).toBeInTheDocument();
    });

    it('renders its children', () => {
        render(
            <Timeline>
                <Timeline.Item>
                    <p>Hello</p>
                </Timeline.Item>
            </Timeline>,
        );
        expect(screen.getByText('Hello')).toBeInTheDocument();
    });
});

describe('Timeline.Item', () => {
    it('renders an <li> with nhsapp-timeline__item class', () => {
        const { container } = render(
            <ol>
                <Timeline.Item>content</Timeline.Item>
            </ol>,
        );
        expect(container.querySelector('li.nhsapp-timeline__item')).toBeInTheDocument();
    });

    it('renders the active badge (filled circle) when status is Active', () => {
        const { container } = render(
            <ol>
                <Timeline.Item status={TimelineStatus.Active}>content</Timeline.Item>
            </ol>,
        );
        const badge = container.querySelector('.nhsapp-timeline__badge');
        expect(badge).toBeInTheDocument();
        expect(badge).not.toHaveClass('nhsapp-timeline__badge--small');
    });

    it('renders the inactive badge (small hollow circle) when status is Inactive', () => {
        const { container } = render(
            <ol>
                <Timeline.Item status={TimelineStatus.Inactive}>content</Timeline.Item>
            </ol>,
        );
        const badge = container.querySelector('.nhsapp-timeline__badge--small');
        expect(badge).toBeInTheDocument();
    });

    it('renders no badge when status is None', () => {
        const { container } = render(
            <ol>
                <Timeline.Item status={TimelineStatus.None}>content</Timeline.Item>
            </ol>,
        );
        expect(container.querySelector('.nhsapp-timeline__badge')).not.toBeInTheDocument();
    });

    it('defaults to Inactive (small badge) when no status is provided', () => {
        const { container } = render(
            <ol>
                <Timeline.Item>content</Timeline.Item>
            </ol>,
        );
        expect(container.querySelector('.nhsapp-timeline__badge--small')).toBeInTheDocument();
    });

    it('applies additional className to the <li>', () => {
        const { container } = render(
            <ol>
                <Timeline.Item className="extra-class">content</Timeline.Item>
            </ol>,
        );
        expect(container.querySelector('li')).toHaveClass('extra-class');
    });

    it('wraps children in nhsapp-timeline__content div', () => {
        const { container } = render(
            <ol>
                <Timeline.Item>inner</Timeline.Item>
            </ol>,
        );
        expect(container.querySelector('.nhsapp-timeline__content')).toHaveTextContent('inner');
    });
});

describe('Timeline.Heading', () => {
    it('renders an <h3> with nhsapp-timeline__header class', () => {
        const { container } = render(<Timeline.Heading>My heading</Timeline.Heading>);
        expect(container.querySelector('h3.nhsapp-timeline__header')).toBeInTheDocument();
    });

    it('renders children text', () => {
        render(<Timeline.Heading>Version 3</Timeline.Heading>);
        expect(screen.getByText('Version 3')).toBeInTheDocument();
    });

    it('applies nhsuk-u-font-weight-bold when status is Active', () => {
        const { container } = render(
            <Timeline.Heading status={TimelineStatus.Active}>Active heading</Timeline.Heading>,
        );
        expect(container.querySelector('h3')).toHaveClass('nhsuk-u-font-weight-bold');
    });

    it('does not apply bold class when status is Inactive', () => {
        const { container } = render(
            <Timeline.Heading status={TimelineStatus.Inactive}>Inactive heading</Timeline.Heading>,
        );
        expect(container.querySelector('h3')).not.toHaveClass('nhsuk-u-font-weight-bold');
    });

    it('applies additional className to the heading', () => {
        const { container } = render(
            <Timeline.Heading className="nhsuk-heading-m">Heading</Timeline.Heading>,
        );
        expect(container.querySelector('h3')).toHaveClass('nhsuk-heading-m');
    });
});

describe('Timeline.Description', () => {
    it('renders a <p> with nhsapp-timeline__description class', () => {
        const { container } = render(<Timeline.Description>Some description</Timeline.Description>);
        expect(container.querySelector('p.nhsapp-timeline__description')).toBeInTheDocument();
    });

    it('renders children text', () => {
        render(<Timeline.Description>This is the current version</Timeline.Description>);
        expect(screen.getByText('This is the current version')).toBeInTheDocument();
    });

    it('applies additional className', () => {
        const { container } = render(
            <Timeline.Description className="extra">desc</Timeline.Description>,
        );
        expect(container.querySelector('p')).toHaveClass('extra');
    });
});
