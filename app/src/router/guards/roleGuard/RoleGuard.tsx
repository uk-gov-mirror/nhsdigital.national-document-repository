import { JSX, useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../../../types/generic/routes';
import { childRoutes, routeMap } from '../../AppRouter';
import useRole from '../../../helpers/hooks/useRole';

type Props = {
    children: ReactNode;
};

const RoleGuard = ({ children }: Props): JSX.Element => {
    const role = useRole();
    const navigate = useNavigate();
    const location = useLocation();
    useEffect(() => {
        let routeKey = location.pathname;

        // Try to find a matching child route
        const matchedChild = childRoutes.find((childRoute) => {
            // For exact matches
            if (childRoute.route === routeKey) {
                return true;
            }

            // For dynamic routes with params like /admin/review/:id
            // Convert route pattern to regex: /admin/review/:id -> /admin/review/[^/]+
            const pattern = childRoute.route.replace(/:[^/]+/g, '[^/]+');
            const regex = new RegExp(`^${pattern}$`);

            return regex.test(routeKey);
        });

        // If we found a child route match, use its parent for permission checking
        if (matchedChild) {
            routeKey = matchedChild.parent;
        }

        // Safely check if route exists in routeMap before accessing its properties
        const routeConfig = routeMap[routeKey as keyof typeof routeMap];
        if (!routeConfig) {
            // Route not in routeMap, allow access (might be handled elsewhere)
            return;
        }

        const { unauthorized } = routeConfig;
        const denyResource = Array.isArray(unauthorized) && role && unauthorized.includes(role);

        if (denyResource) {
            navigate(routes.UNAUTHORISED);
        }
    }, [role, location, navigate]);
    return <>{children}</>;
};

export default RoleGuard;
