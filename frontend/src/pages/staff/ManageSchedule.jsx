import { CalendarDays, Clock, Plus } from 'lucide-react';

const ManageSchedule = () => {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Schedule</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your consultation and review availability</p>
        </div>
        <button className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700">
          <Plus size={18} /> Add Slot
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-8 text-center border-2 border-dashed border-gray-200">
        <CalendarDays className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900">Calendar Integration</h3>
        <p className="mt-2 text-gray-500 max-w-sm mx-auto">
          This feature will allow students to book consultation times with you directly.
        </p>
        <p className="mt-4 text-sm text-indigo-600 font-medium cursor-pointer">
          Connect Google Calendar →
        </p>
      </div>
    </div>
  );
};

export default ManageSchedule;