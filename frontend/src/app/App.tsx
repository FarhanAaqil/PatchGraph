import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Skeleton } from '../ui/primitives';
import { ToastProvider } from '../ui/Toast';
import Home from '../pages/Home';
import Shell from './Shell';

// Each screen is its own chunk, fetched the first time it is opened.
const ImportPage = lazy(() => import('../pages/ImportPage'));
const Risks = lazy(() => import('../pages/Risks'));
const MapPage = lazy(() => import('../pages/MapPage'));
const Plan = lazy(() => import('../pages/Plan'));
const Review = lazy(() => import('../pages/Review'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function PageFallback() {
  return (
    <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton width="38%" height={34} />
      <Skeleton width="60%" height={16} />
      <Skeleton height={180} radius={18} />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route element={<Shell />}>
                <Route index element={<Home />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="risks" element={<Risks />} />
                <Route path="plan" element={<Plan />} />
                <Route path="review" element={<Review />} />
                <Route path="map" element={<MapPage />} />
                <Route path="settings" element={<SettingsPage />} />
                {/* Addresses from earlier versions keep working. */}
                <Route path="ingest" element={<Navigate to="/import" replace />} />
                <Route path="risk" element={<Navigate to="/risks" replace />} />
                <Route path="graph" element={<Navigate to="/map" replace />} />
                <Route path="planner" element={<Navigate to="/plan" replace />} />
                <Route path="audit" element={<Navigate to="/review" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}
