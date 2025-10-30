export type FeatureFlags = {
    uploadLloydGeorgeWorkflowEnabled: boolean;
    uploadLambdaEnabled: boolean;
    uploadArfWorkflowEnabled: boolean;
    uploadDocumentIteration2Enabled?: boolean;
};

export const defaultFeatureFlags: FeatureFlags = {
    uploadLloydGeorgeWorkflowEnabled: false,
    uploadLambdaEnabled: false,
    uploadArfWorkflowEnabled: false,
    uploadDocumentIteration2Enabled: false,
};
