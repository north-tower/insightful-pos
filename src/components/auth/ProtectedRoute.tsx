import { useAuth, UserRole } from '@/context/AuthContext';
import Login from '@/pages/Login';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Optional: only allow users with one of these roles */
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user, hasAssignedStore, signOut } = useAuth();

  // Show spinner while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in → show login page
  if (!isAuthenticated) {
    return <Login />;
  }

  // Logged in but no store membership yet → wait for admin assignment
  if (!hasAssignedStore) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏪</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Account Pending Approval</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your account is active, but no store has been assigned yet.
            Please wait for an administrator to approve your account and assign a store.
          </p>
          <div className="mb-6 rounded-md border bg-muted/30 p-3 text-left">
            <p className="text-xs font-semibold text-foreground mb-2">Admin hint</p>
            <p className="text-xs text-muted-foreground">
              Share these details with your administrator for faster assignment.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Email: <span className="font-mono text-foreground">{user?.email || 'Unavailable'}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              User ID: <span className="font-mono text-foreground break-all">{user?.id || 'Unavailable'}</span>
            </p>
          </div>
          <button
            onClick={() => { void signOut(); }}
            className="text-sm text-primary hover:underline"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Logged in but role not allowed → show access denied
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            Your role ({user.role}) doesn't have permission to view this page.
            Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
