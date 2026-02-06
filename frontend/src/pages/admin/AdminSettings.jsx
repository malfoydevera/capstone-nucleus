import { Save, Lock, Bell, Globe } from 'lucide-react';

const AdminSettings = () => {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Configure global application preferences</p>
      </div>

      <div className="space-y-6">
        {/* General Settings */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 font-medium text-gray-700">
              <Globe size={18} /> General
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Repository Name</label>
              <input type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2" defaultValue="Capstone Research Repo" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="maintenance" className="rounded text-indigo-600" />
              <label htmlFor="maintenance" className="text-sm text-gray-700">Enable Maintenance Mode</label>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 font-medium text-gray-700">
              <Lock size={18} /> Security
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Student Registration</p>
                <p className="text-sm text-gray-500">Allow new students to register accounts</p>
              </div>
              <div className="flex items-center">
                 <button className="bg-indigo-600 relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none">
                   <span className="translate-x-5 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                 </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700">
            <Save size={18} /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;