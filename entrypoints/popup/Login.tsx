import React, { useState } from 'react';
import { signIn, signInWithGoogle } from '../lib/firebase';

interface LoginProps {
  onLoginSuccess: (authDetails: {
    userId: string;
    token: string;
    userEmail: string | null;
  }) => void;
  onError: (error: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(''); // Clear previous errors
    
    if (!email || !password) {
      setErrorMessage('Please enter both email and password');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const { user, token } = await signIn(email, password);
      onLoginSuccess({
        userId: user.uid,
        token,
        userEmail: user.email
      });
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle specific Firebase auth errors
      let errorMsg = 'Login failed. Please try again.';
      if (error.code === 'auth/user-not-found') {
        errorMsg = 'No account found with this email address.';
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMsg = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'Invalid email address.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = 'Too many failed attempts. Please try again later.';
      }
      
      setErrorMessage(errorMsg);
      onError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(''); // Clear previous errors
    setIsLoading(true);
    
    try {
      const { user, token } = await signInWithGoogle();
      onLoginSuccess({
        userId: user.uid,
        token,
        userEmail: user.email
      });
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      
      // Check if it's our custom message about using the web app
      if (error.message && error.message.includes('Please complete Google sign-in')) {
        setErrorMessage('Google sign-in opened in a new tab. Please complete the sign-in there, then log in here with your email/password.');
      } else {
        let errorMsg = 'Google sign-in failed. Please try again.';
        if (error.code === 'auth/popup-closed-by-user') {
          errorMsg = 'Sign-in cancelled.';
        } else if (error.code === 'auth/popup-blocked') {
          errorMsg = 'Please allow popups for this extension.';
        }
        setErrorMessage(errorMsg);
      }
      
      onError(errorMessage || error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openWebApp = () => {
    const webAppUrl = import.meta.env.DEV 
      ? 'http://localhost:3001/login'
      : 'https://www.mypostfolio.com/login';
    chrome.tabs.create({ url: webAppUrl });
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <img src="/icon/postfolio-logo-blue.png" alt="Postfolio" className="login-logo" />
        <h2 className="login-title">Sign in to Postfolio</h2>
        <p className="login-subtitle">Save web content to your personal knowledge base</p>
      </div>
      
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label htmlFor="email" className="form-label">Email</label>
          <input
            id="email"
            type="email"
            className="form-input"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            autoComplete="email"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password" className="form-label">Password</label>
          <div className="password-input-wrapper">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
            >
              {showPassword ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
          </div>
        </div>
        
        <button
          type="submit"
          className="primary-action login-button"
          disabled={isLoading || !email || !password}
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
        
        <div className="divider">
          <span>or</span>
        </div>
        
        <button
          type="button"
          className="google-signin-button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
        >
          <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {isLoading ? 'Signing in...' : 'Continue with Google'}
        </button>
      </form>
      
      <div className="login-footer">
        <p className="login-footer-text">
          Don't have an account?{' '}
          <button onClick={openWebApp} className="link-button">
            Create one on Postfolio
          </button>
        </p>
        <p className="login-footer-text">
          <button onClick={openWebApp} className="link-button">
            Forgot password?
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login; 