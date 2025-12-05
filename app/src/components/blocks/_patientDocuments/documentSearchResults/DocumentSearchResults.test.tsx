import { buildSearchResult, buildUserAuth } from '../../../../helpers/test/testBuilders';
import { SearchResult } from '../../../../types/generic/searchResult';
import DocumentSearchResults from './DocumentSearchResults';
import { render, screen, waitFor, within } from '@testing-library/react';
import { runAxeTest } from '../../../../helpers/test/axeTestHelper';
import { describe, expect, it } from 'vitest';
import SessionProvider, { Session } from '../../../../providers/sessionProvider/SessionProvider';
import { getFormattedDate } from '../../../../helpers/utils/formatDate';

describe('DocumentSearchResults', () => {
    const mockDetails = buildSearchResult();

    const mockSearchResults: Array<SearchResult> = [mockDetails];

    it('renders provided search results information', async () => {
        renderPage(mockSearchResults);

        expect(
            screen.getByText('Records and documents stored for this patient'),
        ).toBeInTheDocument();

        let searchResults: HTMLElement[] = [];
        await waitFor(() => {
            searchResults = screen.getAllByTestId('search-result');
        });

        const mappedResults = searchResults.map((result) => ({
            filename: within(result).getByTestId('filename').textContent,
            created: within(result).getByTestId('created').textContent,
        }));

        expect(mappedResults).toEqual([
            {
                created: `Date uploaded ${getFormattedDate(new Date(mockDetails.created))}`,
                filename: `Filename ${mockDetails.fileName}`,
            },
        ]);
    });

    it('pass accessibility checks', async () => {
        renderPage(mockSearchResults);
        await screen.findByText(mockDetails.fileName);

        const results = await runAxeTest(document.body);
        expect(results).toHaveNoViolations();
    });
});

const renderPage = (searchResults: Array<SearchResult>): void => {
    const session: Session = {
        auth: buildUserAuth(),
        isLoggedIn: true,
    };
    render(
        <SessionProvider sessionOverride={session}>
            <DocumentSearchResults searchResults={searchResults} />
        </SessionProvider>,
    );
};
