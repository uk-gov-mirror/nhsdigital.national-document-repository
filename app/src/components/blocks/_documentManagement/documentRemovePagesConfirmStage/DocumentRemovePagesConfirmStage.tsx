type Props = {
    baseDocumentBlob: Blob | null;
    pagesToRemove: number[];
};

const DocumentRemovePagesConfirmStage = ({ pagesToRemove }: Props): React.JSX.Element => {
    return <div>Pages to remove: {pagesToRemove.join(', ')}</div>;
};

export default DocumentRemovePagesConfirmStage;
