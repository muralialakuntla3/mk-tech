import React from 'react';
import { HashRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
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

  if (allowedRole) {
    const allowedRoles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
    if (!allowedRoles.includes(auth.user.role)) {
      return <Navigate to={auth.user.role === 'user' ? '/learning' : '/admin'} replace />;
    }
  }

  return children;
};

function App() {
  return (
    <div className="app-shell">
      <Router>
        <div className="app-main">
          <Routes>
            <Route path="/" element={<FrontPage />} />
            <Route
              path="/admin"
              element={(
                <ProtectedRoute allowedRole={['admin', 'manager']}>
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
        </div>
        <footer className="app-footer">All rights reserved by muralialakuntla3@gmail.com</footer>
      </Router>
    </div>
  );
}

export default App;

