export type FeatureFlags = {
    [key: string]: boolean;
};

export const defaultFeatureFlags: FeatureFlags = {
    uploadLloydGeorgeWorkflowEnabled: true,
    uploadArfWorkflowEnabled: true,
    uploadLambdaEnabled: true,
    uploadDocumentIteration2Enabled: true,
    uploadDocumentIteration3Enabled: false,
    versionHistoryEnabled: true,
};
