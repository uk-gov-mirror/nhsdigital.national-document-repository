import { pdsPatients } from '../../../support/patients';
import dbItem from '../../../fixtures/dynamo-db-items/active-patient-h81109.json';
import { Roles } from '../../../support/roles';

const workspace = Cypress.env('WORKSPACE');
const lgTableName = `${workspace}_LloydGeorgeReferenceMetadata`;
const bucketName = `${workspace}-lloyd-george-store`;
const activePatient = pdsPatients.activeUpload;
const filePath = `${activePatient}/c165a49e-71b3-4662-8494-49c6b08070ba`;

const patientVerifyUrl = '/patient/verify';
const lloydGeorgeRecordUrl = '/patient/documents';
const selectOrderUrl = '/patient/document-upload/select-order';
const confirmationUrl = '/patient/document-upload/confirmation';

dbItem.FileLocation = dbItem.FileLocation.replace('{env}', workspace);

const uploadedFilePathNames = [
    'cypress/fixtures/lg-files/simple_pdf_pages/6.pdf',
    'cypress/fixtures/lg-files/simple_pdf_pages/7.pdf',
];
const uploadedFileNames = ['6', '7'];

describe('GP Workflow: Add additional scanned paper notes in correct order', () => {
    context('Add additional scanned paper notes in correct order', () => {
        beforeEach(() => {
            cy.deleteItemsBySecondaryKeyFromDynamoDb(
                lgTableName,
                'NhsNumberIndex',
                'NhsNumber',
                activePatient.toString(),
            );
            cy.addPdfFileToS3(bucketName, filePath, 'test_patient_record.pdf');
            cy.addItemToDynamoDb(lgTableName, dbItem);
        });

        afterEach(() => {
            //clean up any records present for the active patient
            cy.deleteItemsBySecondaryKeyFromDynamoDb(
                lgTableName,
                'NhsNumberIndex',
                'NhsNumber',
                activePatient.toString(),
            );
            cy.deleteFileFromS3(bucketName, filePath);
        });

        const roles = [Roles.SMOKE_GP_ADMIN, Roles.SMOKE_GP_CLINICAL];

        roles.forEach((role) => {
            it(
                `[Smoke] ${role} can add additional scanned paper notes and order is correct`,
                { tags: 'smoke', defaultCommandTimeout: 20000 },
                () => {
                    cy.smokeLogin(role);
                    cy.navigateToPatientSearchPage();

                    cy.get('#nhs-number-input').should('exist');
                    cy.get('#nhs-number-input').click();
                    cy.get('#nhs-number-input').type(activePatient);
                    cy.getByTestId('search-submit-btn').should('exist');
                    cy.getByTestId('search-submit-btn').click();
                    cy.url({ timeout: 15000 }).should('contain', patientVerifyUrl);

                    cy.get('#verify-submit').should('exist');
                    cy.get('#verify-submit').click();
                    cy.url().should('contain', lloydGeorgeRecordUrl);

                    cy.getByTestId('view-0-link').should('exist');
                    cy.getByTestId('view-0-link').click();

                    cy.getByTestId('add-files-link').should('exist');
                    cy.getByTestId('add-files-link').click();

                    uploadedFilePathNames.forEach((file) => {
                        cy.getByTestId('button-input').selectFile(file, { force: true });
                        var index = uploadedFilePathNames.indexOf(file);
                        cy.get('#selected-documents-table').should(
                            'contain',
                            uploadedFileNames[index],
                        );
                    });

                    cy.get('#continue-button').should('exist');
                    cy.get('#continue-button').click();
                    cy.url().should('contain', selectOrderUrl);

                    cy.get('#selected-documents-table').should('exist');
                    cy.get('#selected-documents-table').should(
                        'contain',
                        'Existing scanned paper notes',
                    );
                    uploadedFileNames.forEach((name) => {
                        cy.get('#selected-documents-table').should('contain', name);
                    });
                    cy.getByTestId('form-submit-button').should('exist').click();

                    cy.url().should('contain', confirmationUrl);
                    uploadedFileNames.forEach((name) => {
                        cy.get('#selected-16521000000101-table').should('contain', name);
                    });
                    cy.getByTestId('confirm-button').should('exist').click();

                    cy.getByTestId('upload-complete-page', { timeout: 25000 }).should('exist');
                    cy.getByTestId('upload-complete-card').should('be.visible');

                    cy.getByTestId('home-btn').should('exist');
                    cy.getByTestId('home-btn').eq(1).click();
                    cy.navigateToPatientSearchPage();

                    cy.get('#nhs-number-input').type(activePatient);
                    cy.get('#search-submit').click();
                    cy.get('.patient-results-form').should('exist');

                    cy.get('.patient-results-form').submit();

                    cy.getByTestId('view-0-link').should('exist');
                    cy.getByTestId('view-0-link').click();
                    cy.get('#pdf-viewer', { timeout: 20000 }).should('exist');

                    cy.getByTestId('pdf-viewer').should('be.visible');

                    cy.pdfViewerPageShouldBeText(7, '6');
                    cy.pdfViewerPageShouldBeText(8, '7');
                },
            );
        });
    });
});
