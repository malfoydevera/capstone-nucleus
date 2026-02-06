import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import StudentDashboard from './pages/student/StudentDashboard';
import StaffDashboard from './pages/staff/StaffDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import SubmitResearch from './pages/student/SubmitResearch';
import MyResearch from './pages/student/MyResearch';
import BrowseRepository from './pages/student/BrowseRepository';
import ReviewSubmissions from './pages/staff/ReviewSubmissions';
import FacultyReview from './pages/faculty/FacultyReview';
import ReviewDetail from './pages/staff/ReviewDetail';
import AdminReviewSubmissions from './pages/admin/AdminReviewSubmissions';

// NEW IMPORTS
import Landing from './pages/Landing'; 
import UserManagement from './pages/admin/UserManagement';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminSettings from './pages/admin/AdminSettings';
import ManageSchedule from './pages/staff/ManageSchedule';
import StaffSettings from './pages/staff/StaffSettings';

// NEW IMPORT for Research Detail View
import ResearchDetail from './pages/student/ResearchDetail';

const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
};

/**
 * DashboardRouter handles the landing logic for authenticated users.
 * It waits for the AuthProvider's loading state to complete before 
 * deciding whether to show a dashboard or redirect to login.
 */
const DashboardRouter = () => {
  const { user, loading } = useAuth(); // Destructure loading to handle page refreshes

  // Fix for reload issue: show loading spinner while checkAuth is running
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <span className="sr-only">Verifying session...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" />;

  switch (user.role) {
    case 'student':
      return <StudentDashboard />;
    case 'faculty':
      return <FacultyDashboard />;
    case 'staff':
      return <StaffDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <Navigate to="/login" />;
  }
};

const Unauthorized = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-6xl font-bold text-red-600">403</h1>
      <p className="mt-4 text-xl text-gray-700">Unauthorized Access</p>
      <p className="mt-2 text-gray-600">You don't have permission to access this page.</p>
      <button
        onClick={() => window.history.back()}
        className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        Go Back
      </button>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Landing Page as the default route - Users see this first */}
          <Route path="/" element={<Landing />} />
          
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          {/* Protected Routes: Only accessible after login */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardRouter />} />
            
            {/* Student Specific Routes */}
            <Route path="/student/my-research" element={
              <ProtectedRoute allowedRoles={['student']}>
                <MyResearch />
              </ProtectedRoute>
            } />
            <Route path="/student/submit" element={
              <ProtectedRoute allowedRoles={['student', 'staff', 'admin']}>
                <SubmitResearch />
              </ProtectedRoute>
            } />
            <Route path="/student/browse" element={
              <ProtectedRoute allowedRoles={['student', 'staff', 'admin']}>
                <BrowseRepository />
              </ProtectedRoute>
            } />
            
            {/* Research Detail View - Accessible to all authenticated users */}
            <Route path="/research/:id" element={
              <ProtectedRoute allowedRoles={['student', 'faculty', 'staff', 'admin']}>
                <ResearchDetail />
              </ProtectedRoute>
            } />

            {/* Faculty Specific Routes */}
            <Route path="/faculty/review" element={
              <ProtectedRoute allowedRoles={['faculty']}>
                <FacultyReview />
              </ProtectedRoute>
            } />
            <Route path="/faculty/review/:id" element={
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <ReviewDetail />
              </ProtectedRoute>
            } />

            {/* Staff Specific Routes */}
            <Route path="/staff/review" element={
              <ProtectedRoute allowedRoles={['staff', 'admin']}>
                <ReviewSubmissions />
              </ProtectedRoute>
            } />
            <Route path="/staff/review/:id" element={
              <ProtectedRoute allowedRoles={['staff', 'admin']}>
                <ReviewDetail />
              </ProtectedRoute>
            } />
            <Route path="/staff/my-research" element={
              <ProtectedRoute allowedRoles={['staff']}>
                <MyResearch />
              </ProtectedRoute>
            } />
            <Route path="/staff/schedule" element={
              <ProtectedRoute allowedRoles={['staff']}>
                <ManageSchedule />
              </ProtectedRoute>
            } />
            <Route path="/staff/settings" element={
              <ProtectedRoute allowedRoles={['staff']}>
                <StaffSettings />
              </ProtectedRoute>
            } />

            {/* Admin Specific Routes */}
            <Route path="/admin/papers" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminReviewSubmissions />
              </ProtectedRoute>
            } />
            <Route path="/admin/review/:id" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ReviewDetail />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserManagement />
              </ProtectedRoute>
            } />
            <Route path="/admin/analytics" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAnalytics />
              </ProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminSettings />
              </ProtectedRoute>
            } />
          </Route>

          {/* Fallback redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;