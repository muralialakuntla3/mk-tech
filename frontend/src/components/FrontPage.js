import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, getStoredAuth, saveStoredAuth } from '../lib/api';
import './FrontPage.css';

const FrontPage = () => {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const existingAuth = getStoredAuth();

    if (existingAuth?.token && existingAuth?.user?.role) {
      navigate(existingAuth.user.role === 'user' ? '/learning' : '/admin', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });

      saveStoredAuth(response);
      navigate(response.user.role === 'user' ? '/learning' : '/admin');
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
        <h1 className="brand-name">Welcome to MK Tech Learning Platform</h1>
        <p className="brand-subtitle">
          Sign in to watch your course videos.
        </p>

        <div className="login-card">
          <form className="login-form" onSubmit={handleLogin}>
            <label htmlFor="identifier">Username or Email</label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="Enter your username or email"
              required
            />

            <label htmlFor="password">Password</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {error ? <div className="form-message error-message">{error}</div> : null}

            <button type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>

      <div className="login-right" aria-hidden="true" />
    </div>
  );
};

export default FrontPage;

