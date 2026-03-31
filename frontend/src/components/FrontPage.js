import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, getStoredAuth, saveStoredAuth } from '../lib/api';
import './FrontPage.css';

const FrontPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const existingAuth = getStoredAuth();

    if (existingAuth?.token && existingAuth?.user?.role) {
      navigate(existingAuth.user.role === 'admin' ? '/admin' : '/learning', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      saveStoredAuth(response);
      navigate(response.user.role === 'admin' ? '/admin' : '/learning');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-left">
        <p className="portal-tag">MK</p>
        <h1 className="brand-name">MK Tech learning platfor</h1>
        <p className="brand-subtitle">
          Sign in to manage courses, register learners, and watch assigned training videos using the
          new Node.js + PostgreSQL backend.
        </p>

        <div className="login-card">
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter your username"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />

            {error ? <div className="form-message error-message">{error}</div> : null}

            <button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="credential-hint">
            <strong>Default admin:</strong> <code>admin</code> / <code>admin</code>
          </div>
        </div>
      </div>

      <div className="login-right">
        <div className="hero-panel">
          <h2>What this app now supports</h2>
          <ul className="feature-list">
            <li>Admin login backed by PostgreSQL</li>
            <li>Course creation with multiple video links</li>
            <li>User onboarding and course registration</li>
            <li>Learner view for assigned course videos</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default FrontPage;

