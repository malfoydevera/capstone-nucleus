import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { 
  Upload, 
  FileText, 
  X, 
  AlertCircle, 
  CheckCircle, 
  BookOpen,
  Tag,
  Users,
  User,
  FolderOpen,
  PenTool,
  Sparkles,
  ArrowLeft,
  Loader2,
  FileCheck,
  Search,
  Plus,
  UserPlus
} from 'lucide-react';
import { researchAPI, authAPI, departmentsAPI, unwrapApiData } from '../../utils/api';
import { formatFullName } from '../../utils/names';
import UserGuideLink from '../../components/ui/UserGuideLink';

const TYPE_TO_MIME = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const getStructuredCoAuthors = (paper) =>
  Array.isArray(paper?.structured_authors)
    ? paper.structured_authors
        .filter((entry) => !entry?.is_primary && entry?.author?.id)
        .map((entry) => entry.author)
    : [];

const resolveExternalAuthorNotes = (paper) =>
  String(paper?.external_author_notes || '').trim();

const SubmitResearch = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  const resubmitData = location.state?.resubmit; 

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [facultyMembers, setFacultyMembers] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Co-authors state
  const [selectedCoAuthors, setSelectedCoAuthors] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [step, setStep] = useState(1);
  const [fieldErrors, setFieldErrors] = useState({});
  const [draftSyncMessage, setDraftSyncMessage] = useState('');
  const [submissionPolicy, setSubmissionPolicy] = useState({
    maxFileSizeMb: 10,
    allowedFileTypes: ['pdf'],
  });
  
  const [formData, setFormData] = useState({
    title: resubmitData?.title || '',
    abstract: resubmitData?.abstract || '',
    keywords: resubmitData?.keywords?.join(', ') || '',
    coAuthors: resolveExternalAuthorNotes(resubmitData),
    category: resubmitData?.category || '',
    facultyId: resubmitData?.faculty_id || '',
    department: resubmitData?.department || '',
    departmentId: '',
    doi: resubmitData?.doi || '',
  });

  useEffect(() => {
    fetchCategories();
    fetchDepartments();
    fetchSubmissionPolicy();
  }, []);

  const fetchSubmissionPolicy = async () => {
    try {
      const response = await authAPI.getSubmissionPolicy();
      const data = unwrapApiData(response);
      setSubmissionPolicy({
        maxFileSizeMb: Number(data.maxFileSizeMb) || 10,
        allowedFileTypes: Array.isArray(data.allowedFileTypes) && data.allowedFileTypes.length > 0
          ? data.allowedFileTypes
          : ['pdf'],
      });
    } catch (err) {
      console.error('Failed to fetch submission policy:', err);
    }
  };

  const getDraftStorageKey = () => {
    const draftId = resubmitData?.id || 'new';
    return `submission_draft_${draftId}`;
  };

  const buildDraftPayload = () => ({
    formData,
    selectedCoAuthors,
    hasNewFile: Boolean(file),
    updatedAt: new Date().toISOString(),
  });

  const hasAnyDraftContent = () => {
    const hasText = [formData.title, formData.abstract, formData.keywords, formData.coAuthors]
      .some((value) => String(value || '').trim().length > 0);
    return hasText || Boolean(formData.category) || Boolean(formData.facultyId) || Boolean(formData.departmentId) || selectedCoAuthors.length > 0;
  };

  const restoreDraft = async () => {
    const storageKey = getDraftStorageKey();
    let selectedCoAuthorsRestored = false;

    try {
      const localRaw = localStorage.getItem(storageKey);
      if (localRaw) {
        const localDraft = JSON.parse(localRaw);
        if (localDraft?.formData) {
          setFormData((prev) => ({ ...prev, ...localDraft.formData }));
        }
        if (Array.isArray(localDraft?.selectedCoAuthors)) {
          setSelectedCoAuthors(localDraft.selectedCoAuthors);
          selectedCoAuthorsRestored = true;
        }
      }
    } catch (err) {
      console.error('Failed to restore local draft:', err);
    }

    try {
      const response = await researchAPI.getMyDraft(resubmitData?.id || undefined);
      const serverDraft = unwrapApiData(response).draft?.draft_data;
      if (serverDraft?.formData) {
        setFormData((prev) => ({ ...prev, ...serverDraft.formData }));
      }
      if (Array.isArray(serverDraft?.selectedCoAuthors)) {
        setSelectedCoAuthors(serverDraft.selectedCoAuthors);
        selectedCoAuthorsRestored = true;
      }
      if (serverDraft) {
        setDraftSyncMessage('Draft restored');
      }
    } catch (err) {
      console.error('Failed to restore server draft:', err);
    }

    if (!selectedCoAuthorsRestored && resubmitData?.id) {
      try {
        const response = await researchAPI.getResearchById(resubmitData.id);
        const detailPaper = unwrapApiData(response).paper;
        const structuredCoAuthors = getStructuredCoAuthors(detailPaper);

        if (structuredCoAuthors.length > 0) {
          setSelectedCoAuthors(structuredCoAuthors);
        }
      } catch (err) {
        console.error('Failed to hydrate structured co-authors for resubmission:', err);
      }
    }
  };

  useEffect(() => {
    restoreDraft();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!hasAnyDraftContent() || loading) return;

      const payload = buildDraftPayload();
      const storageKey = getDraftStorageKey();

      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (err) {
        console.error('Failed to save local draft:', err);
      }

      try {
        await researchAPI.saveMyDraft(resubmitData?.id || null, payload);
        setDraftSyncMessage(`Draft synced at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      } catch (err) {
        console.error('Failed to sync draft:', err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [formData, selectedCoAuthors, file, loading]);

  useEffect(() => {
    fetchFacultyMembers({ department: formData.department || undefined, departmentId: formData.departmentId || undefined });
  }, [formData.department, formData.departmentId]);

  const fetchCategories = async () => {
    try {
      const response = await researchAPI.getCategories();
      const list = unwrapApiData(response).categories || [];
      setCategories(list);

      if (formData.category) {
        const hasDirectMatch = list.some((category) => category.id === formData.category);
        if (!hasDirectMatch) {
          const matchedCategory = list.find(
            (category) => String(category.name || '').toLowerCase() === String(formData.category || '').toLowerCase()
          );

          if (matchedCategory) {
            setFormData((prev) => ({
              ...prev,
              category: matchedCategory.id,
            }));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      setCategories([]); // Set empty array on error
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentsAPI.getAll();
      const list = unwrapApiData(response).departments || [];
      setDepartments(list);

      if (!formData.departmentId && formData.department) {
        const normalized = formData.department.toLowerCase();
        const matched = list.find(
          (d) => (d.name || '').toLowerCase() === normalized || (d.code || '').toLowerCase() === normalized
        );
        if (matched) {
          setFormData((prev) => ({
            ...prev,
            departmentId: matched.id,
            department: matched.name,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
      setDepartments([]);
    }
  };

  const fetchFacultyMembers = async ({ department, departmentId } = {}) => {
    try {
      const response = await researchAPI.getFacultyMembers({ department, departmentId });
      setFacultyMembers(unwrapApiData(response).facultyMembers || []);
    } catch (err) {
      console.error('Failed to fetch faculty members:', err);
      setFacultyMembers([]); // Set empty array on error
    }
  };

  const onDrop = async (acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      const uploadedFile = acceptedFiles[0];
      setFile(uploadedFile);
      setError('');
      // Simulate upload progress for better UX
      simulateUploadProgress();
    }
  };


  const onDropRejected = (rejections) => {
    const firstError = rejections?.[0]?.errors?.[0];
    if (!firstError) return;

    if (firstError.code === 'file-too-large') {
      const message = `File is too large. Max allowed size is ${submissionPolicy.maxFileSizeMb} MB.`;
      setError(message);
      toast.error(message);
      return;
    }

    if (firstError.code === 'file-invalid-type') {
      const message = `Invalid file type. Allowed types: ${submissionPolicy.allowedFileTypes.map((type) => `.${type}`).join(', ')}`;
      setError(message);
      toast.error(message);
      return;
    }

    setError(firstError.message || 'Invalid file upload');
  };

  const acceptedMimeMap = submissionPolicy.allowedFileTypes.reduce((acc, type) => {
    const mime = TYPE_TO_MIME[type];
    if (mime) {
      acc[mime] = [`.${type}`];
    }
    return acc;
  }, {});

  const simulateUploadProgress = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: acceptedMimeMap,
    maxFiles: 1,
    maxSize: submissionPolicy.maxFileSizeMb * 1024 * 1024,
  });

  const handleChange = (e) => {
    if (e.target.name === 'departmentId') {
      const selectedDepartment = departments.find((dept) => dept.id === e.target.value);
      setFormData({
        ...formData,
        departmentId: e.target.value,
        department: selectedDepartment?.name || '',
      });
      return;
    }

    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Search for students as co-authors
  const handleStudentSearch = async (query) => {
    setStudentSearch(query);
    
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    setSearchLoading(true);
    setShowSearchDropdown(true);
    
    try {
      const response = await authAPI.searchStudents(query);
      setSearchResults(response.data.students || []);
    } catch (error) {
      console.error('Error searching students:', error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const addCoAuthor = (student) => {
    if (!selectedCoAuthors.find(a => a.id === student.id)) {
      setSelectedCoAuthors([...selectedCoAuthors, student]);
      toast.success(`Added ${formatFullName(student)} as co-author`, {
        duration: 2000,
      });
    }
    setStudentSearch('');
    setSearchResults([]);
    setShowSearchDropdown(false);
  };

  const removeCoAuthor = (studentId) => {
    setSelectedCoAuthors(selectedCoAuthors.filter(a => a.id !== studentId));
    toast('Co-author removed', {
      duration: 2000,
    });
  };

  const submitResearch = async () => {
    setError('');
    setSuccess(false);
    setUploadProgress(0);

    if (!file && !resubmitData) {
      setError('Please upload a PDF file');
      return;
    }

    if (!formData.title || !formData.abstract || !formData.category) {
      setError('Please fill in all required fields');
      return;
    }

    // Make faculty optional for testing - just warn if not selected
    if (!formData.facultyId && !resubmitData) {
      console.warn('No faculty advisor selected - submission will proceed without faculty assignment');
    }

    setLoading(true);
    simulateUploadProgress(); // Start progress simulation

    try {
      const submitData = new FormData();
      
      if (resubmitData?.id) {
        submitData.append('id', resubmitData.id);
      }

      if (file) {
        submitData.append('file', file);
      }
      
      submitData.append('title', formData.title);
      submitData.append('abstract', formData.abstract);
      submitData.append('keywords', formData.keywords);
      submitData.append('coAuthors', formData.coAuthors);
      submitData.append('externalAuthorNotes', formData.coAuthors);
      submitData.append('category', formData.category);
      submitData.append('facultyId', formData.facultyId);
      submitData.append('department', formData.department);
      submitData.append('departmentId', formData.departmentId);

      const trimmedDoi = formData.doi?.trim() || '';
      if (trimmedDoi) {
        if (!/^(https?:\/\/(dx\.)?doi\.org\/)?10\.\d{4,9}\/\S+$/i.test(trimmedDoi)) {
          toast('DOI format looks unusual. Verify it is correct before submitting.', { icon: '⚠️' });
        }
        submitData.append('doi', trimmedDoi);
      }

      const submissionResponse = await researchAPI.submitResearch(submitData);
      const researchId = submissionResponse?.data?.data?.research?.id || submissionResponse?.data?.research?.id;

      if (researchId && selectedCoAuthors.length > 0) {
        try {
          const inviteResponse = await researchAPI.createCoAuthorInvitations(
            researchId,
            selectedCoAuthors.map((author) => author.id)
          );
          const createdCount = inviteResponse?.data?.data?.created?.length || 0;
          if (createdCount > 0) {
            toast.success(`${createdCount} co-author invitation${createdCount > 1 ? 's were' : ' was'} sent`);
          }
        } catch (inviteError) {
          console.error('Co-author invite error:', inviteError);
          toast.error('Paper submitted, but failed to send one or more co-author invitations');
        }
      }

      const storageKey = getDraftStorageKey();
      localStorage.removeItem(storageKey);
      try {
        await researchAPI.deleteMyDraft(resubmitData?.id || null);
      } catch (draftDeleteErr) {
        console.error('Failed to delete server draft after submit:', draftDeleteErr);
      }
      
      toast.success(resubmitData ? 'Research resubmitted successfully.' : 'Research submitted successfully.', {
        duration: 3000,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/student/my-research');
      }, 2000);
    } catch (err) {
      console.error('Submission error:', err);
      const errorMessage =
        err.response?.data?.error?.message
        || err.response?.data?.message
        || (typeof err.response?.data?.error === 'string' ? err.response.data.error : null)
        || err.message
        || 'Failed to submit research';
      toast.error(errorMessage, {
        duration: 4000,
      });
      setError(errorMessage);
      console.error('Full error details:', err.response?.data || err);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const hasLegacyCategorySelection = Boolean(
    formData.category && !categories.some((category) => category.id === formData.category)
  );

  const validateStep = (stepNumber) => {
    const errors = {};
    if (stepNumber === 1 && !file && !resubmitData?.file_name) {
      errors.file = 'Upload a PDF before continuing.';
    }
    if (stepNumber === 2) {
      if (!formData.title?.trim()) errors.title = 'Title is required.';
      if (!formData.abstract?.trim()) errors.abstract = 'Abstract is required.';
      if (!formData.category) errors.category = 'Select a research category.';
    }
    if (stepNumber === 3 && !formData.facultyId && !resubmitData?.faculty_id) {
      errors.facultyId = 'Faculty adviser is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const goNext = () => {
    if (validateStep(step)) setStep((current) => Math.min(3, current + 1));
  };

  const goBack = () => {
    setFieldErrors({});
    setStep((current) => Math.max(1, current - 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      if (!validateStep(step)) return;
      if (!validateStep(1)) setStep(1);
      else if (!validateStep(2)) setStep(2);
      else setStep(3);
      return;
    }
    await submitResearch();
  };

  const stepLabels = ['Upload', 'Details', 'People'];

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fadeIn">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/student/my-research')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-50 to-white border border-slate-200 text-slate-700 font-semibold hover:from-slate-100 hover:to-white transition-all duration-300 transform hover:-translate-x-1"
          >
            <ArrowLeft size={18} />
            Back to Research
          </button>
        </div>
        
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3674B5] to-[#578FCA] flex items-center justify-center shadow-lg">
            <PenTool size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-2">
              {resubmitData ? 'Resubmit Research' : 'Submit New Research'}
            </h1>
            <p className="text-lg text-slate-600 font-medium">
              {resubmitData 
                ? `Update and improve your research submission`
                : 'Share your academic work with the university community'}
            </p>
            {resubmitData && (
              <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-700 text-sm font-semibold">
                <FileCheck size={14} />
                Updating: "{resubmitData.title}"
              </div>
            )}
            {resubmitData?.revision_notes && (
              <div className="mt-4 p-4 rounded-xl bg-orange-50 border border-orange-200">
                <p className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                  <AlertCircle size={16} />
                  Reviewer's Revision Notes:
                </p>
                <p className="text-sm text-orange-700">{resubmitData.revision_notes}</p>
              </div>
            )}
          </div>
          <div className="hidden md:block">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-700 text-sm font-semibold">
              <Sparkles size={14} />
              Academic Integrity Verified
            </div>
          </div>
        </div>

        <UserGuideLink />
        <ol className="mt-6 flex flex-wrap gap-2" aria-label="Submission steps">
          {stepLabels.map((label, index) => {
            const stepNumber = index + 1;
            const active = step === stepNumber;
            const done = step > stepNumber;
            return (
              <li
                key={label}
                className={`px-4 py-2 rounded-full text-sm font-semibold border ${
                  active
                    ? 'bg-[#3674B5] text-white border-[#3674B5]'
                    : done
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                {stepNumber}. {label}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 flex items-start gap-4 animate-slideInDown">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-green-900 mb-1">Research Submitted Successfully!</h3>
            <p className="text-green-700">
              Your research has been sent for academic review. You'll receive notifications about the review progress.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
              <Loader2 size={14} className="animate-spin" />
              Redirecting to your research dashboard...
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-8 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4 animate-shake">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-red-900 mb-1">Submission Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="bg-gradient-to-br from-white to-slate-50 rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        {/* Form Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3674B5]/10 to-[#578FCA]/10 flex items-center justify-center">
              <BookOpen size={20} className="text-[#3674B5]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Research Details</h2>
              <p className="text-slate-600 text-sm font-medium">Fill in all required academic information</p>
              {draftSyncMessage && (
                <p className="text-xs text-emerald-700 font-semibold mt-1">{draftSyncMessage}</p>
              )}
            </div>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={20} className="text-[#3674B5]" />
              <label className="block text-lg font-bold text-slate-900">
                Research Paper (PDF) {resubmitData ? '(Optional if keeping current)' : <span className="text-red-500">*</span>}
              </label>
            </div>
            
            {!file ? (
              <div
                {...getRootProps()}
                className={`border-3 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-500 transform hover:scale-[1.01] ${
                  isDragActive
                    ? 'border-[#3674B5] bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10 border-solid'
                    : 'border-slate-300 hover:border-[#3674B5] hover:bg-gradient-to-r from-slate-50 to-white'
                }`}
              >
                <input {...getInputProps()} />
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#3674B5]/10 to-[#578FCA]/10 flex items-center justify-center mx-auto mb-6">
                  <Upload size={32} className="text-[#3674B5]" />
                </div>
                {isDragActive ? (
                  <p className="text-xl font-bold text-[#3674B5] mb-2">Drop PDF Here</p>
                ) : (
                  <>
                    <p className="text-lg font-bold text-slate-900 mb-2">
                      {resubmitData 
                        ? 'Drag & drop to replace current PDF'
                        : 'Drag & drop your research PDF here'}
                    </p>
                    <p className="text-slate-600 mb-4">or click to browse files</p>
                  </>
                )}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-slate-100 to-white border border-slate-300 text-slate-700 text-sm font-semibold">
                  <FileText size={14} />
                  {submissionPolicy.allowedFileTypes.map((type) => `.${type}`).join(', ')} • Max {submissionPolicy.maxFileSizeMb}MB
                </div>
              </div>
            ) : (
              <div className="border-2 border-slate-300 rounded-2xl p-6 bg-gradient-to-r from-white to-slate-50 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
                      <FileText size={28} className="text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg mb-1">{file.name}</h4>
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                        <span className="px-2 py-1 rounded-full bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 text-xs font-bold">
                          {String(file.name || '').split('.').pop()?.toUpperCase() || 'FILE'} Format
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-2 rounded-xl bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-600 hover:from-red-100 hover:to-pink-100 transition-all duration-300 transform hover:scale-110"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                {/* Upload Progress Bar */}
                {uploadProgress > 0 && uploadProgress < 100 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">Uploading...</span>
                      <span className="font-bold text-[#3674B5]">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-gradient-to-r from-slate-200 to-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#3674B5] to-[#578FCA] transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {resubmitData && !file && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200">
                <FileText size={16} className="text-amber-600" />
                <p className="text-sm font-medium text-amber-700">
                  Current file: <span className="font-bold">{resubmitData.file_name}</span>
                </p>
              </div>
            )}
            {fieldErrors.file && <p className="text-sm text-red-600">{fieldErrors.file}</p>}
          </div>
          )}

          {step === 2 && (
          <>
          <div className="space-y-3">
            <label htmlFor="title" className="block text-lg font-bold text-slate-900">
              Research Title <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-transparent transition-all duration-300 font-medium shadow-sm hover:border-slate-400"
                placeholder="Enter your research title"
                required
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <BookOpen size={20} className="text-slate-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500">Make it descriptive and specific to your research</p>
            {fieldErrors.title && <p className="text-sm text-red-600">{fieldErrors.title}</p>}
          </div>

          {/* Abstract */}
          <div className="space-y-3">
            <label htmlFor="abstract" className="block text-lg font-bold text-slate-900">
              Abstract <span className="text-red-500">*</span>
            </label>
            <textarea
              id="abstract"
              name="abstract"
              value={formData.abstract}
              onChange={handleChange}
              rows={6}
              className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-transparent transition-all duration-300 font-medium shadow-sm hover:border-slate-400 resize-none"
              placeholder="Provide a comprehensive summary of your research (150-250 words recommended)"
              required
            />
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-500">Word count: {formData.abstract.split(/\s+/).filter(Boolean).length}</p>
              <p className="text-sm text-slate-500">Recommended: 150-250 words</p>
            </div>
            {fieldErrors.abstract && <p className="text-sm text-red-600">{fieldErrors.abstract}</p>}
          </div>

          {/* Keywords */}
          <div className="space-y-3">
            <label htmlFor="keywords" className="block text-lg font-bold text-slate-900">
              Keywords
            </label>
            <div className="relative">
              <input
                type="text"
                id="keywords"
                name="keywords"
                value={formData.keywords}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-transparent transition-all duration-300 font-medium shadow-sm hover:border-slate-400"
                placeholder="e.g., machine learning, artificial intelligence, data analysis"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <Tag size={20} className="text-slate-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500">Separate keywords with commas • Improves discoverability</p>
          </div>

          {/* Category */}
          <div className="space-y-3">
            <label htmlFor="category" className="block text-lg font-bold text-slate-900">
              Research Category <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-transparent transition-all duration-300 appearance-none font-medium shadow-sm hover:border-slate-400"
                required
              >
                <option value="" className="text-slate-400">Select a research category</option>
                {hasLegacyCategorySelection && (
                  <option value={formData.category} className="text-slate-900">
                    {formData.category} (legacy)
                  </option>
                )}
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id} className="text-slate-900">
                    {cat.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-6 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <FolderOpen size={20} className="text-slate-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500">Choose the most relevant category for your research</p>
            {fieldErrors.category && <p className="text-sm text-red-600">{fieldErrors.category}</p>}
          </div>

          {/* DOI */}
          <div className="space-y-3">
            <label htmlFor="doi" className="block text-lg font-bold text-slate-900">
              DOI <span className="text-slate-400 text-base font-normal">(optional)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                id="doi"
                name="doi"
                value={formData.doi}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-transparent transition-all duration-300 font-mono text-sm shadow-sm hover:border-slate-400"
                placeholder="e.g. 10.1234/journal.2026.001"
              />
            </div>
            <p className="text-sm text-slate-500">
              If your paper has already been assigned a DOI by a journal or publisher, enter it here.
              You may also paste a full <span className="font-mono">https://doi.org/…</span> link — it will be normalized automatically.
              The admin will verify it before publishing.
            </p>
          </div>
          </>
          )}

          {step === 3 && (
          <>
          <div className="space-y-3">
            <label htmlFor="facultyId" className="block text-lg font-bold text-slate-900">
              Faculty adviser (required) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="facultyId"
                name="facultyId"
                value={formData.facultyId}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-transparent transition-all duration-300 appearance-none font-medium shadow-sm hover:border-slate-400"
              >
                <option value="">Select your faculty adviser</option>
                {facultyMembers && facultyMembers.length > 0 ? (
                  facultyMembers.map((faculty) => (
                    <option key={faculty.id} value={faculty.id} className="text-slate-900">
                      {formatFullName(faculty)} {faculty.department ? `(${faculty.department})` : ''}
                    </option>
                  ))
                ) : (
                  <option value="" disabled className="text-slate-400">No faculty members available</option>
                )}
              </select>
              <div className="absolute right-6 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <User size={20} className="text-slate-400" />
              </div>
            </div>
            {facultyMembers && facultyMembers.length === 0 && (
              <p className="text-sm text-amber-600">
                No faculty members found. You can still submit without a faculty advisor.
              </p>
            )}
            {facultyMembers && facultyMembers.length > 0 && (
              <p className="text-sm text-slate-500">Your faculty adviser will be the first to review your submission</p>
            )}
            {fieldErrors.facultyId && <p className="text-sm text-red-600">{fieldErrors.facultyId}</p>}
          </div>

          {/* Department */}
          <div className="space-y-3">
            <label htmlFor="departmentId" className="block text-lg font-bold text-slate-900">
              Department
            </label>
            <div className="relative">
              <select
                id="departmentId"
                name="departmentId"
                value={formData.departmentId}
                onChange={handleChange}
                className="w-full px-6 py-4 bg-white border-2 border-slate-300 rounded-2xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-transparent transition-all duration-300 appearance-none font-medium shadow-sm hover:border-slate-400"
              >
                <option value="">Select department (optional)</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id} className="text-slate-900">
                    {department.code ? `${department.code} - ` : ''}{department.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <FolderOpen size={20} className="text-slate-400" />
              </div>
            </div>
            <p className="text-sm text-slate-500">Selecting a department helps route review assignments correctly.</p>
          </div>

          {/* Co-Authors - NEW: Search and select students */}
          <div className="space-y-3">
            <label htmlFor="coAuthors" className="block text-lg font-bold text-slate-900">
              Co-Authors
            </label>
            
            {/* Selected Co-Authors Display */}
            {selectedCoAuthors.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedCoAuthors.map((author) => (
                  <div
                    key={author.id}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#3674B5]/10 to-[#578FCA]/10 border-2 border-[#3674B5]/20 rounded-xl"
                  >
                    <User size={16} className="text-[#3674B5]" />
                    <span className="text-sm font-semibold text-[#3674B5]">{formatFullName(author)}</span>
                    <button
                      type="button"
                      onClick={() => removeCoAuthor(author.id)}
                      className="ml-1 text-[#3674B5]/60 hover:text-[#3674B5] transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => handleStudentSearch(e.target.value)}
                onFocus={() => studentSearch.length >= 2 && setShowSearchDropdown(true)}
                className="w-full px-6 py-4 pl-12 bg-white border-2 border-slate-300 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-transparent transition-all duration-300 font-medium shadow-sm hover:border-slate-400"
                placeholder="Search students by name or email..."
              />
              <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                <Search size={20} className="text-slate-400" />
              </div>
              {searchLoading && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <Loader2 size={20} className="text-[#3674B5] animate-spin" />
                </div>
              )}

              {/* Search Results Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto">
                  {searchResults.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => addCoAuthor(student)}
                      className="w-full px-4 py-3 text-left hover:bg-[#3674B5]/10 transition-colors border-b border-slate-100 last:border-b-0 flex items-center gap-3"
                      disabled={selectedCoAuthors.find(a => a.id === student.id)}
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3674B5] to-[#578FCA] flex items-center justify-center">
                        <User size={20} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{formatFullName(student)}</p>
                        <p className="text-sm text-slate-500">{student.email}</p>
                        {student.program && (
                          <p className="text-xs text-slate-400">{student.program}</p>
                        )}
                      </div>
                      {selectedCoAuthors.find(a => a.id === student.id) && (
                        <CheckCircle size={20} className="text-[#3674B5]" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-sm text-slate-500">
              <UserPlus size={14} className="inline mr-1" />
              Search and add students from the system as co-authors
            </p>

            {/* Old text field for legacy/external co-authors */}
            <div className="mt-4">
              <label htmlFor="coAuthorsText" className="block text-sm font-semibold text-slate-700 mb-2">
                External / Non-System Co-Author Notes (Optional)
              </label>
              <input
                type="text"
                id="coAuthorsText"
                name="coAuthors"
                value={formData.coAuthors}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3674B5] focus:border-transparent transition-all duration-300 font-medium"
                placeholder="External collaborators not in the system (comma-separated)"
              />
              <p className="text-xs text-slate-400 mt-1">Stored separately from canonical structured authorship.</p>
            </div>
          </div>
          </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-8 py-6 bg-gradient-to-r from-slate-50 to-white border-t border-slate-200 rounded-b-3xl flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-500" />
            <p className="text-sm text-slate-600">
              All submissions undergo academic review • Approx. 7-14 business days
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/student/my-research')}
              className="px-6 py-3 border-2 border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="px-6 py-3 border-2 border-slate-300 rounded-xl text-slate-700 font-bold hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="px-8 py-3 bg-[#3674B5] text-white rounded-xl font-bold hover:bg-[#2d6299] transition-colors"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-[#3674B5] text-white rounded-xl font-bold hover:bg-[#2d6299] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-3"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {resubmitData ? 'Updating...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    {resubmitData ? 'Update Research' : 'Submit for Review'}
                    <Upload size={18} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Submission Guidelines */}
      <div className="mt-10 bg-gradient-to-br from-[#3674B5]/10 to-[#578FCA]/10 rounded-2xl border border-[#3674B5]/20 p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#3674B5] to-[#578FCA] flex items-center justify-center flex-shrink-0">
            <Sparkles size={24} className="text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Submission Guidelines</h3>
            <p className="text-slate-700">Ensure your submission meets all academic requirements</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-blue-100">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-100 to-green-50 flex items-center justify-center">
              <CheckCircle size={16} className="text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">PDF Format Required</p>
              <p className="text-sm text-slate-600">Only PDF files accepted • Max 10MB</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-blue-100">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center">
              <FileText size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Complete Information</p>
              <p className="text-sm text-slate-600">All required fields must be filled</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-[#3674B5]/20">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#3674B5]/20 to-[#3674B5]/10 flex items-center justify-center">
              <Tag size={16} className="text-[#3674B5]" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Proper Keywords</p>
              <p className="text-sm text-slate-600">Include relevant keywords for searchability</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-white/80 border border-blue-100">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center">
              <Users size={16} className="text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Author Attribution</p>
              <p className="text-sm text-slate-600">List all contributing authors correctly</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SubmitResearch;
