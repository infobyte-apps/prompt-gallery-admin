import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

import { AdminLayout } from './components/layout/AdminLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

import { SignInPage } from './pages/auth/SignInPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';
import { RecoveryPage } from './pages/auth/RecoveryPage';
import { AccessDeniedPage } from './pages/auth/AccessDeniedPage';

import { DashboardPage } from './pages/DashboardPage';
import { PromptsListPage } from './pages/PromptsListPage';
import { PromptEditorPage } from './pages/PromptEditorPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { TagsPage } from './pages/TagsPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { TeamPage } from './pages/TeamPage';
import { MobileAppSettingsPage } from './pages/MobileAppSettingsPage';
import { MonetizationPage } from './pages/MonetizationPage';

export function App() {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AuthProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/auth/signin" element={<SignInPage />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/recovery" element={<RecoveryPage />} />
            <Route path="/auth/access-denied" element={<AccessDeniedPage />} />

            {/* Authenticated Admin Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="prompts" element={<PromptsListPage />} />
              <Route path="prompts/new" element={<PromptEditorPage />} />
              <Route path="prompts/:id" element={<PromptEditorPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="tags" element={<TagsPage />} />
              <Route path="collections" element={<CollectionsPage />} />
              
              {/* Settings Module */}
              <Route path="settings" element={<Navigate to="/settings/mobile" replace />} />
              <Route path="settings/mobile" element={<MobileAppSettingsPage />} />

              {/* Monetization Module */}
              <Route path="monetization" element={<MonetizationPage />} />

              {/* Super Admin-Only Route */}
              <Route
                path="team"
                element={
                  <ProtectedRoute requireSuperAdmin={true}>
                    <TeamPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </NotificationProvider>
    </BrowserRouter>
  );
}

export default App;

