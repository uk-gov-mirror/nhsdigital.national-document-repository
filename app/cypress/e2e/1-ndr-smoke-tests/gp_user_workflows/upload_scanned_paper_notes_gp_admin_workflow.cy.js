import { pdsPatients } from '../../../support/patients';
import { Roles } from '../../../support/roles';

const workspace = Cypress.env('WORKSPACE');

const uploadedFilePathNames = [
    'cypress/fixtures/lg-files/zenia_lees/1of3_Lloyd_George_Record_[Zenia Ellisa LEES]_[9730153930]_[20-03-1929].pdf',
    'cypress/fixtures/lg-files/zenia_lees/2of3_Lloyd_George_Record_[Zenia Ellisa LEES]_[9730153930]_[20-03-1929].pdf',
    'cypress/fixtures/lg-files/zenia_lees/3of3_Lloyd_George_Record_[Zenia Ellisa LEES]_[9730153930]_[20-03-1929].pdf',
];
const uploadedFileNames = [
    '1of3_Lloyd_George_Record_[Zenia Ellisa LEES]_[9730153930]_[20-03-1929].pdf',
    '2of3_Lloyd_George_Record_[Zenia Ellisa LEES]_[9730153930]_[20-03-1929].pdf',
    '3of3_Lloyd_George_Record_[Zenia Ellisa LEES]_[9730153930]_[20-03-1929].pdf',
];

const bucketName = `${workspace}-lloyd-george-store`;
const referenceTableName = `${workspace}_LloydGeorgeReferenceMetadata`;
const stitchTableName = `${workspace}_LloydGeorgeStitchJobMetadata`;

const patientVerifyUrl = '/patient/verify';
const lloydGeorgeRecordUrl = '/patient/documents';
const selectOrderUrl = '/patient/document-upload/select-order';
const confirmationUrl = '/patient/document-upload/confirmation';

const activePatient = pdsPatients.activeNoUpload;

describe('GP Workflow: Upload Lloyd George record', () => {
    context('Upload a Lloyd George document', () => {
        beforeEach(() => {
            //delete any records present for the active patient
            cy.deleteItemsBySecondaryKeyFromDynamoDb(
                referenceTableName,
                'NhsNumberIndex',
                'NhsNumber',
                activePatient.toString(),
            );
            cy.deleteItemsBySecondaryKeyFromDynamoDb(
                stitchTableName,
                'NhsNumberIndex',
                'NhsNumber',
                activePatient.toString(),
            );
            uploadedFileNames.forEach((file) => {
                cy.deleteFileFromS3(bucketName, file);
            });
        });

        afterEach(() => {
            //clean up any records present for the active patient
            cy.deleteItemsBySecondaryKeyFromDynamoDb(
                referenceTableName,
                'NhsNumberIndex',
                'NhsNumber',
                activePatient.toString(),
            );
            cy.deleteItemsBySecondaryKeyFromDynamoDb(
                stitchTableName,
                'NhsNumberIndex',
                'NhsNumber',
                activePatient.toString(),
            );
            uploadedFileNames.forEach((file) => {
                cy.deleteFileFromS3(bucketName, file);
            });
        });

        it(
            '[Smoke] GP ADMIN can upload multiple files and then view a Lloyd George record for an active patient with no record',
            { tags: 'smoke', defaultCommandTimeout: 20000 },
            () => {
                cy.smokeLogin(Roles.SMOKE_GP_ADMIN);

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
                cy.get('#no-files-message').should(
                    'include.text',
                    'There are no documents available for this patient.',
                );
                cy.getByTestId('upload-button').should('exist');
                cy.getByTestId('upload-button').click();

                cy.getByTestId('upload-16521000000101-link').should('exist');
                cy.getByTestId('upload-16521000000101-link').click();
                uploadedFilePathNames.forEach((file) => {
                    cy.getByTestId('button-input').selectFile(file, { force: true });
                    var index = uploadedFilePathNames.indexOf(file);
                    cy.get('#selected-documents-table').should('contain', uploadedFileNames[index]);
                });
                cy.get('#continue-button').click();

                cy.url().should('contain', selectOrderUrl);
                cy.get('#selected-documents-table').should('exist');
                uploadedFileNames.forEach((name) => {
                    cy.get('#selected-documents-table').should('contain', name);
                });
                cy.getByTestId('form-submit-button').click();

                cy.url().should('contain', confirmationUrl);
                uploadedFileNames.forEach((name) => {
                    cy.get('#selected-16521000000101-table').should('contain', name);
                });
                cy.getByTestId('confirm-button').click();

                cy.getByTestId('upload-complete-page', { timeout: 25000 }).should('exist');

                cy.getByTestId('upload-complete-card').should('be.visible');

                cy.getByTestId('home-btn').eq(1).click();

                cy.navigateToPatientSearchPage();

                cy.get('#nhs-number-input').type(activePatient);
                cy.get('#search-submit').click();
                cy.get('.patient-results-form').should('exist');

                cy.get('.patient-results-form').submit();

                cy.getByTestId('view-0-link').should('exist');
                cy.getByTestId('view-0-link').click();

                cy.get('#pdf-viewer', { timeout: 20000 }).should('exist');
            },
        );
    });
});
