import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type Role } from '../context/AuthContext';

interface ProtectedRouteProps {
    allowedRoles: Role[];
}

export const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { currentUser, loading } = useAuth();

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>; // Replace with Shadcn Spinner later
    }

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    if (!currentUser.role || !allowedRoles.includes(currentUser.role)) {
        // Redirect to a generic unauthorized page, or back to their specific dashboard
        return <Navigate to="/unauthorized" replace />;
    }

    return <Outlet />; // Renders the protected child route
};