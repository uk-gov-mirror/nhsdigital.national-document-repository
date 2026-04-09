import { FhirDocumentReference } from '../../types/fhirR4/documentReference';
import { DocumentReference } from '../../types/pages/documentSearchResultsPage/types';
import { DOCUMENT_TYPE } from './documentType';

/**
 * Gets the version ID from a FHIR R4 DocumentReference
 */
export const getVersionId = (doc: FhirDocumentReference): string => doc.meta?.versionId ?? '';

/**
 * Gets the created date from a FHIR R4 DocumentReference
 */
export const getCreatedDate = (doc: FhirDocumentReference): string => doc.date ?? '';

/**
 * Gets the custodian which will be ODS code value from a FHIR R4 DocumentReference
 */
export const getCustodianValue = (doc: FhirDocumentReference): string =>
    doc.custodian?.identifier?.value ?? doc.custodian?.display ?? '';

/**
 * Gets the author from a FHIR R4 DocumentReference
 */
export const getAuthorValue = (doc: FhirDocumentReference): string =>
    doc.author?.[0]?.identifier?.value ??
    doc.author?.[0]?.display ??
    doc.author?.[0]?.reference ??
    '';

export const getDocumentReferenceFromFhir = (
    fhirDocRef: FhirDocumentReference,
): DocumentReference => {
    const documentSnomedCodeType = fhirDocRef.type?.coding?.[0]?.code! as DOCUMENT_TYPE;
    const created = getCreatedDate(fhirDocRef);
    const author = getAuthorValue(fhirDocRef);
    const fileName = fhirDocRef.content?.[0]?.attachment?.title ?? '';
    const id = fhirDocRef.id!;
    const fileSize = fhirDocRef.content?.[0]?.attachment?.size ?? 0;
    const version = getVersionId(fhirDocRef);
    const contentType = fhirDocRef.content?.[0]?.attachment?.contentType ?? '';
    const isPdf = contentType === 'application/pdf';
    let url = fhirDocRef.content?.[0]?.attachment?.url!;

    return {
        documentSnomedCodeType,
        id,
        created,
        author,
        fileName,
        fileSize,
        version,
        contentType,
        url,
        isPdf,
        virusScannerResult: '',
    };
};
