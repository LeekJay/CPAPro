import { Navigate } from 'react-router-dom';

export function OAuthPage() {
  return <Navigate to="/auth-files" replace />;
}
