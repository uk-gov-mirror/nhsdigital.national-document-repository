import { render, screen } from '@testing-library/react';
import RecordMenuCard from './RecordMenuCard';
import useRole from '../../../helpers/hooks/useRole';
import { LGRecordActionLink, RECORD_ACTION } from '../../../types/blocks/lloydGeorgeActions';
import { REPOSITORY_ROLE } from '../../../types/generic/authRole';
import { LinkProps } from 'react-router-dom';
import { LG_RECORD_STAGE } from '../../../types/blocks/lloydGeorgeStages';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi, Mock } from 'vitest';

vi.mock('../../../helpers/hooks/useRole');
const mockSetStage = vi.fn();
const mockedUseNavigate = vi.fn();
const mockedUseRole = useRole as Mock;

const mockLinks: Array<LGRecordActionLink> = [
    {
        index: 1,
        label: 'Remove files',
        key: 'delete-all-files-link',
        type: RECORD_ACTION.UPDATE,
        stage: LG_RECORD_STAGE.DELETE_ALL,
        unauthorised: [REPOSITORY_ROLE.GP_CLINICAL],
        showIfRecordInStorage: true,
    },
    {
        index: 0,
        label: 'Download files',
        key: 'download-all-files-link',
        type: RECORD_ACTION.DOWNLOAD,
        stage: LG_RECORD_STAGE.DOWNLOAD_ALL,
        unauthorised: [],
        showIfRecordInStorage: true,
    },
];

vi.mock('react-router-dom', () => ({
    Link: (props: LinkProps): React.JSX.Element => <a {...props} role="link" />,
    useNavigate: (): Mock => mockedUseNavigate,
}));

describe('RecordMenuCard', () => {
    beforeEach(() => {
        import.meta.env.VITE_ENVIRONMENT = 'vitest';
        mockedUseRole.mockReturnValue(REPOSITORY_ROLE.GP_ADMIN);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('renders menu', () => {
            render(
                <RecordMenuCard setStage={mockSetStage} recordLinks={mockLinks} showMenu={true} />,
            );
            expect(screen.getByRole('link', { name: 'Remove files' })).toBeInTheDocument();
            expect(screen.getByRole('link', { name: 'Download files' })).toBeInTheDocument();
        });

        it('does not render a sub-section if no record links were under that section', () => {
            const mockLinksUpdateOnly = mockLinks.filter(
                (link) => link.type === RECORD_ACTION.UPDATE,
            );

            const { rerender } = render(
                <RecordMenuCard
                    setStage={mockSetStage}
                    recordLinks={mockLinksUpdateOnly}
                    showMenu={true}
                />,
            );
            expect(screen.getByRole('link', { name: 'Remove files' })).toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'Download files' })).not.toBeInTheDocument();

            const mockLinksDownloadOnly = mockLinks.filter(
                (link) => link.type === RECORD_ACTION.DOWNLOAD,
            );
            rerender(
                <RecordMenuCard
                    setStage={mockSetStage}
                    recordLinks={mockLinksDownloadOnly}
                    showMenu={true}
                />,
            );
            expect(screen.getByRole('link', { name: 'Download files' })).toBeInTheDocument();

            expect(screen.queryByRole('link', { name: 'Remove files' })).not.toBeInTheDocument();
        });

        it('does not render anything if the given record links array is empty', () => {
            const { container } = render(
                <RecordMenuCard setStage={mockSetStage} recordLinks={[]} showMenu={false} />,
            );
            expect(container).toBeEmptyDOMElement();
        });

        it('Does not render the MenuCard if showMenu is false', () => {
            const { container } = render(
                <RecordMenuCard setStage={mockSetStage} recordLinks={mockLinks} showMenu={false} />,
            );
            expect(container).toBeEmptyDOMElement();
        });
    });

    describe('Navigation', () => {
        it('change stage when clicked', async () => {
            render(
                <RecordMenuCard setStage={mockSetStage} recordLinks={mockLinks} showMenu={true} />,
            );
            expect(screen.getByRole('link', { name: 'Remove files' })).toBeInTheDocument();

            await userEvent.click(screen.getByRole('link', { name: 'Remove files' }));
            expect(mockSetStage).toHaveBeenCalledWith(LG_RECORD_STAGE.DELETE_ALL);
        });
    });
});
