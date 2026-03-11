import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ThemeProvider } from './context/ThemeProvider';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
import CourseConsumption from './pages/CourseConsumption';
import TrainerDashboard from './pages/TrainerDashboard';
import LandingPage from './pages/LandingPage';

import { Toaster } from 'react-hot-toast';

const Unauthorized = () => <div className="min-h-screen flex items-center justify-center bg-base-200 text-base-content text-lg font-bold">You do not have permission to view this page.</div>;

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <ThemeSwitcher />
        <Toaster position="top-center" />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/" element={<LandingPage />} />

            <Route element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'TRAINER']} />}>
              <Route path="/course/:courseId" element={<CourseConsumption />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
              <Route path="/dashboard" element={<StudentDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['TRAINER']} />}>
              <Route path="/trainer" element={<TrainerDashboard />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}
export default App;