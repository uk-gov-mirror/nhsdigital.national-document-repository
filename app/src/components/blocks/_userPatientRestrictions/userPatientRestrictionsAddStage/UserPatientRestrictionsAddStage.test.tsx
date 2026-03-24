import { render, screen } from '@testing-library/react';
import UserPatientRestrictionsAddStage from './UserPatientRestrictionsAddStage';

describe('UserPatientRestrictionsAddStage', () => {
    it('renders correctly', () => {
        render(<UserPatientRestrictionsAddStage />);

        expect(screen.getByText('Add user patient restriction')).toBeInTheDocument();
    });
});
