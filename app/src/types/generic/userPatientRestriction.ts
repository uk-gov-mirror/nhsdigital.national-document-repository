export type UserPatientRestriction = {
    id: string;
    restrictedUser: string;
    nhsNumber: string;
    patientGivenName: string[];
    patientFamilyName: string;
    restrictedUserFirstName: string;
    restrictedUserLastName: string;
    created: string;
};

export enum UserPatientRestrictionsSubRoute {
    ADD = 'add',
    VIEW = 'view',
    REMOVE = 'remove',
}

export type UserInformation = {
    smartcardId: string;
    firstName: string;
    lastName: string;
};
