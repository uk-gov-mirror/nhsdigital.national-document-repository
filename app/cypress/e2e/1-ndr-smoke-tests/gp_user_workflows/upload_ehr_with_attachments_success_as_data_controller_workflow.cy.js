import { pdsPatients } from '../../../support/patients';
import dbItem from '../../../fixtures/dynamo-db-items/active-patient-h81109.json';
import { Roles } from '../../../support/roles';

const workspace = Cypress.env('WORKSPACE');
const lgTableName = `${workspace}_LloydGeorgeReferenceMetadata`;
const bucketName = `${workspace}-lloyd-george-store`;
const activePatient = pdsPatients.activeUpload;
const filePath = `${activePatient}/`;

const patientVerifyUrl = '/patient/verify';
const lloydGeorgeRecordUrl = '/patient/documents';
const documentUploadUrl = '/patient/document-upload';
const selectFilesUrl = '/patient/document-upload/select-files';
const confirmationUrl = '/patient/document-upload/confirmation';

dbItem.FileLocation = dbItem.FileLocation.replace('{env}', workspace);

const uploadedEhrFilePathName = 'cypress/fixtures/lg-files/simple_pdf_pages/6.pdf';
const uploadedEhrFileName = '6.pdf';

const uploadedEhrAttachmentsFilePathNames = [
    'cypress/fixtures/non-pdf-files/1.csv',
    'cypress/fixtures/non-pdf-files/2.txt',
];
const uploadedEhrAttachmentsFileNames = ['1.csv', '2.txt'];

const expectedRows = [
    {
        type: 'Electronic health record',
        filename: uploadedEhrFileName,
    },
    {
        type: 'Electronic health record attachments',
        filename: 'EHR_Attachments_(2).zip',
    },
];

describe('GP Workflow: Upload EHR with attachments and view them successfully as data controller', () => {
    context('Upload EHR with attachments and view them successfully as data controller', () => {
        beforeEach(() => {
            cy.deleteItemsBySecondaryKeyFromDynamoDb(
                lgTableName,
                'NhsNumberIndex',
                'NhsNumber',
                activePatient.toString(),
            );
        });

        afterEach(() => {
            cy.deleteItemsBySecondaryKeyFromDynamoDb(
                lgTableName,
                'NhsNumberIndex',
                'NhsNumber',
                activePatient.toString(),
            );
            cy.deleteAllFilesFromS3Prefix(bucketName, filePath);
        });

        const roles = [Roles.SMOKE_GP_ADMIN, Roles.SMOKE_GP_CLINICAL];

        roles.forEach((role) => {
            it(
                `[Smoke] ${role} can upload EHR with attachments and view them successfully`,
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

                    cy.getByTestId('upload-button').click();
                    cy.url().should('contain', documentUploadUrl);

                    cy.getByTestId('upload-717301000000104-link').should('exist');
                    cy.getByTestId('upload-717301000000104-link').click();
                    cy.url().should('contain', selectFilesUrl);

                    cy.getByTestId('button-input').selectFile(uploadedEhrFilePathName, {
                        force: true,
                    });
                    cy.get('#selected-documents-table').should('contain', uploadedEhrFileName);

                    cy.get('#continue-button').should('exist');
                    cy.get('#continue-button').click();
                    cy.url().should('contain', selectFilesUrl);

                    uploadedEhrAttachmentsFilePathNames.forEach((file) => {
                        cy.getByTestId('button-input').selectFile(file, { force: true });
                        var index = uploadedEhrAttachmentsFilePathNames.indexOf(file);
                        cy.get('#selected-documents-table').should(
                            'contain',
                            uploadedEhrAttachmentsFileNames[index],
                        );
                    });

                    cy.get('#continue-button').should('exist');
                    cy.get('#continue-button').click();
                    cy.url().should('contain', confirmationUrl);
                    cy.get('#selected-717301000000104-table').should(
                        'contain',
                        uploadedEhrFileName,
                    );
                    uploadedEhrAttachmentsFileNames.forEach((file) => {
                        var index = uploadedEhrAttachmentsFileNames.indexOf(file);
                        cy.get('#selected-24511000000107-table').should(
                            'contain',
                            uploadedEhrAttachmentsFileNames[index],
                        );
                    });
                    cy.getByTestId('confirm-button').should('exist').click();

                    cy.getByTestId('upload-complete-page').should('exist');
                    cy.getByTestId('upload-complete-card').should('be.visible');

                    cy.getByTestId('home-btn').should('exist');
                    cy.getByTestId('home-btn').eq(1).click();
                    cy.navigateToPatientSearchPage();

                    cy.get('#nhs-number-input').type(activePatient);
                    cy.get('#search-submit').click();
                    cy.get('.patient-results-form').should('exist');
                    cy.get('.patient-results-form').submit();

                    cy.getByTestId('available-files-table-title').should('exist');

                    cy.get('[data-testid="search-result"]').should(
                        'have.length',
                        expectedRows.length,
                    );

                    expectedRows.forEach((row, index) => {
                        cy.get('[data-testid="search-result"]')
                            .eq(index)
                            .within(() => {
                                cy.get('[data-testid="doctype"]').should('contain.text', row.type);
                                cy.get('[data-testid="filename"]').should(
                                    'contain.text',
                                    row.filename,
                                );
                                cy.get('[data-testid^="view-"]')
                                    .should('exist')
                                    .and('be.visible')
                                    .and('contain.text', 'View');
                            });
                    });
                },
            );
        });
    });
});
