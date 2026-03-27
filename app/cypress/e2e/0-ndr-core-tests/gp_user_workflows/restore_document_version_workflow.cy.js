import searchPatientPayload from '../../../fixtures/requests/GET_SearchPatient.json';
import versionHistoryPayload from '../../../fixtures/requests/GET_DocumentVersionHistory.json';
import { Roles } from '../../../support/roles';

const baseUrl = Cypress.config('baseUrl');

const searchResults = [
    {
        fileName: 'Scanned paper notes.pdf',
        created: '2025-12-15T10:30:00Z',
        virusScannerResult: 'Clean',
        author: 'Y12345',
        id: '2a7a270e-aa1d-532e-8648-d5d8e3defb82',
        fileSize: 3072,
        version: '3',
        documentSnomedCodeType: '16521000000101',
        contentType: 'application/pdf',
    },
];

const featureFlags = {
    uploadLloydGeorgeWorkflowEnabled: true,
    uploadArfWorkflowEnabled: true,
    uploadLambdaEnabled: true,
    uploadDocumentIteration2Enabled: true,
    uploadDocumentIteration3Enabled: true,
    documentCorrectEnabled: true,
    versionHistoryEnabled: true,
};

const bucketUrlIdentifier = 'document-store.s3.amazonaws.com';

