import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Save, Shield, FileText, Loader2, Plus, Trash2 } from 'lucide-react';
import { authAPI, researchAPI } from '../../utils/api';

const WORKFLOW_ROLES = ['faculty', 'dean', 'program_chair', 'staff', 'admin'];

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [supportedTypes, setSupportedTypes] = useState(['pdf', 'doc', 'docx']);
  const [form, setForm] = useState({
    maxFileSizeMb: 10,
    allowedFileTypes: ['pdf'],
  });
  const [stagesLoading, setStagesLoading] = useState(true);
  const [stages, setStages] = useState([]);
  const [stageValidation, setStageValidation] = useState({ ok: true, warnings: [] });
  const [newStage, setNewStage] = useState({
    code: '',
    label: '',
    reviewerRole: 'faculty',
    position: 10,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await authAPI.getSystemPolicy();
        const data = response.data || {};
        setForm({
          maxFileSizeMb: Number(data.maxFileSizeMb) || 10,
          allowedFileTypes: Array.isArray(data.allowedFileTypes) && data.allowedFileTypes.length > 0
            ? data.allowedFileTypes
            : ['pdf'],
        });
        if (Array.isArray(data.supportedFileTypes) && data.supportedFileTypes.length > 0) {
          setSupportedTypes(data.supportedFileTypes);
        }
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to load system settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
    loadWorkflowStages();
  }, []);

  const loadWorkflowStages = async () => {
    try {
      const [stagesResponse, validationResponse] = await Promise.all([
        researchAPI.getWorkflowStages(),
        researchAPI.validateWorkflowStages(),
      ]);

      setStages(stagesResponse.data?.stages || []);
      setStageValidation(validationResponse.data?.validation || { ok: true, warnings: [] });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to load workflow stages');
      setStages([]);
      setStageValidation({ ok: true, warnings: [] });
    } finally {
      setStagesLoading(false);
    }
  };

  const toggleFileType = (type) => {
    setForm((prev) => {
      const hasType = prev.allowedFileTypes.includes(type);
      const nextTypes = hasType
        ? prev.allowedFileTypes.filter((value) => value !== type)
        : [...prev.allowedFileTypes, type];

      return {
        ...prev,
        allowedFileTypes: nextTypes,
      };
    });
  };

  const handleSave = async () => {
    if (!Number.isFinite(Number(form.maxFileSizeMb)) || Number(form.maxFileSizeMb) < 1 || Number(form.maxFileSizeMb) > 100) {
      toast.error('Max file size must be between 1 and 100 MB');
      return;
    }

    if (!form.allowedFileTypes.length) {
      toast.error('Select at least one allowed file type');
      return;
    }

    setSaving(true);
    const loadingToast = toast.loading('Saving settings...');
    try {
      const response = await authAPI.updateSystemPolicy({
        maxFileSizeMb: Number(form.maxFileSizeMb),
        allowedFileTypes: form.allowedFileTypes,
      });
      const data = response.data || {};
      setForm({
        maxFileSizeMb: Number(data.maxFileSizeMb) || Number(form.maxFileSizeMb),
        allowedFileTypes: Array.isArray(data.allowedFileTypes) ? data.allowedFileTypes : form.allowedFileTypes,
      });
      toast.success('System settings updated', { id: loadingToast });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save settings', { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateStage = async () => {
    if (!newStage.code.trim() || !newStage.label.trim()) {
      toast.error('Code and label are required');
      return;
    }

    try {
      await researchAPI.createWorkflowStage({
        code: newStage.code.trim(),
        label: newStage.label.trim(),
        reviewerRole: newStage.reviewerRole,
        position: Number(newStage.position) || 10,
      });
      setNewStage({ code: '', label: '', reviewerRole: 'faculty', position: 10 });
      await loadWorkflowStages();
      toast.success('Workflow stage created');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to create stage');
    }
  };

  const handleToggleStage = async (stage) => {
    try {
      await researchAPI.updateWorkflowStage(stage.id, { isActive: !stage.is_active });
      await loadWorkflowStages();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update stage');
    }
  };

  const handleDeleteStage = async (stageId) => {
    try {
      await researchAPI.deleteWorkflowStage(stageId);
      await loadWorkflowStages();
      toast.success('Workflow stage deleted');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete stage');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-600 font-semibold">
          <Loader2 className="animate-spin" size={18} />
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Configure institution-wide submission policies</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 font-medium text-gray-700">
              <FileText size={18} /> Submission Policy
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Maximum Upload Size (MB)</label>
              <input
                type="number"
                min={1}
                max={100}
                value={form.maxFileSizeMb}
                onChange={(event) => setForm((prev) => ({ ...prev, maxFileSizeMb: event.target.value }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#1C4D8D] focus:ring-[#1C4D8D] sm:text-sm border p-2"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Allowed File Types</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {supportedTypes.map((type) => {
                  const checked = form.allowedFileTypes.includes(type);
                  return (
                    <label key={type} className={`flex items-center gap-2 p-2 rounded-md border ${checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFileType(type)}
                        className="rounded text-[#1C4D8D]"
                      />
                      <span className="text-sm text-gray-700 uppercase">.{type}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 font-medium text-gray-700">
              <Shield size={18} /> Workflow Stages
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-700">Configure review stages shown in admin interfaces.</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input
                type="text"
                placeholder="code (e.g. pending_qc)"
                value={newStage.code}
                onChange={(event) => setNewStage((prev) => ({ ...prev, code: event.target.value }))}
                className="rounded-md border-gray-300 shadow-sm sm:text-sm border p-2"
              />
              <input
                type="text"
                placeholder="label"
                value={newStage.label}
                onChange={(event) => setNewStage((prev) => ({ ...prev, label: event.target.value }))}
                className="rounded-md border-gray-300 shadow-sm sm:text-sm border p-2"
              />
              <select
                value={newStage.reviewerRole}
                onChange={(event) => setNewStage((prev) => ({ ...prev, reviewerRole: event.target.value }))}
                className="rounded-md border-gray-300 shadow-sm sm:text-sm border p-2"
              >
                {WORKFLOW_ROLES.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={newStage.position}
                  onChange={(event) => setNewStage((prev) => ({ ...prev, position: event.target.value }))}
                  className="w-full rounded-md border-gray-300 shadow-sm sm:text-sm border p-2"
                />
                <button onClick={handleCreateStage} className="px-3 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {stagesLoading ? (
              <div className="text-sm text-gray-500">Loading stages...</div>
            ) : (
              <div className="space-y-3">
                {stageValidation.warnings?.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-800 mb-1">Workflow Validation Warnings</p>
                    <ul className="list-disc pl-5 text-xs text-amber-800 space-y-1">
                      {stageValidation.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {stages.map((stage) => (
                  <div key={stage.id} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{stage.label}</p>
                      <p className="text-xs text-gray-500">{stage.code} • role: {stage.reviewer_role} • position: {stage.position}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleStage(stage)}
                        className={`text-xs px-2 py-1 rounded ${stage.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {stage.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => handleDeleteStage(stage.id)}
                        className="p-1 rounded bg-red-50 text-red-600 hover:bg-red-100"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2 font-medium text-gray-700">
              <Shield size={18} /> Enforcement
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-700">
              Submission policy is enforced server-side for all uploads. Students and staff can only submit files that match these constraints.
            </p>
            <p className="text-xs text-gray-500">
              Supported file types in this system: {supportedTypes.map((type) => `.${type}`).join(', ')}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#1C4D8D] text-white px-6 py-2 rounded-lg hover:bg-[#163a6b] disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;