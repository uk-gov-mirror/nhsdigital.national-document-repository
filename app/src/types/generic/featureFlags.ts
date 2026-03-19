export type FeatureFlags = {
    uploadLloydGeorgeWorkflowEnabled: boolean;
    uploadLambdaEnabled: boolean;
    uploadArfWorkflowEnabled: boolean;
    uploadDocumentIteration2Enabled?: boolean;
    uploadDocumentIteration3Enabled?: boolean;
    documentCorrectEnabled?: boolean;
    userRestrictionEnabled?: boolean;
};

export const defaultFeatureFlags: FeatureFlags = {
    uploadLloydGeorgeWorkflowEnabled: false,
    uploadLambdaEnabled: false,
    uploadArfWorkflowEnabled: false,
    uploadDocumentIteration2Enabled: false,
    uploadDocumentIteration3Enabled: false,
    documentCorrectEnabled: false,
    userRestrictionEnabled: false,
};