describe.skip('GP Workflow: Restore document version', () => {
    const beforeEachConfiguration = (role) => {
        cy.login(role, featureFlags);
        cy.navigateToPatientSearchPage();

        cy.intercept('GET', '/SearchPatient*', {
            statusCode: 200,
            body: { ...searchPatientPayload, canManageRecord: true },
        }).as('search');

        cy.getByTestId('nhs-number-input').type(searchPatientPayload.nhsNumber);
        cy.getByTestId('search-submit-btn').click();
        cy.wait('@search');
    };

    const navigateToDocumentSearchResults = () => {
        cy.intercept('GET', '/SearchDocumentReferences*', {
            statusCode: 200,
            body: { references: searchResults },
        }).as('searchDocumentReferences');

        cy.intercept('GET', '/DocumentReview*', {
            statusCode: 200,
            body: { count: 0, results: [] },
        }).as('reviews');

        cy.get('#verify-submit').click();
        cy.wait('@searchDocumentReferences');
    };

    const navigateToDocumentView = () => {
        navigateToDocumentSearchResults();

        cy.intercept(
            {
                method: 'GET',
                url: '/DocumentReference/2a7a270e-aa1d-532e-8648-d5d8e3defb82',
            },
            {
                statusCode: 200,
                body: {
                    url: baseUrl + '/browserconfig.xml',
                    contentType: 'application/pdf',
                },
            },
        ).as('getDocument');

        cy.getByTestId('view-0-link').click();
    };

    const navigateToVersionHistory = () => {
        navigateToDocumentView();

        cy.intercept('GET', '/DocumentReference/2a7a270e-aa1d-532e-8648-d5d8e3defb82/_history*', {
            statusCode: 200,
            body: versionHistoryPayload,
        }).as('getVersionHistory');

        cy.getByTestId('view-document-history-link').click();
        cy.wait('@getVersionHistory');
    };

    const navigateToRestoreConfirm = () => {
        navigateToVersionHistory();

        cy.getByTestId('restore-version-2').click();
    };

    context('Version history page', () => {
        it(
            'GP_ADMIN can view the version history timeline for a document',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_ADMIN);
                navigateToVersionHistory();

                // Assert version history page is shown
                cy.contains('Version history').should('be.visible');

                // Assert all 3 versions are displayed
                cy.getByTestId('view-version-3').should('exist');
                cy.getByTestId('view-version-2').should('exist');
                cy.getByTestId('view-version-1').should('exist');

                // Assert active version (v3) shows "This is the current version"
                cy.contains("This is the current version shown in this patient's record").should(
                    'be.visible',
                );

                // Assert inactive versions have "Restore version" links
                cy.getByTestId('restore-version-2').should('exist');
                cy.getByTestId('restore-version-1').should('exist');
            },
        );

        it(
            'GP_ADMIN cannot see restore links for the active version',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_ADMIN);
                navigateToVersionHistory();

                // The active version (v3) should not have a restore link
                cy.getByTestId('restore-version-3').should('not.exist');
            },
        );
    });

    context('Restore version confirmation page', () => {
        it(
            'GP_ADMIN can navigate to the restore confirmation page from version history',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_ADMIN);
                navigateToRestoreConfirm();

                // Assert restore confirm page is shown
                cy.contains(
                    'Are you sure you want to restore this version of these scanned paper notes?',
                ).should('be.visible');

                // Assert radio options are present
                cy.getByTestId('yes-radio-btn').should('exist');
                cy.getByTestId('no-radio-btn').should('exist');
                cy.getByTestId('continue-button').should('exist');

                // Assert help and guidance link exists
                cy.getByTestId('help-and-guidance-link').should('exist');
            },
        );

        it(
            'shows validation error when submitting without selecting an option',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_ADMIN);
                navigateToRestoreConfirm();

                cy.getByTestId('continue-button').click();

                // Assert error summary is shown
                cy.getByTestId('error-summary').should('be.visible');
                cy.contains('Select whether you want to restore this version').should('be.visible');
            },
        );

        it(
            'navigates back when "No" is selected and continue is clicked',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_ADMIN);
                navigateToRestoreConfirm();

                cy.getByTestId('no-radio-btn').click();
                cy.getByTestId('continue-button').click();

                // Should navigate back to version history
                cy.contains('Version history').should('be.visible');
            },
        );

        it('navigates back when go back link is clicked', { tags: 'regression' }, () => {
            beforeEachConfiguration(Roles.GP_ADMIN);
            navigateToRestoreConfirm();

            cy.getByTestId('go-back-link').click();

            // Should navigate back to version history
            cy.contains('Version history').should('be.visible');
        });
    });

    context('Restore version uploading and completion', () => {
        it(
            'GP_ADMIN can successfully restore a previous version of a document',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_ADMIN);
                navigateToRestoreConfirm();

                // Intercept the upload session / document reference call
                cy.intercept('POST', '/DocumentReference*', {
                    statusCode: 200,
                    body: {
                        url: 'http://' + bucketUrlIdentifier,
                        fields: {
                            key: 'test-key',
                            'x-amz-algorithm': 'xxxx-xxxx-SHA256',
                            'x-amz-credential': 'xxxxxxxxxxx/20230904/eu-west-2/s3/aws4_request',
                            'x-amz-date': '20230904T125954Z',
                            'x-amz-security-token': 'xxxxxxxxx',
                            'x-amz-signature': '9xxxxxxxx',
                        },
                    },
                }).as('uploadSession');

                // Intercept the S3 upload
                cy.intercept('POST', '**' + bucketUrlIdentifier + '**', {
                    statusCode: 204,
                }).as('s3Upload');

                // Intercept virus scan / document status polling
                cy.intercept('GET', '/DocumentStatus*', {
                    statusCode: 200,
                    body: {
                        '2a7a270e-aa1d-532e-8648-d5d8e3defb82': {
                            status: 'succeeded',
                        },
                    },
                }).as('documentStatus');

                // Intercept the upload confirmation
                cy.intercept('POST', '/UploadConfirm*', {
                    statusCode: 204,
                }).as('uploadConfirm');

                // Select "Yes" and continue
                cy.getByTestId('yes-radio-btn').click();
                cy.getByTestId('continue-button').click();

                // Wait for restore to complete and navigate to success page
                cy.getByTestId('restore-complete-panel', { timeout: 30000 }).should('be.visible');

                // Assert restore complete page content
                cy.contains('Version restored').should('be.visible');
                cy.getByTestId('patient-name').should('be.visible');
                cy.getByTestId('nhs-number').should('be.visible');
                cy.getByTestId('dob').should('be.visible');
                cy.getByTestId('restore-version-description').should('be.visible');

                // Assert "go to version history" link exists
                cy.getByTestId('version-history-link').should('exist');

                // Assert "Go to Lloyd George records" button exists
                cy.getByTestId('go-to-records-button').should('exist');
            },
        );

        it(
            'navigates to Lloyd George records from restore complete page',
            { tags: 'regression' },
            () => {
                beforeEachConfiguration(Roles.GP_ADMIN);
                navigateToRestoreConfirm();

                // Set up intercepts for the upload flow
                cy.intercept('POST', '/DocumentReference*', {
                    statusCode: 200,
                    body: {
                        url: 'http://' + bucketUrlIdentifier,
                        fields: {
                            key: 'test-key',
                            'x-amz-algorithm': 'xxxx-xxxx-SHA256',
                            'x-amz-credential': 'xxxxxxxxxxx/20230904/eu-west-2/s3/aws4_request',
                            'x-amz-date': '20230904T125954Z',
                            'x-amz-security-token': 'xxxxxxxxx',
                            'x-amz-signature': '9xxxxxxxx',
                        },
                    },
                }).as('uploadSession');

                cy.intercept('POST', '**' + bucketUrlIdentifier + '**', {
                    statusCode: 204,
                }).as('s3Upload');

                cy.intercept('GET', '/DocumentStatus*', {
                    statusCode: 200,
                    body: {
                        '2a7a270e-aa1d-532e-8648-d5d8e3defb82': {
                            status: 'succeeded',
                        },
                    },
                }).as('documentStatus');

                cy.intercept('POST', '/UploadConfirm*', {
                    statusCode: 204,
                }).as('uploadConfirm');

                // Complete the restore
                cy.getByTestId('yes-radio-btn').click();
                cy.getByTestId('continue-button').click();
                cy.getByTestId('restore-complete-panel', { timeout: 30000 }).should('be.visible');

                // Click "Go to Lloyd George records" button
                cy.intercept('GET', '/SearchDocumentReferences*', {
                    statusCode: 200,
                    body: { references: searchResults },
                }).as('searchDocumentReferencesAfterRestore');

                cy.getByTestId('go-to-records-button').click();

                // Should be back on the patient documents page
                cy.url().should('contain', '/patient/documents');
                cy.getByTestId('available-files-table-title').should('be.visible');
            },
        );
    });
});
