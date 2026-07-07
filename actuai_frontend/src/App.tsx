/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dashboard from './components/Dashboard';

import { AuthProvider, useAuth } from './AuthContext';
import Login from './components/Login';

function MainApp() {
  const { token } = useAuth();
  
  if (!token) {
    return <Login />;
  }

  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

