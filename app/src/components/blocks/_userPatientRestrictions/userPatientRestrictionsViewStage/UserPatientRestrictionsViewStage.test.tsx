import { render, screen } from '@testing-library/react';
import UserPatientRestrictionsViewStage from './UserPatientRestrictionsViewStage';

describe('UserPatientRestrictionsViewStage', () => {
    it('renders correctly', () => {
        render(<UserPatientRestrictionsViewStage />);

        expect(screen.getByText('viewing user patient restrictions')).toBeInTheDocument();
    });
});
