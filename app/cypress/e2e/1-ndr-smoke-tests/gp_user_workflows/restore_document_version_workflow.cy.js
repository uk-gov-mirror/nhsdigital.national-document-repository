import { Roles } from '../../../support/roles';
import dbItem from '../../../fixtures/dynamo-db-items/active-patient-h81109.json';

const workspace = Cypress.env('WORKSPACE');
dbItem.FileLocation = dbItem.FileLocation.replace('{env}', workspace);
const activePatient = 9730154708; //9730154708,9730154376
const bucketName = `${workspace}-lloyd-george-store`;
const tableName = `${workspace}_LloydGeorgeReferenceMetadata`;
const fileName = `${activePatient}/e4a6d7f7-01f3-44be-8964-515b2c0ec180`;

const patientVerifyUrl = '/patient/verify';
const documentViewUrl = '/patient/documents';

// inital test works if you prepopulate the data need to sort out populating database
describe.skip('GP Workflow: restore version history', () => {
    context('Version history button is visible on document view page', () => {
        beforeEach(() => {
            cy.deleteFileFromS3(bucketName, fileName);
            cy.deleteItemFromDynamoDb(tableName, dbItem.ID);
            cy.addPdfFileToS3(bucketName, fileName, 'test_patient_record.pdf');
            cy.addItemToDynamoDb(tableName, dbItem);
        });

        afterEach(() => {
            cy.deleteFileFromS3(bucketName, fileName);
            cy.deleteItemFromDynamoDb(tableName, dbItem.ID);
        });

        it(
            '[Smoke] GP ADMIN user can see the version history button on the document view page',
            { tags: 'smoke', defaultCommandTimeout: 20000 },
            () => {
                cy.smokeLogin(Roles.SMOKE_GP_ADMIN, 'H81109');
                cy.get('.nhsuk-navigation-container').should('exist');
                cy.navigateToPatientSearchPage();
                cy.get('#nhs-number-input').click();
                cy.get('#nhs-number-input').type(activePatient);
                cy.getByTestId('search-submit-btn').should('exist');
                cy.getByTestId('search-submit-btn').click();

                cy.url({ timeout: 15000 }).should('contain', patientVerifyUrl);
                cy.get('#verify-submit').should('exist');
                cy.get('#verify-submit').click();

                cy.url().should('contain', documentViewUrl);

                cy.getByTestId('view-0-link', { timeout: 30000 }).should('exist');
                cy.getByTestId('view-0-link').click();

                cy.getByTestId('pdf-viewer', { timeout: 30000 }).should('be.visible');

                cy.getByTestId('view-document-history-link').should('exist');
                cy.getByTestId('view-document-history-link').click();

                cy.url({ timeout: 15000 }).should('contain', '/patient/documents/version-history');
            },
        );
    });
});
