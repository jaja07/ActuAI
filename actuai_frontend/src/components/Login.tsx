import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { ShieldAlert, Loader2 } from 'lucide-react';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('engineer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password, role })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Registration failed');
        }

        const data = await response.json();
        login(data.access_token);
      } else {
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString()
        });

        if (!response.ok) {
          throw new Error('Invalid credentials');
        }

        const data = await response.json();
        login(data.access_token);
      }
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-8 shadow-2xl relative">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary-container rounded-full flex items-center justify-center mb-4 text-on-primary-container">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-headline-md font-bold text-on-surface">ActuAI Portal</h1>
          <p className="text-on-surface-variant text-body-md mt-2 text-center">
            {isRegistering ? 'Create a new account' : 'Human-in-the-Loop Validation Dashboard'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-error-container text-on-error-container rounded text-body-md font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-label-md text-on-surface uppercase mb-1 font-mono tracking-wider">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-outline rounded p-3 text-body-md bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              placeholder="e.g. expert"
              required
            />
          </div>

          <div>
            <label className="block text-label-md text-on-surface uppercase mb-1 font-mono tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-outline rounded p-3 text-body-md bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          {isRegistering && (
            <div>
              <label className="block text-label-md text-on-surface uppercase mb-1 font-mono tracking-wider">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full border border-outline rounded p-3 text-body-md bg-surface text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="engineer">Engineer</option>
                <option value="buyer">Buyer</option>
                <option value="compliance_officer">Compliance Officer</option>
                <option value="operator_admin">Operator Admin</option>
                <option value="auditor">Auditor</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary p-3 rounded font-bold mt-4 hover:opacity-90 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRegistering ? 'Create Account' : 'Authenticate')}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <button 
            type="button" 
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
            className="text-primary hover:underline text-sm font-medium"
          >
            {isRegistering ? 'Already have an account? Sign in' : 'Need an account? Create one'}
          </button>
        </div>

        {!isRegistering && (
          <div className="mt-8 pt-6 border-t border-outline-variant text-center">
            <p className="text-xs text-on-surface-variant font-mono">
              Demo Users: expert/expert123, buyer/buyer123, admin/admin123
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
