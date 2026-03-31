import React from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import FrontPage from './components/FrontPage';
import AdminPortal from './components/AdminPortal';
import UserPortal from './components/UserPortal';
import { getStoredAuth } from './lib/api';

const ProtectedRoute = ({ children, allowedRole }) => {
  const auth = getStoredAuth();

  if (!auth?.token || !auth?.user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && auth.user.role !== allowedRole) {
    return <Navigate to={auth.user.role === 'admin' ? '/admin' : '/learning'} replace />;
  }

  return children;
};

function App() {
  return (
    <div className="app-shell">
      <Router>
        <Routes>
          <Route path="/" element={<FrontPage />} />
          <Route
            path="/admin"
            element={(
              <ProtectedRoute allowedRole="admin">
                <AdminPortal />
              </ProtectedRoute>
            )}
          />
          <Route
            path="/learning"
            element={(
              <ProtectedRoute allowedRole="user">
                <UserPortal />
              </ProtectedRoute>
            )}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;

