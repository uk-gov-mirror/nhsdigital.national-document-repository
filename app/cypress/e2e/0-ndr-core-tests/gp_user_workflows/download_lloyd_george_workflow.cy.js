import searchPatientPayload from '../../../fixtures/requests/GET_SearchPatient.json';
import { Roles } from '../../../support/roles';
import { routes } from '../../../support/routes';
import { formatNhsNumber } from '../../../../src/helpers/utils/formatNhsNumber';

const baseUrl = Cypress.config('baseUrl');

const verifyPatientPageTitle = 'Patient details - Access and store digital patient documents';

const testFile = {
    fileName: '1of1_lone_test_file.pdf',
    created: '2023-01-01T12:00:00Z',
    virusScannerResult: 'CLEAN',
    author: 'Y12345',
    id: 'mock-document-id-1',
    fileSize: 1024,
    version: '1',
    documentSnomedCodeType: '16521000000101',
    contentType: 'application/pdf',
};

describe('GP Workflow: View Lloyd George record', () => {
    const beforeEachConfiguration = (role) => {
        cy.login(role);
        cy.visit(routes.patientSearch);

        // search patient
        cy.intercept('GET', '/SearchPatient*', {
            statusCode: 200,
            body: searchPatientPayload,
        }).as('search');
        cy.getByTestId('nhs-number-input').type(searchPatientPayload.nhsNumber);
        cy.getByTestId('search-submit-btn').click();
        cy.wait('@search');

        cy.intercept('GET', '/SearchDocumentReferences*', {
            statusCode: 200,
            body: {
                references: [testFile],
                nextPageToken: 'abc',
            },
            delay: 1000,
        }).as('searchDocumentReferences');

        cy.intercept('GET', '/DocumentReview*', {
            statusCode: 200,
            body: {
                count: 0,
            },
        }).as('documentReview');

        cy.intercept('GET', `/DocumentReference/${testFile.id}*`, {
            statusCode: 200,
            body: {
                url: '/dev/testFile.pdf',
                contentType: 'application/pdf',
            },
        }).as('documentReference');
    };

    context('Download Lloyd George document', () => {
        it('GP user can download document', { tags: 'regression' }, () => {
            beforeEachConfiguration(Roles.GP_ADMIN);

            cy.title().should('eq', verifyPatientPageTitle);

            cy.get('#verify-submit').click();
            cy.url().should('contain', baseUrl + routes.patientDocuments);
            cy.contains('Loading...').should('be.visible');

            cy.wait('@searchDocumentReferences', { timeout: 30000 });
            cy.wait('@documentReview');

            cy.getByTestId('available-files-table-title', { timeout: 30000 }).should('be.visible');

            cy.getByTestId('view-0-link').click();

            cy.wait('@documentReference', { timeout: 30000 });

            cy.getByTestId('download-files-link', { timeout: 30000 }).should('be.visible');

            cy.getByTestId('download-files-link').click();

            // Assert contents of page after download
            cy.title({ timeout: 30000 }).should(
                'eq',
                'Download complete - Access and store digital patient documents',
            );
            cy.contains('Download complete').should('be.visible');

            const nhsNumberFormatted = formatNhsNumber(searchPatientPayload.nhsNumber);
            cy.contains(`NHS number: ${nhsNumberFormatted}`).should('be.visible');

            cy.readFile(`${Cypress.config('downloadsFolder')}/${testFile.fileName}`);
        });
    });
});
