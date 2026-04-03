import { Link } from 'react-router-dom';
import MyResearch from './MyResearch';

const StudentPortfolio = () => {
  return (
    <div>
      <div className="max-w-7xl mx-auto px-4 pt-4">
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          Status updates are shown in-app via Notifications.
          {' '}
          <Link to="/notifications" className="font-semibold underline underline-offset-2 hover:text-sky-700">
            Open Notifications
          </Link>
          .
        </div>
      </div>
      <MyResearch />
    </div>
  );
};

export default StudentPortfolio;
