import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';

// ─── Always-eager (small auth/layout components) ──────────────────────────────
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';

// ─── P-003: Lazy-load all role-specific page components ────────────────────────
// This splits the bundle so each role only loads the code it actually uses.
const Landing               = lazy(() => import('./pages/Landing'));
const StudentDashboard      = lazy(() => import('./pages/student/StudentDashboard'));
const SubmitResearch        = lazy(() => import('./pages/student/SubmitResearch'));
const MyResearch            = lazy(() => import('./pages/student/MyResearch'));
const BrowseRepository      = lazy(() => import('./pages/student/BrowseRepository'));
const ResearchDetail        = lazy(() => import('./pages/student/ResearchDetail'));

const FacultyDashboard      = lazy(() => import('./pages/faculty/FacultyDashboard'));
const FacultyReview         = lazy(() => import('./pages/faculty/FacultyReview'));

const StaffDashboard        = lazy(() => import('./pages/staff/StaffDashboard'));
const ReviewSubmissions     = lazy(() => import('./pages/staff/ReviewSubmissions'));
const ReviewDetail          = lazy(() => import('./pages/staff/ReviewDetail'));
const StaffBrowseRepository = lazy(() => import('./pages/staff/StaffBrowseRepository'));

const AdminDashboard        = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminReviewSubmissions = lazy(() => import('./pages/admin/AdminReviewSubmissions'));
const UserManagement        = lazy(() => import('./pages/admin/UserManagement'));
const AdminAnalytics        = lazy(() => import('./pages/admin/AdminAnalytics'));

const DeanDashboard         = lazy(() => import('./pages/dean/DeanDashboard'));
const DeanChairDashboard    = lazy(() => import('./pages/dean/DeanChairDashboard'));
const DeanChairReview       = lazy(() => import('./pages/dean/DeanChairReview'));
const ProgramChairDashboard = lazy(() => import('./pages/dean/ProgramChairDashboard'));
const DeanActivityMonitor   = lazy(() => import('./pages/dean/DeanActivityMonitor'));
const DeanAuditLogs         = lazy(() => import('./pages/dean/DeanAuditLogs'));

const ProfileDashboard      = lazy(() => import('./pages/shared/ProfileDashboard'));

// ─── Suspense fallback spinner ─────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    <span className="sr-only">Loading page...</span>
  </div>
);

const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden p-4 md:p-8">
        {/* M-003: Each page gets its own error boundary so one crash doesn't break the whole layout */}
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
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
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) return <Navigate to="/login" />;

  switch (user.role) {
    case 'student':      return <StudentDashboard />;
    case 'faculty':      return <FacultyDashboard />;
    case 'dean':         return <DeanDashboard />;
    case 'program_chair': return <ProgramChairDashboard />;
    case 'staff':        return <StaffDashboard />;
    case 'admin':        return <AdminDashboard />;
    default:             return <Navigate to="/login" />;
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
    // M-003: Top-level ErrorBoundary catches errors outside the router (e.g., AuthContext crashes)
    <ErrorBoundary>
      <Router>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Landing Page */}
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
                  <ProtectedRoute allowedRoles={['student']}><MyResearch /></ProtectedRoute>
                } />
                <Route path="/student/submit" element={
                  <ProtectedRoute allowedRoles={['student', 'staff', 'admin']}><SubmitResearch /></ProtectedRoute>
                } />
                <Route path="/student/browse" element={
                  <ProtectedRoute allowedRoles={['student', 'staff', 'admin']}><BrowseRepository /></ProtectedRoute>
                } />
                <Route path="/profile" element={
                  <ProtectedRoute allowedRoles={['student', 'faculty', 'dean', 'program_chair', 'staff', 'admin']}>
                    <ProfileDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/student/profile" element={<Navigate to="/profile" replace />} />
                <Route path="/faculty/profile" element={<Navigate to="/profile" replace />} />

                {/* Research Detail View */}
                <Route path="/research/:id" element={
                  <ProtectedRoute allowedRoles={['student', 'faculty', 'dean', 'program_chair', 'staff', 'admin']}>
                    <ResearchDetail />
                  </ProtectedRoute>
                } />

                {/* Faculty Routes */}
                <Route path="/faculty/review" element={
                  <ProtectedRoute allowedRoles={['faculty']}><FacultyReview /></ProtectedRoute>
                } />
                <Route path="/faculty/review/:id" element={
                  <ProtectedRoute allowedRoles={['faculty', 'admin']}><ReviewDetail /></ProtectedRoute>
                } />
                <Route path="/faculty/repository" element={
                  <ProtectedRoute allowedRoles={['faculty']}><BrowseRepository /></ProtectedRoute>
                } />

                {/* Dean & Program Chair Routes */}
                <Route path="/dean/review" element={
                  <ProtectedRoute allowedRoles={['dean', 'program_chair']}><DeanChairReview /></ProtectedRoute>
                } />
                <Route path="/dean/review/:id" element={
                  <ProtectedRoute allowedRoles={['dean', 'program_chair', 'admin']}><ReviewDetail /></ProtectedRoute>
                } />
                <Route path="/dean/repository" element={
                  <ProtectedRoute allowedRoles={['dean', 'program_chair']}><BrowseRepository /></ProtectedRoute>
                } />
                <Route path="/dean/activity-monitor" element={
                  <ProtectedRoute allowedRoles={['dean']}><DeanActivityMonitor /></ProtectedRoute>
                } />
                <Route path="/dean/audit-logs" element={
                  <ProtectedRoute allowedRoles={['dean']}><DeanAuditLogs /></ProtectedRoute>
                } />

                {/* Staff Routes */}
                <Route path="/staff/review" element={
                  <ProtectedRoute allowedRoles={['staff', 'admin']}><ReviewSubmissions /></ProtectedRoute>
                } />
                <Route path="/staff/review/:id" element={
                  <ProtectedRoute allowedRoles={['staff', 'admin']}><ReviewDetail /></ProtectedRoute>
                } />
                <Route path="/staff/repository" element={
                  <ProtectedRoute allowedRoles={['staff']}><BrowseRepository /></ProtectedRoute>
                } />

                {/* Admin Routes */}
                <Route path="/admin/papers" element={
                  <ProtectedRoute allowedRoles={['admin']}><AdminReviewSubmissions /></ProtectedRoute>
                } />
                <Route path="/admin/review/:id" element={
                  <ProtectedRoute allowedRoles={['admin']}><ReviewDetail /></ProtectedRoute>
                } />
                <Route path="/admin/users" element={
                  <ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>
                } />
                <Route path="/admin/analytics" element={
                  <ProtectedRoute allowedRoles={['admin']}><AdminAnalytics /></ProtectedRoute>
                } />
              </Route>

              {/* Fallback redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default App;