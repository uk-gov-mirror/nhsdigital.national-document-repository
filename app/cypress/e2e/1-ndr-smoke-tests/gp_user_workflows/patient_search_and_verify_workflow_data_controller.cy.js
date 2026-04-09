import { Roles, roleName } from '../../../support/roles';

describe('GP Workflow: Patient search and verify', () => {
    // env vars
    const baseUrl = Cypress.config('baseUrl');
    const gpRoles = [Roles.SMOKE_GP_ADMIN, Roles.SMOKE_GP_CLINICAL];
    const activePatient = 9730786933;
    const patientVerifyUrl = '/patient/verify';
    const patientDocumentsUrl = '/patient/documents';

    gpRoles.forEach((role) => {
        it(
            `[Smoke] Shows the Lloyd george view page when patient is verified and active as a ${roleName(
                role,
            )} `,
            { tags: 'smoke' },
            () => {
                cy.smokeLogin(role, 'M85143');

                cy.navigateToPatientSearchPage();

                cy.get('#nhs-number-input').click();
                cy.get('#nhs-number-input').type(activePatient);
                cy.get('#search-submit').click();

                cy.url({ timeout: 20000 }).should('contain', baseUrl + patientVerifyUrl);
                cy.get('#verify-submit').click();

                cy.url({ timeout: 10000 }).should('contain', baseUrl + patientDocumentsUrl);
            },
        );
    });
});
