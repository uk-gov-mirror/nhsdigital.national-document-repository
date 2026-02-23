import { Roles } from '../../../support/roles';
import dbItem from '../../../fixtures/dynamo-db-items/example-review-h81109.json';

const workspace = Cypress.env('WORKSPACE');
const tableName = `${workspace}_DocumentUploadReview`;
const path = `9730155348/e3e4f62e-6f95-4d8c-8870-5212b6353ae9/test_patient_record.pdf`;
const bucketName = `${workspace}-document-pending-review-store`;
dbItem.Files.forEach((file) => {
    file.FileLocation = file.FileLocation.replace('{env}', workspace);
});

describe('GP Workflow: Review and Reassign', () => {
    context('Review and Reassign', () => {
        beforeEach(() => {
            cy.addItemToDynamoDb(tableName, dbItem);
            cy.addPdfFileToS3(bucketName, path, 'test_patient_record.pdf');
        });

        afterEach(() => {
            cy.deleteItemFromDynamoDb(tableName, dbItem.ID, 1);
            cy.deleteItemFromDynamoDb(tableName, dbItem.ID, 2);
            cy.deleteFileFromS3(bucketName, path);
        });

        it(
            '[Smoke] GP ADMIN user can review and reassign a document to the correct patient',
            { tags: 'smoke', defaultCommandTimeout: 20000 },
            () => {
                cy.smokeLogin(Roles.SMOKE_GP_ADMIN);

                // click admin console
                cy.navigateToHomePage();
                cy.getByTestId('admin-hub-btn').should('exist').click();

                // click review docs
                cy.getByTestId('admin-reviews-btn').should('exist').click();

                // find the example review item by nhs number and view it
                cy.getByTestId('view-record-link-e3e4f62e-6f95-4d8c-8870-5212b6353ae9')
                    .should('exist')
                    .click();

                // click "dont accept the record" and continue
                cy.getByTestId('reject-record-option').should('exist').check();
                cy.getByTestId('reject-record-option').should('be.checked');
                cy.getByTestId('continue-btn').should('exist').click();

                // find the textbox and search for the correct nhs number to reassign to
                cy.getByTestId('nhs-number-input').should('exist').click();
                cy.getByTestId('nhs-number-input').type('9730326983');
                cy.getByTestId('continue-button').should('exist').click();

                // confirm demographics of the new patient and continue
                cy.getByTestId('confirm-patient-details-btn').should('exist').click();

                // assert reassignment success message and path
                cy.contains('This document has been matched to the correct patient').should(
                    'be.visible',
                );
                cy.url().should('contain', '/admin/reviews/:reviewId/complete/patient-matched');

                // assert the review is no longer in our review queue
                cy.getByTestId('review-another-btn').should('exist').click();
                cy.getByTestId('view-record-link-e3e4f62e-6f95-4d8c-8870-5212b6353ae9').should(
                    'not.exist',
                );

                // logout
                cy.getByTestId('logout-btn').click();

                // login as new ods code to verify the document is now in their review queue
                cy.getByTestId('start-btn').should('exist'); // wait for login button to appear after logout
                cy.smokeLogin(Roles.SMOKE_GP_ADMIN, 'H85686');
                cy.navigateToHomePage();
                cy.getByTestId('admin-hub-btn').should('exist').click();
                cy.getByTestId('admin-reviews-btn').should('exist').click();
                cy.getByTestId('view-record-link-e3e4f62e-6f95-4d8c-8870-5212b6353ae9').should(
                    'exist',
                );
            },
        );
    });
});
