import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import UserChat from './pages/UserChat';
import AdminDashboard from './pages/AdminDashboard';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500">Loading...</div>;

  if (!user) {
    return <AuthPage />;
  }

  if (user.role === 'admin') {
    return <AdminDashboard />;
  }

  return <UserChat />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}