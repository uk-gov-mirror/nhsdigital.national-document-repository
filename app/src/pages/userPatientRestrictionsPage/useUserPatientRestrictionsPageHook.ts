import { Dispatch, SetStateAction, useState } from 'react';
import { routeChildren } from '../../types/generic/routes';
import { useNavigate } from 'react-router-dom';
import {
    UserInformation,
    UserPatientRestriction,
    UserPatientRestrictionsSubRoute,
} from '../../types/generic/userPatientRestriction';

export enum UserPatientRestrictionsJourneyState {
    INITIAL,
    CONFIRMING,
    COMPLETE,
}

export type UseUserPatientRestrictionsPageReturn = {
    subRoute: UserPatientRestrictionsSubRoute | null;
    setSubRoute: Dispatch<SetStateAction<UserPatientRestrictionsSubRoute | null>>;
    restrictionToRemove: UserPatientRestriction | null;
    confirmVerifyPatientDetails: () => void;
    onRemoveRestriction: (restriction: UserPatientRestriction) => void;
    existingRestrictions: UserPatientRestriction[];
    setExistingRestrictions: Dispatch<SetStateAction<UserPatientRestriction[]>>;
    userInformation: UserInformation | null;
    setUserInformation: Dispatch<SetStateAction<UserInformation | null>>;
    journeyState: UserPatientRestrictionsJourneyState;
    setJourneyState: Dispatch<SetStateAction<UserPatientRestrictionsJourneyState>>;
};

const useUserPatientRestrictionsPage = (): UseUserPatientRestrictionsPageReturn => {
    const navigate = useNavigate();

    const [subRoute, setSubRoute] = useState<UserPatientRestrictionsSubRoute | null>(null);
    const [restrictionToRemove, setRestrictionToRemove] = useState<UserPatientRestriction | null>(
        null,
    );
    const [existingRestrictions, setExistingRestrictions] = useState<UserPatientRestriction[]>([]);
    const [userInformation, setUserInformation] = useState<UserInformation | null>(null);

    const [journeyState, setJourneyState] = useState<UserPatientRestrictionsJourneyState>(
        UserPatientRestrictionsJourneyState.INITIAL,
    );

    const confirmVerifyPatientDetails = (): void => {
        if (subRoute === UserPatientRestrictionsSubRoute.ADD) {
            navigate(routeChildren.USER_PATIENT_RESTRICTIONS_EXISTING_RESTRICTIONS);
        } else if (subRoute === UserPatientRestrictionsSubRoute.VIEW) {
            navigate(routeChildren.USER_PATIENT_RESTRICTIONS_VIEW);
        }
    };

    const onRemoveRestriction = (restriction: UserPatientRestriction): void => {
        setRestrictionToRemove(restriction);
        setSubRoute(UserPatientRestrictionsSubRoute.REMOVE);
        setJourneyState(UserPatientRestrictionsJourneyState.CONFIRMING);
        setTimeout(() => {
            navigate(routeChildren.USER_PATIENT_RESTRICTIONS_REMOVE_CONFIRM);
        }, 2);
    };

    return {
        subRoute,
        setSubRoute,
        restrictionToRemove,
        confirmVerifyPatientDetails,
        onRemoveRestriction,
        existingRestrictions,
        setExistingRestrictions,
        userInformation,
        setUserInformation,
        journeyState,
        setJourneyState,
    };
};

export default useUserPatientRestrictionsPage;
