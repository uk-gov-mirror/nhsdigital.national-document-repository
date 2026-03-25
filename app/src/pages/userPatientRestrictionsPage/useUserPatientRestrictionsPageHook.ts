import { useState } from 'react';
import { routeChildren } from '../../types/generic/routes';
import useConfig from '../../helpers/hooks/useConfig';
import { useNavigate } from 'react-router-dom';
import {
    UserPatientRestriction,
    UserPatientRestrictionsSubRoute,
} from '../../types/generic/userPatientRestriction';

export type UseUserPatientRestrictionsPageReturn = {
    isEnabled: boolean | undefined;
    subRoute: UserPatientRestrictionsSubRoute | null;
    setSubRoute: React.Dispatch<React.SetStateAction<UserPatientRestrictionsSubRoute | null>>;
    restrictionToRemove: UserPatientRestriction | null;
    confirmVerifyPatientDetails: () => void;
    onRemoveRestriction: (restriction: UserPatientRestriction) => void;
    existingRestrictions: UserPatientRestriction[];
    setExistingRestrictions: React.Dispatch<React.SetStateAction<UserPatientRestriction[]>>;
};

const useUserPatientRestrictionsPage = (): UseUserPatientRestrictionsPageReturn => {
    const config = useConfig();
    const navigate = useNavigate();

    const [subRoute, setSubRoute] = useState<UserPatientRestrictionsSubRoute | null>(null);
    const [restrictionToRemove, setRestrictionToRemove] = useState<UserPatientRestriction | null>(
        null,
    );
    const [existingRestrictions, setExistingRestrictions] = useState<UserPatientRestriction[]>([]);

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
        setTimeout(() => {
            navigate(routeChildren.USER_PATIENT_RESTRICTIONS_REMOVE_CONFIRM);
        }, 2);
    };

    return {
        isEnabled: config.featureFlags.userRestrictionEnabled,
        subRoute,
        setSubRoute,
        restrictionToRemove,
        confirmVerifyPatientDetails,
        onRemoveRestriction,
        existingRestrictions,
        setExistingRestrictions,
    };
};

export default useUserPatientRestrictionsPage;
