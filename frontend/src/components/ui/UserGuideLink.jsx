import { Link } from 'react-router-dom';

const UserGuideLink = ({ className = 'mb-6' }) => (
  <p className={`text-sm text-slate-600 ${className}`}>
    <Link to="/guide" className="text-[#3674B5] font-medium hover:underline">
      View user guide
    </Link>
    {' '}
    for step-by-step help.
  </p>
);

export default UserGuideLink;
