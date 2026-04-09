import { render, screen } from '@testing-library/react';
import UserPatientRestrictionsAddCancelStage from './UserPatientRestrictionsAddCancelStage';
import userEvent from '@testing-library/user-event';
import { Mock } from 'vitest';
import { routes } from '../../../../types/generic/routes';

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: (): Mock => mockNavigate,
        Link: ({
            children,
            onClick,
            'data-testid': dataTestId,
        }: {
            children: React.ReactNode;
            onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
            'data-testid': string;
        }): React.JSX.Element => (
            <button onClick={onClick} data-testid={dataTestId}>
                {children}
            </button>
        ),
    };
});
vi.mock('../../../../helpers/hooks/usePatient');

const mockNavigate = vi.fn();

describe('UserPatientRestrictionsAddCancelStage', () => {
    it('navigates to restrictions root page when continue is clicked', async () => {
        render(<UserPatientRestrictionsAddCancelStage />);

        const continueButton = screen.getByTestId('confirm-cancel-button');
        await userEvent.click(continueButton);

        expect(mockNavigate).toHaveBeenCalledWith(routes.USER_PATIENT_RESTRICTIONS);
    });

    it('navigates back when go back is clicked', async () => {
        render(<UserPatientRestrictionsAddCancelStage />);

        const goBackLink = screen.getByTestId('go-back-link');
        await userEvent.click(goBackLink);

        expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
});
