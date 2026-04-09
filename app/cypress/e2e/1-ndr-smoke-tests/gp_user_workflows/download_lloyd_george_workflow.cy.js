import { Roles } from '../../../support/roles';
import dbItem from '../../../fixtures/dynamo-db-items/active-patient-m85143.json';
import { formatNhsNumber } from '../../../../src/helpers/utils/formatNhsNumber';

const workspace = Cypress.env('WORKSPACE');
dbItem.FileLocation = dbItem.FileLocation.replace('{env}', workspace);
const activePatient = 9730786933;
const bucketName = `${workspace}-lloyd-george-store`;
const tableName = `${workspace}_LloydGeorgeReferenceMetadata`;
const fileName = `${activePatient}/e4a6d7f7-01f3-44be-8964-515b2c0ec180`;

const patientVerifyUrl = '/patient/verify';
const patientDocumentsUrl = '/patient/documents';

describe('GP Workflow: View Lloyd George record', () => {
    context('Download Lloyd George document', () => {
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
            '[Smoke] GP ADMIN user can download the Lloyd George document of an active patient',
            { tags: 'smoke', defaultCommandTimeout: 20000 },
            () => {
                cy.smokeLogin(Roles.SMOKE_GP_ADMIN, 'M85143');
                cy.get('.nhsuk-navigation-container').should('exist');
                cy.navigateToPatientSearchPage();
                cy.get('#nhs-number-input').click();
                cy.get('#nhs-number-input').type(activePatient);
                cy.get('#search-submit').click();

                cy.url().should('contain', patientVerifyUrl);
                cy.get('#verify-submit').click();

                cy.url().should('contain', patientDocumentsUrl);
                cy.contains('Loading...').should('be.visible');

                cy.getByTestId('available-files-table-title', { timeout: 30000 }).should(
                    'be.visible',
                );

                cy.getByTestId('view-0-link').click();
                cy.contains('Loading document').should('be.visible');

                cy.getByTestId('download-files-link', { timeout: 30000 }).should('be.visible');

                cy.getByTestId('download-files-link').click();

                // Assert contents of page after download
                cy.title({ timeout: 30000 }).should(
                    'eq',
                    'Download complete - Access and store digital patient documents',
                );
                cy.contains('Download complete').should('be.visible');

                const nhsNumberFormatted = formatNhsNumber(activePatient.toString());
                cy.contains(`NHS number: ${nhsNumberFormatted}`).should('be.visible');

                cy.readFile(`${Cypress.config('downloadsFolder')}/test_patient_record.pdf`);

                cy.getByTestId('logout-btn').click();
                cy.url({ timeout: 10000 }).should('eq', Cypress.config('baseUrl') + '/');
                cy.get('.nhsuk-navigation-container').should('not.exist');
            },
        );
    });
});
