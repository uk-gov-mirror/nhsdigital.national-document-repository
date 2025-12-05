import searchPatientPayload from '../../../fixtures/requests/GET_SearchPatient.json';
import { Roles } from '../../../support/roles';
import { formatNhsNumber } from '../../../../src/helpers/utils/formatNhsNumber';
import { DOCUMENT_TYPE } from '../../../../src/helpers/utils/documentType';

describe('PCSE Workflow: Access and download found files', () => {
    const testPatient = '9000000009';

    const searchDocumentReferencesResponse = [
        {
            fileName: 'Screenshot 2023-09-11 at 16.06.40.png',
            virusScannerResult: 'Not Scanned',
            created: new Date('2023-09-12T10:41:41.747836Z'),
        },
        {
            fileName: 'Screenshot 2023-09-08 at 14.53.47.png',
            virusScannerResult: 'Not Scanned',
            created: new Date('2023-09-12T10:41:41.749341Z'),
        },
    ];

    const homeUrl = '/';

    beforeEach(() => {
        cy.login(Roles.PCSE);
        cy.navigateToPatientSearchPage();
    });

    context('Delete all documents relating to a patient', () => {
        beforeEach(() => {
            cy.intercept('GET', '/SearchPatient*', {
                statusCode: 200,
                body: searchPatientPayload,
            }).as('patientSearch');

            cy.getByTestId('nhs-number-input').click();
            cy.getByTestId('nhs-number-input').type(testPatient);
            cy.getByTestId('search-submit-btn').click();
            cy.wait('@patientSearch');

            cy.intercept('GET', '/SearchDocumentReferences*', {
                statusCode: 200,
                body: searchDocumentReferencesResponse,
            }).as('documentSearch');

            cy.get('#verify-submit').click();

            cy.wait('@documentSearch');
        });

        it(
            'allows a PCSE user to delete all documents relating to a patient',
            { tags: 'regression' },
            () => {
                cy.intercept(
                    'DELETE',
                    `/DocumentDelete?patientId=${searchPatientPayload.nhsNumber}&docType=${DOCUMENT_TYPE.ALL}`,
                    {
                        statusCode: 200,
                        body: 'Success',
                    },
                ).as('documentDelete');

                cy.getByTestId('delete-all-documents-btn').click();

                cy.get('#delete-docs').should('be.visible');
                cy.get('#yes-radio-button').click();
                cy.getByTestId('delete-submit-btn').click();

                cy.wait('@documentDelete');

                // assert delete success page is as expected
                cy.getByTestId('deletion-complete_card_content_header').should('be.visible');
                cy.contains('GivenName Surname').should('be.visible');
                cy.contains(
                    `NHS number: ${formatNhsNumber(searchPatientPayload.nhsNumber)}`,
                ).should('be.visible');
            },
        );

        it(
            'returns user to download documents page on cancel of delete',
            { tags: 'regression' },
            () => {
                cy.getByTestId('delete-all-documents-btn').click();

                cy.get('#delete-docs').should('be.visible');
                cy.get('#no-radio-button').click();
                cy.getByTestId('delete-submit-btn').click();

                // assert user is returned to download documents page
                cy.contains('Manage Lloyd George records').should('be.visible');
            },
        );

        it(
            'displays an error when the delete document API call fails',
            { tags: 'regression' },
            () => {
                cy.intercept(
                    'DELETE',
                    `/DocumentDelete?patientId=${searchPatientPayload.nhsNumber}&docType=${DOCUMENT_TYPE.ALL}`,
                    {
                        statusCode: 500,
                        body: 'Failed to delete documents',
                    },
                ).as('documentDelete');

                cy.getByTestId('delete-all-documents-btn').click();

                cy.get('#delete-docs').should('be.visible');
                cy.get('#yes-radio-button').click();
                cy.getByTestId('delete-submit-btn').click();

                // assert
                cy.contains('Sorry, there is a problem with the service').should('be.visible');
            },
        );

        it(
            'displays an error on delete attempt when documents exist for the patient',
            { tags: 'regression' },
            () => {
                cy.intercept(
                    'DELETE',
                    `/DocumentDelete?patientId=${searchPatientPayload.nhsNumber}&docType=${DOCUMENT_TYPE.ALL}`,
                    {
                        statusCode: 404,
                        body: 'No documents available',
                    },
                ).as('documentDelete');

                cy.getByTestId('delete-all-documents-btn').click();

                cy.get('#delete-docs').should('be.visible');
                cy.get('#yes-radio-button').click();
                cy.getByTestId('delete-submit-btn').click();

                // assert
                cy.contains('Sorry, there is a problem with the service').should('be.visible');
            },
        );
    });
});
