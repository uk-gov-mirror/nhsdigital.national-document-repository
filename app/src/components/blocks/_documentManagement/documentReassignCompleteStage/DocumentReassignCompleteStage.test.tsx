import { render, screen } from '@testing-library/react';
import usePatient from '../../../../helpers/hooks/usePatient';
import { DOCUMENT_TYPE_CONFIG } from '../../../../helpers/utils/documentType';
import DocumentReassignCompleteStage from './DocumentReassignCompleteStage';
import { Mock } from 'vitest';
import { buildPatientDetails } from '../../../../helpers/test/testBuilders';
import { routes } from '../../../../types/generic/routes';

vi.mock('react-router-dom', () => ({
    useNavigate: (): Mock => mockNavigate,
    Link: ({ children }: { children: React.ReactNode }): React.JSX.Element => <div>{children}</div>,
}));
vi.mock('../../../../helpers/hooks/usePatient');

const mockUsePatient = usePatient as Mock;
const mockNavigate = vi.fn();

describe('DocumentReassignCompleteStage', () => {
    it('renders the correct title and patient details when matched is false', () => {
        const docConfig = { displayName: 'scanned paper notes' } as DOCUMENT_TYPE_CONFIG;
        mockUsePatient.mockReturnValue(buildPatientDetails());

        render(<DocumentReassignCompleteStage matched={false} docConfig={docConfig} />);

        expect(screen.getByTestId('page-title')).toHaveTextContent(
            `These pages have been removed from the ${docConfig.displayName} of:`,
        );
        expect(screen.getByTestId('patient-name')).toHaveTextContent('Patient name: Doe, John');
        expect(screen.getByTestId('nhs-number')).toHaveTextContent('NHS number: 900 000 0009');
        expect(screen.getByTestId('dob')).toHaveTextContent('Date of birth: 1 January 1970');
    });

    it('renders the correct title when matched is true', () => {
        render(
            <DocumentReassignCompleteStage matched={true} docConfig={{} as DOCUMENT_TYPE_CONFIG} />,
        );

        expect(screen.getByTestId('page-title')).toHaveTextContent(
            'These pages have been matched to the correct patient',
        );
    });

    it('navigates to the search patient page when the finish button is clicked', () => {
        render(
            <DocumentReassignCompleteStage matched={true} docConfig={{} as DOCUMENT_TYPE_CONFIG} />,
        );
        const finishButton = screen.getByTestId('finish-btn');
        finishButton.click();
        expect(mockNavigate).toHaveBeenCalledWith(routes.SEARCH_PATIENT, { replace: true });
    });
});
