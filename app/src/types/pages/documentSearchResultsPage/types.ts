import { SearchResult } from '../../generic/searchResult';

export enum SUBMISSION_STATE {
    INITIAL = 'INITIAL',
    PENDING = 'PENDING',
    SUCCEEDED = 'SUCCEEDED',
    FAILED = 'FAILED',
    BLOCKED = 'BLOCKED',
}

export enum SEARCH_AND_DOWNLOAD_STATE {
    INITIAL = 'INITIAL',
    SEARCH_PENDING = 'SEARCH_PENDING',
    SEARCH_SUCCEEDED = 'SEARCH_SUCCEEDED',
    DOWNLOAD_SELECTED = 'DOWNLOAD_SELECTED',
}

export type DocumentReference = SearchResult & {
    url?: string | null;
    isPdf?: boolean;
};
