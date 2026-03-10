import { render, screen } from '@testing-library/react';
import DocumentReassignSearchPatientStage from './DocumentReassignSearchPatientStage';

describe('DocumentReassignSearchPatientStage', () => {
    it('renders correctly', () => {
        render(<DocumentReassignSearchPatientStage />);

        expect(screen.getByText('Reassign search patient page')).toBeInTheDocument();
    });
});
