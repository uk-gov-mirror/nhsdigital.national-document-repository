export type LocationParams<T> = {
    pathname: string;
    state: T | undefined;
    search: string;
    hash: string;
    key: string;
};
