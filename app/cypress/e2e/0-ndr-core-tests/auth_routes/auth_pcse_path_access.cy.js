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
    active: false,
    deceased: false,
    canManageRecord: false,
};

const baseUrl = Cypress.config('baseUrl');
const documentsUrl = '/patient/documents';

describe('PCSE user role has access to the expected GP_ADMIN workflow paths', () => {
    context('PCSE role has access to expected routes', () => {
        it('PCSE role has access to Download View', { tags: 'regression' }, () => {
            cy.intercept('GET', '/SearchPatient*', {
                statusCode: 200,
                body: patient,
            }).as('search');

            cy.intercept('GET', '/SearchDocumentReferences*', {
                statusCode: 200,
                body: [],
            }).as('documentSearch');

            cy.login(Roles.PCSE);

            cy.url().should('contain', baseUrl + routes.home);

            cy.navigateToPatientSearchPage();

            cy.get('#nhs-number-input').click();
            cy.get('#nhs-number-input').type(testPatient);
            cy.get('#search-submit').click();
            cy.wait('@search');

            cy.get('#verify-submit').click();

            cy.wait('@documentSearch');
            cy.url().should('contain', baseUrl + documentsUrl);
        });
    });
});

describe('PCSE user role cannot access document upload', () => {
    context('PCSE role has no access to document upload', () => {
        it('PCSE role cannot access document upload', { tags: 'regression' }, () => {
            cy.login(Roles.PCSE);
            cy.visit(routes.documentUpload);
            cy.url().should('include', 'unauthorised');
        });
    });
});
