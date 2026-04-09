import { Roles } from '../../../support/roles';
import { routes } from '../../../support/routes';

const testPatient = '9000000009';
const patient = {
    birthDate: '1970-01-01',
    familyName: 'Default Surname',
    givenName: ['Default Given Name'],
    nhsNumber: testPatient,
    postalCode: 'AA1 1AA',
    superseded: false,
    restricted: false,
    active: true,
    deceased: false,
    canManageRecord: true,
};

const baseUrl = Cypress.config('baseUrl');
const patientVerifyUrl = '/patient/verify';

describe('GP Admin user role has access to the expected GP_ADMIN workflow paths', () => {
    context('GP Admin role has access to expected routes', () => {
        it('GP Admin role has access to patient documents', { tags: 'regression' }, () => {
            cy.intercept('GET', '/SearchPatient*', {
                statusCode: 200,
                body: patient,
            }).as('search');
            cy.intercept('GET', '/SearchDocumentReferences*', {
                statusCode: 200,
                body: { references: [] },
            }).as('searchDocumentReferences');

            cy.login(Roles.GP_ADMIN);

            cy.url().should('contain', baseUrl + routes.home);

            cy.navigateToPatientSearchPage();

            cy.url().should('contain', baseUrl + routes.patientSearch);

            cy.get('#nhs-number-input').click();
            cy.get('#nhs-number-input').type(testPatient);
            cy.get('#search-submit').click();
            cy.wait('@search');

            cy.url().should('include', 'verify');
            cy.url().should('contain', baseUrl + patientVerifyUrl);

            cy.get('#verify-submit').click();

            cy.url().should('contain', baseUrl + routes.patientDocuments);
        });
    });
});
