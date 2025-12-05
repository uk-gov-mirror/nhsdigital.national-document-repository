import { Roles } from '../../../support/roles';
import { routes } from '../../../support/routes';
import { DOCUMENT_TYPE } from '../../../../src/helpers/utils/documentType';

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
};

const baseUrl = Cypress.config('baseUrl');
const lloydGeorgeViewUrl = '/patient/lloyd-george-record';
const documentsUrl = '/patient/documents';

const forbiddenRoutes = [lloydGeorgeViewUrl];

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

            cy.url().should('eq', baseUrl + routes.home);

            cy.navigateToPatientSearchPage();

            cy.get('#nhs-number-input').click();
            cy.get('#nhs-number-input').type(testPatient);
            cy.get('#search-submit').click();
            cy.wait('@search');

            cy.get('#verify-submit').click();

            cy.wait('@documentSearch');
            cy.url().should('eq', baseUrl + documentsUrl);
        });
    });
});

describe('PCSE user role cannot access expected forbidden routes', () => {
    context('PCSE role has no access to forbidden routes', () => {
        forbiddenRoutes.forEach((forbiddenRoute) => {
            it('PCSE role cannot access route' + forbiddenRoute, { tags: 'regression' }, () => {
                cy.login(Roles.PCSE);
                cy.visit(forbiddenRoute);
                cy.url().should('include', 'unauthorised');
            });
        });
    });
});
