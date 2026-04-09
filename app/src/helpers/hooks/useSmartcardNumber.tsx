import { useSessionContext } from '../../providers/sessionProvider/SessionProvider';
import { NdrTokenData } from '../../types/generic/ndrTokenData';
import { decodeJwtToken } from '../utils/jwtDecoder';

const useSmartcardNumber = (): string | null => {
    const [session] = useSessionContext();

    const decodedToken = decodeJwtToken<NdrTokenData>(session.auth!.authorisation_token);
    return decodedToken ? decodedToken.nhs_user_id : null;
};

export default useSmartcardNumber;
