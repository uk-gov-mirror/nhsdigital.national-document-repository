import { JSX } from 'react';

export const parseTextWithLinks = (text: string): JSX.Element => {
    const markdownLinkRegex = /\[([^\]]+)]\(([^)]+)\)/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    let match = markdownLinkRegex.exec(text);

    while (match !== null) {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }

        const linkText = match[1];
        const linkUrl = match[2];
        parts.push(
            <a
                key={match.index}
                href={linkUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`${linkText} - this link will open in a new tab`}
            >
                {linkText}
            </a>,
        );

        lastIndex = match.index + match[0].length;
        match = markdownLinkRegex.exec(text);
    }

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }
    return <>{parts}</>;
};

export default parseTextWithLinks;
