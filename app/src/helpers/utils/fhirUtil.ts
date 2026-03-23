import { FhirDocumentReference } from '../../types/fhirR4/documentReference';

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
