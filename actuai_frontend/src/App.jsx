// App.jsx — the composition root.
//
// Wires the providers and switches between two simple views:
//   • signed out -> LoginScreen
//   • signed in  -> AppShell + the validation Dashboard
//
// Cross-cutting state (auth, toasts) lives in providers so feature components
// stay small and testable.

import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ToastProvider, useToast } from "./components/ui";
import { useTasks } from "./hooks/useTasks.js";
import AppShell from "./components/AppShell.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import TaskList from "./components/TaskList.jsx";

function Dashboard() {
  const { token, user, signOut } = useAuth();
  const toast = useToast();
  const { tasks, status, error, deciding, decide, refresh } = useTasks({
    token,
    toast,
    onSessionExpired: () => {
      toast.error("Your session expired. Please sign in again.");
      signOut();
    },
  });

  return (
    <AppShell user={user} onSignOut={signOut}>
      <TaskList
        status={status}
        tasks={tasks}
        error={error}
        deciding={deciding}
        onDecide={decide}
        onRefresh={() => refresh()}
        refreshing={status === "ready"}
      />
    </AppShell>
  );
}

function Gate() {
  const { isAuthenticated, signIn } = useAuth();
  if (!isAuthenticated) return <LoginScreen onSubmit={signIn} />;
  return <Dashboard />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ToastProvider>
  );
}
