import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { apiClient } from '@/services/api/client';
import { normalizeApiBase } from '@/utils/connection';

function getDevPreviewAuth() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.get('ui-preview') !== '1') {
    return null;
  }

  return {
    apiBase: normalizeApiBase(`${window.location.protocol}//${window.location.host}`),
    managementKey: 'ui-preview'
  };
}

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const managementKey = useAuthStore((state) => state.managementKey);
  const apiBase = useAuthStore((state) => state.apiBase);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const [checking, setChecking] = useState(false);
  const devPreviewAuth = useMemo(() => getDevPreviewAuth(), []);

  useEffect(() => {
    if (!devPreviewAuth) {
      return;
    }

    apiClient.setConfig(devPreviewAuth);
    useAuthStore.setState({
      isAuthenticated: true,
      apiBase: devPreviewAuth.apiBase,
      managementKey: devPreviewAuth.managementKey,
      rememberPassword: false,
      connectionStatus: 'connected',
      connectionError: null,
      isPreviewSession: true
    });
  }, [devPreviewAuth]);

  useEffect(() => {
    const tryRestore = async () => {
      if (!isAuthenticated && managementKey && apiBase) {
        setChecking(true);
        try {
          await checkAuth();
        } finally {
          setChecking(false);
        }
      }
    };
    tryRestore();
  }, [apiBase, isAuthenticated, managementKey, checkAuth]);

  if (checking) {
    return (
      <div className="main-content">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isAuthenticated && !devPreviewAuth) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}
