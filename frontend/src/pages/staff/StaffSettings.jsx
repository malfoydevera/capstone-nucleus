import { useState } from 'react';
import { 
  User, 
  Bell, 
  Save, 
  Mail, 
  Briefcase, 
  Calendar, 
  Shield, 
  Lock, 
  Eye,
  EyeOff,
  Camera,
  Upload,
  CheckCircle,
  AlertCircle,
  Building,
  Phone,
  Globe,
  Users,
  FileText,
  Settings as SettingsIcon,
  Sparkles
} from 'lucide-react';

const StaffSettings = () => {
  const [settings, setSettings] = useState({
    fullName: 'Dr. Maria Santos',
    email: 'maria.santos@national-u.edu.ph',
    bio: 'Faculty Member - Computer Science Department\nSpecializing in Artificial Intelligence and Machine Learning',
    phone: '+63 912 345 6789',
    department: 'College of Computer Studies',
    office: 'CCS Building, Room 205',
    website: 'research.nu.edu.ph/msantos',
    notifications: {
      email: true,
      reviewRequests: true,
      paperUpdates: true,
      systemAlerts: false
    }
  });

  const [password, setPassword] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleNotificationChange = (key) => {
    setSettings(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: !prev.notifications[key]
      }
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPassword(prev => ({ ...prev, [name]: value }));
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  const departments = [
    'College of Computer Studies',
    'College of Engineering',
    'College of Business Administration',
    'College of Education',
    'College of Arts and Sciences',
    'College of Nursing'
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-500 flex items-center justify-center shadow-lg">
            <SettingsIcon size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
              Account <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">Settings</span>
            </h1>
            <p className="text-lg text-slate-600 font-medium">
              Manage your academic profile, preferences, and security
            </p>
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
              <Shield size={14} />
              Verified Staff Account
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 flex items-center gap-3 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg'
                    : 'bg-white text-slate-700 border border-slate-300 hover:border-indigo-300'
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Success Message */}
      {saved && (
        <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3 animate-fadeIn">
          <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-800">Settings saved successfully!</p>
            <p className="text-sm text-green-700">Your changes have been updated</p>
          </div>
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-8">
          {/* Profile Card */}
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
            <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center">
                  <User size={20} className="text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Personal Information</h2>
                  <p className="text-slate-600 text-sm">Update your academic profile</p>
                </div>
              </div>
            </div>

            <div className="p-8">
              {/* Avatar Section */}
              <div className="flex items-start gap-8 mb-10">
                <div className="relative">
                  <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white text-4xl font-bold shadow-xl">
                    MS
                  </div>
                  <button className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-gradient-to-br from-white to-slate-100 border border-slate-300 shadow-lg flex items-center justify-center text-slate-700 hover:text-indigo-600 transition-colors">
                    <Camera size={18} />
                  </button>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Profile Picture</h3>
                  <p className="text-slate-600 mb-4">
                    Upload a professional photo for your academic profile. Recommended: 500x500px, JPG or PNG
                  </p>
                  <button className="px-4 py-2 bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:border-indigo-300 transition-colors flex items-center gap-2">
                    <Upload size={16} />
                    Upload New Photo
                  </button>
                </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={16} className="text-indigo-600" />
                      Full Name
                    </div>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={settings.fullName}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium"
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail size={16} className="text-indigo-600" />
                      Email Address
                    </div>
                  </label>
                  <input
                    type="email"
                    value={settings.email}
                    disabled
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 font-medium"
                  />
                  <p className="text-xs text-slate-500">Institutional email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    <div className="flex items-center gap-2 mb-1">
                      <Phone size={16} className="text-indigo-600" />
                      Phone Number
                    </div>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={settings.phone}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium"
                    placeholder="+63 912 345 6789"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    <div className="flex items-center gap-2 mb-1">
                      <Building size={16} className="text-indigo-600" />
                      Department
                    </div>
                  </label>
                  <select
                    name="department"
                    value={settings.department}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium"
                  >
                    {departments.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase size={16} className="text-indigo-600" />
                      Office Location
                    </div>
                  </label>
                  <input
                    type="text"
                    name="office"
                    value={settings.office}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium"
                    placeholder="Building and room number"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    <div className="flex items-center gap-2 mb-1">
                      <Globe size={16} className="text-indigo-600" />
                      Website / Research Profile
                    </div>
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={settings.website}
                    onChange={handleProfileChange}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium"
                    placeholder="Your research profile URL"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-900">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={16} className="text-indigo-600" />
                      Academic Bio
                    </div>
                  </label>
                  <textarea
                    name="bio"
                    value={settings.bio}
                    onChange={handleProfileChange}
                    rows={4}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium resize-none"
                    placeholder="Briefly describe your academic background, research interests, and specialization..."
                  />
                  <p className="text-xs text-slate-500">
                    This will be visible on your public academic profile. Max 500 characters.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <Bell size={20} className="text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Notification Preferences</h2>
                <p className="text-slate-600 text-sm">Manage how you receive updates</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900 mb-1">Email Notifications</p>
                  <p className="text-sm text-slate-600">Receive updates via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.email}
                    onChange={() => handleNotificationChange('email')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900 mb-1">Review Requests</p>
                  <p className="text-sm text-slate-600">New papers assigned for review</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.reviewRequests}
                    onChange={() => handleNotificationChange('reviewRequests')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900 mb-1">Paper Status Updates</p>
                  <p className="text-sm text-slate-600">Updates on papers you're reviewing</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.paperUpdates}
                    onChange={() => handleNotificationChange('paperUpdates')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200">
                <div>
                  <p className="font-bold text-slate-900 mb-1">System Alerts</p>
                  <p className="text-sm text-slate-600">Important system-wide announcements</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.notifications.systemAlerts}
                    onChange={() => handleNotificationChange('systemAlerts')}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            <div className="mt-8 p-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
              <div className="flex items-start gap-3">
                <Bell size={20} className="text-blue-600 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-900 mb-1">Notification Schedule</p>
                  <p className="text-sm text-blue-700">
                    Notifications are delivered daily at 9:00 AM. Urgent alerts are sent immediately.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                <Shield size={20} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Security Settings</h2>
                <p className="text-slate-600 text-sm">Manage password and account security</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="space-y-6 mb-10">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock size={16} className="text-indigo-600" />
                    Current Password
                  </div>
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? "text" : "password"}
                    name="current"
                    value={password.current}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium pr-12"
                    placeholder="Enter current password"
                  />
                  <button
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock size={16} className="text-indigo-600" />
                    New Password
                  </div>
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    name="new"
                    value={password.new}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium pr-12"
                    placeholder="Enter new password"
                  />
                  <button
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-bold text-slate-900">
                  <div className="flex items-center gap-2 mb-1">
                    <Lock size={16} className="text-indigo-600" />
                    Confirm New Password
                  </div>
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    name="confirm"
                    value={password.confirm}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-3 bg-white border-2 border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300 font-medium pr-12"
                    placeholder="Confirm new password"
                  />
                  <button
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-amber-600 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900 mb-1">Password Requirements</p>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>• Minimum 8 characters</li>
                    <li>• At least one uppercase letter</li>
                    <li>• At least one number</li>
                    <li>• At least one special character (!@#$%^&*)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-blue-700 transition-all duration-500 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3"
        >
          {saving ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Saving...
            </>
          ) : (
            <>
              <Save size={18} />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default StaffSettings;