import { REPOSITORY_ROLE } from '../generic/authRole';
import { routeChildren, routes } from '../generic/routes';
import { LG_RECORD_STAGE } from './lloydGeorgeStages';

export enum RECORD_ACTION {
    UPDATE = 0,
    DOWNLOAD = 1,
    DELETE = 2,
}

type ActionRoute = routeChildren | routes;

export type LGRecordActionLink = {
    index: number;
    label: string;
    key: ACTION_LINK_KEY;
    stage?: LG_RECORD_STAGE;
    href?: ActionRoute;
    onClick?: () => void;
    type: RECORD_ACTION;
    unauthorised?: Array<REPOSITORY_ROLE>;
    showIfRecordInStorage: boolean;
    description?: string;
};

export enum ACTION_LINK_KEY {
    DOWNLOAD = 'download-files-link',
    DELETE = 'delete-files-link',
    REASSIGN = 'reassign-pages-link',
    ADD = 'add-files-link',
    HISTORY = 'view-document-history-link',
}
const RemoveAction: LGRecordActionLink = {
    index: 1,
    label: 'Remove this document',
    key: ACTION_LINK_KEY.DELETE,
    type: RECORD_ACTION.UPDATE,
    unauthorised: [REPOSITORY_ROLE.GP_CLINICAL],
    href: routeChildren.LLOYD_GEORGE_DELETE,
    showIfRecordInStorage: true,
    description: 'This action will remove all pages of this document from storage in this service.',
};

const DownloadAction: LGRecordActionLink = {
    index: 0,
    label: 'Download this document',
    key: ACTION_LINK_KEY.DOWNLOAD,
    type: RECORD_ACTION.DOWNLOAD,
    unauthorised: [],
    href: routeChildren.LLOYD_GEORGE_DOWNLOAD,
    showIfRecordInStorage: true,
};

export const AddAction = (label: string, onClick: () => void): LGRecordActionLink => {
    return {
        index: 2,
        label: label,
        key: ACTION_LINK_KEY.ADD,
        type: RECORD_ACTION.UPDATE,
        unauthorised: [],
        showIfRecordInStorage: true,
        onClick,
    };
};

export const ReassignAction = (label: string, onClick: () => void): LGRecordActionLink => {
    return {
        index: 3,
        label: label,
        key: ACTION_LINK_KEY.REASSIGN,
        type: RECORD_ACTION.UPDATE,
        unauthorised: [],
        onClick,
        showIfRecordInStorage: true,
    };
};

export const VersionHistoryAction = (
    label: string,
    description: string,
    onClick: () => void,
): LGRecordActionLink => {
    return {
        index: 4,
        label: label,
        key: ACTION_LINK_KEY.HISTORY,
        type: RECORD_ACTION.UPDATE, // This could be a different type if needed
        unauthorised: [],
        onClick,
        showIfRecordInStorage: true,
        description,
    };
};

export const lloydGeorgeRecordLinks: Array<LGRecordActionLink> = [RemoveAction, DownloadAction];

export type getLloydGeorgeRecordLinksProps = {
    key: ACTION_LINK_KEY;
    onClick: () => void;
};

export function getLloydGeorgeRecordLinks(
    mapper: getLloydGeorgeRecordLinksProps[],
): Array<LGRecordActionLink> {
    const lgRecordLinks: Array<LGRecordActionLink> = lloydGeorgeRecordLinks.map((link) => {
        const mappedLink = mapper.find((m) => m.key === link.key);
        if (mappedLink) {
            return { ...link, onClick: mappedLink.onClick };
        }
        return link;
    });
    return lgRecordLinks;
}

type Args = {
    role: REPOSITORY_ROLE | null;
    hasRecordInStorage: boolean;
    inputLinks: Array<LGRecordActionLink>;
};

export const getRecordActionLinksAllowedForRole = ({
    role,
    hasRecordInStorage,
    inputLinks,
}: Args): Array<LGRecordActionLink> => {
    const allowedLinks = inputLinks.filter((link) => {
        if (!role || link.unauthorised?.includes(role)) {
            return false;
        }
        return hasRecordInStorage === link.showIfRecordInStorage;
    });
    return allowedLinks;
};

type ArgsLink = Omit<Args, 'inputLinks'>;

export const getUserRecordActionLinks = ({
    role,
    hasRecordInStorage,
}: ArgsLink): Array<LGRecordActionLink> => {
    const allowedLinks = getRecordActionLinksAllowedForRole({
        role,
        hasRecordInStorage,
        inputLinks: lloydGeorgeRecordLinks,
    });

    return allowedLinks;
};
