import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import parseTextWithLinks from './parseTextWithLinks';

describe('parseTextWithLinks', () => {
    describe('Basic functionality', () => {
        it('parses text with a single markdown link', () => {
            const text = 'Click [here](https://example.com) to continue';
            const result = render(parseTextWithLinks(text));

            const link = result.container.querySelector('a');
            expect(link).not.toBeNull();
            expect(link?.href).toBe('https://example.com/');
            expect(link?.textContent).toBe('here');
            expect(link?.target).toBe('_blank');
            expect(link?.rel).toBe('noreferrer');
            expect(link?.getAttribute('aria-label')).toBe(
                'here - this link will open in a new tab',
            );
        });

        it('parses text with multiple markdown links', () => {
            const text = 'Visit [Home](https://home.com) or [NHS](https://nhs.uk) for info';
            const result = render(parseTextWithLinks(text));

            const links = result.container.querySelectorAll('a');
            expect(links).toHaveLength(2);

            expect(links[0]?.href).toBe('https://home.com/');
            expect(links[0]?.textContent).toBe('Home');

            expect(links[1]?.href).toBe('https://nhs.uk/');
            expect(links[1]?.textContent).toBe('NHS');
        });

        it('preserves text before, between, and after links', () => {
            const text = 'Start [link1](url1) middle [link2](url2) end';
            const result = render(parseTextWithLinks(text));

            expect(result.container.textContent).toBe('Start link1 middle link2 end');
        });

        it('returns plain text when no markdown links are present', () => {
            const text = 'This is plain text without any links';
            const result = render(parseTextWithLinks(text));

            expect(result.container.querySelector('a')).toBeNull();
            expect(result.container.textContent).toBe(text);
        });
    });

    describe('Edge cases', () => {
        it('handles empty string', () => {
            const text = '';
            const result = render(parseTextWithLinks(text));

            expect(result.container.textContent).toBe('');
            expect(result.container.querySelector('a')).toBeNull();
        });

        it('handles text with only a markdown link', () => {
            const text = '[Click here](https://example.com)';
            const result = render(parseTextWithLinks(text));

            const link = result.container.querySelector('a');
            expect(link).not.toBeNull();
            expect(link?.textContent).toBe('Click here');
            expect(result.container.textContent).toBe('Click here');
        });

        it('handles consecutive markdown links', () => {
            const text = '[Link1](url1)[Link2](url2)';
            const result = render(parseTextWithLinks(text));

            const links = result.container.querySelectorAll('a');
            expect(links).toHaveLength(2);
            expect(result.container.textContent).toBe('Link1Link2');
        });

        it('handles markdown link at the start', () => {
            const text = '[Start link](url) followed by text';
            const result = render(parseTextWithLinks(text));

            expect(result.container.textContent).toBe('Start link followed by text');
            expect(result.container.querySelector('a')?.textContent).toBe('Start link');
        });

        it('handles markdown link at the end', () => {
            const text = 'Text followed by [end link](url)';
            const result = render(parseTextWithLinks(text));

            expect(result.container.textContent).toBe('Text followed by end link');
            expect(result.container.querySelector('a')?.textContent).toBe('end link');
        });

        it('handles special characters in URL', () => {
            const text = 'Visit [NHS](https://nhs.uk/conditions?query=test&page=1)';
            const result = render(parseTextWithLinks(text));

            const link = result.container.querySelector('a');
            expect(link?.href).toBe('https://nhs.uk/conditions?query=test&page=1');
        });

        it('handles URLs with fragments', () => {
            const text = 'Go to [section](https://example.com#section-1)';
            const result = render(parseTextWithLinks(text));

            const link = result.container.querySelector('a');
            expect(link?.href).toBe('https://example.com/#section-1');
        });

        it('handles relative URLs', () => {
            const text = 'See [documentation](./docs/readme.md)';
            const result = render(parseTextWithLinks(text));

            const link = result.container.querySelector('a');
            expect(link).not.toBeNull();
            expect(link?.textContent).toBe('documentation');
        });

        it('does not parse incomplete markdown links - missing closing bracket', () => {
            const text = 'This is [incomplete link(url) text';
            const result = render(parseTextWithLinks(text));

            expect(result.container.querySelector('a')).toBeNull();
            expect(result.container.textContent).toBe(text);
        });

        it('does not parse incomplete markdown links - missing closing parenthesis', () => {
            const text = 'This is [text](incomplete url text';
            const result = render(parseTextWithLinks(text));

            expect(result.container.querySelector('a')).toBeNull();
            expect(result.container.textContent).toBe(text);
        });

        it('handles text inbetween text and link', () => {
            const text = 'Check this link: [example] text (https://example.com)';
            const result = render(parseTextWithLinks(text));

            const link = result.container.querySelector('a');
            expect(link).toBeNull();
        });
    });
});
