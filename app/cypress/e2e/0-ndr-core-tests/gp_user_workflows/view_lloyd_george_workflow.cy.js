import searchPatientPayload from '../../../fixtures/requests/GET_SearchPatient.json';
import { Roles, roleName } from '../../../support/roles';
import { formatNhsNumber } from '../../../../src/helpers/utils/formatNhsNumber';
import { DOCUMENT_TYPE } from '../../../../src/helpers/utils/documentType';
import { routes } from '../../../support/routes';

const baseUrl = Cypress.config('baseUrl');
const gpRoles = [Roles.GP_ADMIN, Roles.GP_CLINICAL];

const testFile = {
    fileName: '1of1_lone_test_file.pdf',
    created: '2023-01-01T12:00:00Z',
    virusScannerResult: 'CLEAN',
    author: 'Y12345',
    id: 'mock-document-id-1',
    fileSize: 1024,
    version: '1',
    documentSnomedCodeType: '16521000000101',
    contentType: 'application/pdf',
};

describe('GP Workflow: View Lloyd George record', () => {
    const assertPatientInfo = () => {
        cy.getByTestId('patient-summary-full-name').should(
            'have.text',
            `${searchPatientPayload.familyName}, ${searchPatientPayload.givenName}`,
        );
        cy.getByTestId('patient-summary-nhs-number').should('have.text', `900 000 0009`);
        cy.getByTestId('patient-summary-date-of-birth').should('have.text', `1 January 1970`);
    };

    const beforeEachConfiguration = (role) => {
        cy.login(role);
        cy.navigateToPatientSearchPage();
        // search patient
        cy.intercept('GET', '/SearchPatient*', {
            statusCode: 200,
            body: searchPatientPayload,
        }).as('search');
        cy.getByTestId('nhs-number-input').type(searchPatientPayload.nhsNumber);
        cy.getByTestId('search-submit-btn').click();
        cy.wait('@search');
    };

    const setupLoadDocumentIntercepts = (files = [testFile], times) => {
        cy.intercept('GET', '/SearchDocumentReferences*', {
            statusCode: 200,
            body: {
                references: files,
                nextPageToken: files.length > 0 ? 'abc' : '',
            },
            delay: 1000,
            ...(times !== undefined && { times }),
        }).as('searchDocumentReferences');

        cy.intercept('GET', '/DocumentReview*', {
            statusCode: 200,
            body: {
                count: 0,
            },
        }).as('documentReview');

        cy.intercept('GET', `/DocumentReference/${testFile.id}*`, {
            statusCode: 200,
            body: {
                url: '/dev/testFile.pdf',
                contentType: 'application/pdf',
            },
            delay: 1000,
        }).as('getDocument');
    };

    const viewDocumentAfterVerify = () => {
        cy.url().should('contain', baseUrl + routes.patientDocuments);
        cy.title().should(
            'eq',
            'Lloyd George records - Access and store digital patient documents',
        );

        cy.wait('@searchDocumentReferences', { timeout: 20000 });
        cy.wait('@documentReview', { timeout: 20000 });

        cy.getByTestId('available-files-table-title', { timeout: 30000 }).should('be.visible');

        cy.getByTestId('view-0-link').click();
        cy.contains('Loading document').should('be.visible');

        cy.wait('@getDocument', { timeout: 20000 });
    };

    gpRoles.forEach((role) => {
        context(`View Lloyd George document for ${roleName(role)} role`, () => {
            beforeEach(() => {
                beforeEachConfiguration(role);
            });
            it(
                roleName(role) + ' can view a Lloyd George document of an active patient',
                { tags: 'regression' },
                () => {
                    setupLoadDocumentIntercepts();

                    cy.get('#verify-submit').click();

                    viewDocumentAfterVerify();

                    // Assert
                    assertPatientInfo();
                    cy.getByTestId('pdf-card').scrollIntoView();
                    const expectedCreatedDate = new Date(testFile.created).toLocaleDateString(
                        'en-GB',
                        {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                        },
                    );
                    cy.getByTestId('pdf-card')
                        .should('include.text', 'Scanned paper notes: Version 1')
                        .should(
                            'include.text',
                            `Created by practice: ${testFile.author} on ${expectedCreatedDate}`,
                        );
                    cy.getByTestId('pdf-viewer').should('be.visible');
                },
            );

            it(
                `It displays an error when the search document references API call fails for a ${roleName(
                    role,
                )}`,
                { tags: 'regression' },
                () => {
                    cy.intercept('GET', '/SearchDocumentReferences*', {
                        statusCode: 500,
                        delay: 1000,
                    }).as('searchDocumentReferences');
                    cy.get('#verify-submit').click();

                    cy.wait('@searchDocumentReferences', { timeout: 20000 });

                    //Assert
                    cy.contains('Sorry, there is a problem with the service').should('be.visible');
                    cy.title().should(
                        'eq',
                        'Service error - Access and store digital patient documents',
                    );
                },
            );
        });
    });

    context('View Lloyd George document with specific role tests', () => {
        it(
            `It displays an empty document table when no document exists for the patient for a GP_CLINICAL`,
            { tags: 'regression' },
            () => {
                setupLoadDocumentIntercepts([]);
                beforeEachConfiguration(Roles.GP_CLINICAL);

                cy.get('#verify-submit').click();

                cy.wait('@searchDocumentReferences');
                cy.wait('@documentReview');

                // Assert
                assertPatientInfo();
                cy.get('#no-files-message').should('be.visible');
            },
        );
    });

    context('Delete Lloyd George document', () => {
        it(
            'A GP ADMIN user can delete the Lloyd George document of an active patient',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_ADMIN);

                setupLoadDocumentIntercepts([testFile], 1);

                cy.get('#verify-submit').click();

                viewDocumentAfterVerify();

                cy.getByTestId('delete-files-link').should('exist');
                cy.getByTestId('delete-files-link').click();

                // assert delete confirmation page is as expected
                cy.getByTestId('delete-files-warning-message').should('be.visible');

                cy.contains('Surname').should('be.visible');
                cy.contains('GivenName').should('be.visible');
                cy.contains('900 000 0009').should('be.visible');
                cy.contains('1 January 1970').should('be.visible');

                cy.intercept(
                    'DELETE',
                    `/DocumentDelete?patientId=${searchPatientPayload.nhsNumber}&docType=${DOCUMENT_TYPE.LLOYD_GEORGE}`,
                    {
                        statusCode: 200,
                        body: 'Success',
                    },
                ).as('documentDelete');

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

                cy.intercept('GET', '/SearchDocumentReferences*', {
                    statusCode: 200,
                    body: {
                        references: [],
                        nextPageToken: '',
                    },
                    delay: 1000,
                }).as('searchDocumentReferencesAfterDelete');

                cy.getByTestId('lg-return-btn').click();

                cy.wait('@searchDocumentReferencesAfterDelete');

                // Assert
                assertPatientInfo();
                cy.get('#no-files-message').should('be.visible');
            },
        );

        it(
            'Page returns user to view Lloyd George page on the cancel action of delete as a GP ADMIN',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_ADMIN);

                setupLoadDocumentIntercepts();

                cy.get('#verify-submit').click();

                viewDocumentAfterVerify();

                cy.getByTestId('delete-files-link').should('exist');
                cy.getByTestId('delete-files-link').click();

                cy.url().should('contain', baseUrl + routes.patientDocumentsDelete);

                // cancel delete
                cy.contains('Go back').click();

                // assert user is returned to view patient documents page
                cy.url().should('contain', baseUrl + routes.patientDocuments);
                cy.title().should(
                    'eq',
                    'Lloyd George records - Access and store digital patient documents',
                );
            },
        );

        it(
            'It displays an error when the delete document API call fails as A GP ADMIN',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_ADMIN);

                setupLoadDocumentIntercepts();

                cy.intercept(
                    'DELETE',
                    `/DocumentDelete?patientId=${searchPatientPayload.nhsNumber}&docType=${DOCUMENT_TYPE.LLOYD_GEORGE}`,
                    {
                        statusCode: 500,
                        body: 'Failed to delete documents',
                    },
                ).as('documentDelete');

                cy.get('#verify-submit').click();

                viewDocumentAfterVerify();

                cy.getByTestId('delete-files-link').should('exist');
                cy.getByTestId('delete-files-link').click();

                cy.get('#delete-docs').should('be.visible');
                cy.get('#yes-radio-button').click();
                cy.getByTestId('delete-submit-btn').click();
                cy.wait('@documentDelete');

                // assert
                cy.contains('Sorry, there is a problem with the service').should('be.visible');
            },
        );

        it(
            'No delete option exists when viewing a document as a GP CLINICAL user',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_CLINICAL);
                setupLoadDocumentIntercepts();

                cy.get('#verify-submit').click();

                viewDocumentAfterVerify();

                cy.getByTestId('delete-files-link').should('not.exist');
            },
        );
    });

    context('Delete Lloyd George document', () => {
        it('displays an error when the document manifest backend API call fails as a PCSE user', () => {
            beforeEachConfiguration(Roles.PCSE);

            setupLoadDocumentIntercepts();

            cy.intercept('POST', '/DocumentManifest**', {
                statusCode: 500,
            }).as('DocManifest');

            cy.get('#verify-submit').click();

            cy.wait('@searchDocumentReferences');
            cy.wait('@documentReview');

            cy.get('#download-documents').click();
            cy.wait('@DocManifest');

            // Assert
            cy.contains('Sorry, there is a problem with the service').should('be.visible');
        });
    });
});
