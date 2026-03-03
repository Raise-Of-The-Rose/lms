import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css';
// Placeholder components
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import AdminDashboard from './pages/AdminDashboard';
// src/App.tsx
import CourseConsumption from './pages/CourseConsumption';
import TrainerDashboard from './pages/TrainerDashboard';
const Unauthorized = () => <div>You do not have permission to view this page.</div>;

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Shared Protected Routes (Accessible by all roles) */}
          <Route element={<ProtectedRoute allowedRoles={['STUDENT', 'ADMIN', 'TRAINER']} />}>
            <Route path="/course/:courseId" element={<CourseConsumption />} />
          </Route>

          {/* Student Specific */}
          <Route element={<ProtectedRoute allowedRoles={['STUDENT']} />}>
            <Route path="/dashboard" element={<StudentDashboard />} />
          </Route>

          {/* Trainer Specific */}
          <Route element={<ProtectedRoute allowedRoles={['TRAINER']} />}>
            <Route path="/trainer" element={<TrainerDashboard />} />
          </Route>

          {/* Admin Specific */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          {/* Fallback for 404 */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
export default App;