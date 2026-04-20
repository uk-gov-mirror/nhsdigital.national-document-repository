import { Roles } from '../../../support/roles';
import dbItem1 from '../../../fixtures/dynamo-db-items/restore-data/active-patient-h81109-v1.json';
import dbItem2 from '../../../fixtures/dynamo-db-items/restore-data/active-patient-h81109-v2.json';

const workspace = Cypress.env('WORKSPACE');
dbItem1.FileLocation = dbItem1.FileLocation.replace('{env}', workspace);
dbItem2.FileLocation = dbItem2.FileLocation.replace('{env}', workspace);

const activePatient = '9730154708'; //9730154708,9730154376
const bucketName = `${workspace}-lloyd-george-store`;
const tableName = `${workspace}_LloydGeorgeReferenceMetadata`;
const fileName = `${activePatient}/c165a49e-71b3-4662-8494-49c6b08070ba`;

const patientVerifyUrl = '/patient/verify';
const documentViewUrl = '/patient/documents';

describe('GP Workflow: restore version history', () => {
    context('Version history button is visible on document view page', () => {
        beforeEach(() => {
            try {
                cy.addPdfFileToS3(bucketName, fileName, 'lg-files/simple_pdf_pages/6.pdf').then(
                    (v1Response) => {
                        dbItem1.S3VersionID = v1Response.VersionId;
                        cy.addPdfFileToS3(
                            bucketName,
                            fileName,
                            'lg-files/simple_pdf_pages/7.pdf',
                        ).then((v2Response) => {
                            dbItem2.S3VersionID = v2Response.VersionId;
                            cy.addItemToDynamoDb(tableName, dbItem1);
                            cy.addItemToDynamoDb(tableName, dbItem2);
                        });
                    },
                );
            } catch (error) {
                cy.log('Error in beforeEach setup:', error);
            }
        });

        afterEach(() => {
            cy.deleteAllFilesFromS3Prefix(bucketName, fileName);
            cy.deleteItemFromDynamoDb(tableName, dbItem1.ID);
            cy.deleteItemFromDynamoDb(tableName, dbItem2.ID);
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
