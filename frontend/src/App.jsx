import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import AuthCallback from './components/auth/AuthCallback';
import CoAuthorInvitations from './pages/student/CoAuthorInvitations';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import StudentDashboard from './pages/student/StudentDashboard';
import StaffDashboard from './pages/staff/StaffDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import SubmitResearch from './pages/student/SubmitResearch';
import MyResearch from './pages/student/MyResearch';
import SubmissionUpdates from './pages/student/SubmissionUpdates';
import BrowseRepository from './pages/student/BrowseRepository';
import ReviewSubmissions from './pages/staff/ReviewSubmissions';
import FacultyReview from './pages/faculty/FacultyReview';
import AdminReviewSubmissions from './pages/admin/AdminReviewSubmissions';
import DeanChairReview from './pages/dean/DeanChairReview';
import DeanDashboard from './pages/dean/DeanDashboard';
import ProgramChairDashboard from './pages/dean/ProgramChairDashboard';
import DeanActivityMonitor from './pages/dean/DeanActivityMonitor';
import DeanAuditLogs from './pages/dean/DeanAuditLogs';
import UserManagement from './pages/admin/UserManagement';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import ProfileDashboard from './pages/shared/ProfileDashboard';
import Notifications from './pages/shared/Notifications';
import UserGuide from './pages/shared/UserGuide';

const Landing = lazy(() => import('./pages/Landing'));
const ResearchDetail = lazy(() => import('./pages/student/ResearchDetail'));
const ReviewDetail = lazy(() => import('./pages/staff/ReviewDetail'));

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3674B5]" />
    <span className="sr-only">Loading page...</span>
  </div>
);

const DashboardLayout = () => {
  return (
    <div className="flex min-h-svh bg-transparent">
      <a href="#main-content" className="app-skip-link">Skip to main content</a>
      <Sidebar />
      <main id="main-content" className="app-main-content flex flex-col flex-1 min-h-0 overflow-x-hidden">
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
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3674B5]"></div>
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
    case 'dean':
      return <DeanDashboard />;
    case 'program_chair':
      return <ProgramChairDashboard />;
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
        className="mt-6 px-4 py-2 bg-[#3674B5] text-white rounded-lg hover:bg-[#2d6299]"
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
          <Route
            path="/"
            element={(
              <Suspense fallback={<RouteFallback />}>
                <Landing />
              </Suspense>
            )}
          />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/unauthorized" element={<Unauthorized />} />

          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardRouter />} />

            <Route path="/student/my-research/:id" element={
              <ProtectedRoute allowedRoles={['student']}>
                <SubmissionUpdates />
              </ProtectedRoute>
            } />
            <Route path="/student/submission/:id" element={
              <ProtectedRoute allowedRoles={['student']}>
                <SubmissionUpdates />
              </ProtectedRoute>
            } />
            <Route path="/student/my-research" element={
              <ProtectedRoute allowedRoles={['student']}>
                <MyResearch />
              </ProtectedRoute>
            } />
            <Route path="/student/portfolio" element={<Navigate to="/student/my-research" replace />} />
            <Route path="/student/submit" element={
              <ProtectedRoute allowedRoles={['student', 'staff', 'admin']}>
                <SubmitResearch />
              </ProtectedRoute>
            } />
            <Route path="/student/co-author-invitations" element={
              <ProtectedRoute allowedRoles={['student']}>
                <CoAuthorInvitations />
              </ProtectedRoute>
            } />
            <Route path="/student/browse" element={
              <ProtectedRoute allowedRoles={['student', 'staff', 'admin']}>
                <BrowseRepository />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute allowedRoles={['student', 'faculty', 'dean', 'program_chair', 'staff', 'admin']}>
                <ProfileDashboard />
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute allowedRoles={['student', 'faculty', 'dean', 'program_chair', 'staff', 'admin']}>
                <Notifications />
              </ProtectedRoute>
            } />
            <Route path="/guide" element={
              <ProtectedRoute allowedRoles={['student', 'faculty', 'dean', 'program_chair', 'staff', 'admin']}>
                <UserGuide />
              </ProtectedRoute>
            } />
            <Route path="/student/profile" element={<Navigate to="/profile" replace />} />
            <Route path="/faculty/profile" element={<Navigate to="/profile" replace />} />

            <Route path="/research/:id" element={
              <ProtectedRoute allowedRoles={['student', 'faculty', 'dean', 'program_chair', 'staff', 'admin']}>
                <Suspense fallback={<RouteFallback />}>
                  <ResearchDetail />
                </Suspense>
              </ProtectedRoute>
            } />

            <Route path="/faculty/review" element={
              <ProtectedRoute allowedRoles={['faculty']}>
                <FacultyReview />
              </ProtectedRoute>
            } />
            <Route path="/faculty/review/:id" element={
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <Suspense fallback={<RouteFallback />}>
                  <ReviewDetail />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/faculty/repository" element={
              <ProtectedRoute allowedRoles={['faculty']}>
                <BrowseRepository />
              </ProtectedRoute>
            } />

            <Route path="/dean/review" element={
              <ProtectedRoute allowedRoles={['dean', 'program_chair']}>
                <DeanChairReview />
              </ProtectedRoute>
            } />
            <Route path="/program-chair/review" element={
              <ProtectedRoute allowedRoles={['program_chair']}>
                <DeanChairReview />
              </ProtectedRoute>
            } />
            <Route path="/dean/review/:id" element={
              <ProtectedRoute allowedRoles={['dean', 'program_chair', 'admin']}>
                <Suspense fallback={<RouteFallback />}>
                  <ReviewDetail />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/program-chair/review/:id" element={
              <ProtectedRoute allowedRoles={['program_chair', 'admin']}>
                <Suspense fallback={<RouteFallback />}>
                  <ReviewDetail />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/dean/repository" element={
              <ProtectedRoute allowedRoles={['dean', 'program_chair']}>
                <BrowseRepository />
              </ProtectedRoute>
            } />
            <Route path="/program-chair/repository" element={
              <ProtectedRoute allowedRoles={['program_chair']}>
                <BrowseRepository />
              </ProtectedRoute>
            } />
            <Route path="/program-chair/analytics" element={
              <ProtectedRoute allowedRoles={['program_chair']}>
                <ProgramChairDashboard />
              </ProtectedRoute>
            } />

            <Route path="/dean/activity-monitor" element={
              <ProtectedRoute allowedRoles={['dean']}>
                <DeanActivityMonitor />
              </ProtectedRoute>
            } />
            <Route path="/dean/audit-logs" element={
              <ProtectedRoute allowedRoles={['dean']}>
                <DeanAuditLogs />
              </ProtectedRoute>
            } />

            <Route path="/staff/review" element={
              <ProtectedRoute allowedRoles={['staff', 'admin']}>
                <ReviewSubmissions />
              </ProtectedRoute>
            } />
            <Route path="/staff/review/:id" element={
              <ProtectedRoute allowedRoles={['staff', 'admin']}>
                <Suspense fallback={<RouteFallback />}>
                  <ReviewDetail />
                </Suspense>
              </ProtectedRoute>
            } />
            <Route path="/staff/repository" element={
              <ProtectedRoute allowedRoles={['staff']}>
                <BrowseRepository />
              </ProtectedRoute>
            } />
            <Route path="/admin/papers" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminReviewSubmissions />
              </ProtectedRoute>
            } />
            <Route path="/admin/review/:id" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <Suspense fallback={<RouteFallback />}>
                  <ReviewDetail />
                </Suspense>
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
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
