import React, { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Calendar, FileText, User as UserIcon, LogOut, LayoutDashboard, Plus, CheckCircle, XCircle, Clock, MapPin, Camera, Building, Info, ShieldCheck, Upload, Download, ShoppingCart, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

// --- Types ---
interface AppDocument {
  id: number;
  user_id: number;
  user_name?: string;
  title: string;
  file_path: string;
  status: 'pending' | 'verified' | 'rejected';
  type: 'user_upload' | 'admin_upload';
  accepted: number;
}

interface UserProfile {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
  affiliation?: string;
  bio?: string;
  profile_picture?: string;
}

interface Conference {
  id: number;
  title: string;
  description: string;
  date: string;
  location: string;
  status: string;
}

interface Submission {
  id: number;
  conference_id: number;
  conference_title: string;
  author_name?: string;
  title: string;
  abstract: string;
  file_path: string;
  status: 'pending' | 'under_review' | 'accepted' | 'rejected';
  reviewers?: string;
}

interface ScheduleItem {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  room: string;
}

// --- Components ---

const Navbar = () => {
  const { user, logout } = useAuth();
  return (
    <nav className="bg-white border-b border-zinc-100 px-8 py-3 flex justify-between items-center sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
          <Calendar className="text-white w-5 h-5" />
        </div>
        <span className="font-bold text-lg tracking-tight text-zinc-900">ConfMaster</span>
      </div>
      
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-3 text-[#1a1a7a]">
          <div className="flex items-center gap-2">
            {user?.profile_picture ? (
              <img 
                src={`/uploads/${user.profile_picture}`} 
                alt={user.name} 
                className="w-6 h-6 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-6 h-6 stroke-[1.5]" />
            )}
            <span className="text-sm font-medium hover:underline cursor-pointer">{user?.name}</span>
          </div>
          <span className="text-zinc-300">|</span>
          <button 
            onClick={logout}
            className="text-sm font-medium hover:underline"
          >
            Logout
          </button>
        </div>
        <div className="text-[#1a1a7a]">
          <ShoppingCart className="w-6 h-6 fill-[#1a1a7a]" />
        </div>
      </div>
    </nav>
  );
};

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) => {
  const { user } = useAuth();
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'conferences', label: 'Conferences', icon: Calendar },
    { id: 'submissions', label: 'Submissions', icon: FileText },
    { id: 'documents', label: 'Documents', icon: ShieldCheck },
    { id: 'profile', label: 'My Profile', icon: UserIcon },
    ...(user?.role === 'admin' ? [{ id: 'admin', label: 'Admin Panel', icon: LayoutDashboard }] : []),
  ];

  return (
    <div className="w-64 border-r border-zinc-200 h-[calc(100vh-73px)] p-4 flex flex-col gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
            activeTab === tab.id 
              ? 'bg-zinc-900 text-white shadow-md' 
              : 'text-zinc-600 hover:bg-zinc-100'
          }`}
        >
          <tab.icon className="w-4 h-4" />
          {tab.label}
        </button>
      ))}
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    under_review: 'bg-blue-50 text-blue-700 border-blue-200',
    accepted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors[status as keyof typeof colors] || 'bg-zinc-100 text-zinc-600 border-zinc-200'}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

// --- Main App Component ---

export default function App() {
  const { user, token, login, updateUser, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthMode, setIsAuthMode] = useState<'login' | 'register'>('login');
  const [authData, setAuthData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');

  const [conferences, setConferences] = useState<Conference[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [documents, setDocuments] = useState<AppDocument[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedConf, setSelectedConf] = useState<Conference | null>(null);
  const [assigningSubmission, setAssigningSubmission] = useState<Submission | null>(null);
  const [selectedReviewerId, setSelectedReviewerId] = useState('');
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: '', file: null as File | null, targetUserId: '' });
  const [newSubmission, setNewSubmission] = useState({ title: '', abstract: '', file: null as File | null });

  // Profile State
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    affiliation: user?.affiliation || '',
    bio: user?.bio || '',
    profile_picture: null as File | null
  });
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  useEffect(() => {
    if (token) {
      fetchConferences();
      fetchSubmissions();
      fetchDocuments();
      if (user?.role === 'admin') fetchUsers();
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name,
        affiliation: user.affiliation || '',
        bio: user.bio || '',
        profile_picture: null
      });
    }
  }, [user]);

  const fetchConferences = async () => {
    const res = await fetch('/api/conferences');
    const data = await res.json();
    setConferences(data);
  };

  const fetchSubmissions = async () => {
    const res = await fetch('/api/submissions', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setSubmissions(data);
  };

  const fetchDocuments = async () => {
    const res = await fetch('/api/documents', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setDocuments(data);
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/users', {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    setUsers(data);
  };

  const fetchSchedule = async (confId: number) => {
    const res = await fetch(`/api/conferences/${confId}/schedule`);
    const data = await res.json();
    setSchedule(data);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const endpoint = isAuthMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(authData)
    });
    const data = await res.json();
    if (res.ok) {
      login(data.token, data.user);
    } else {
      setError(data.error);
    }
  };

  const handleSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConf) return;
    const formData = new FormData();
    formData.append('conference_id', selectedConf.id.toString());
    formData.append('title', newSubmission.title);
    formData.append('abstract', newSubmission.abstract);
    if (newSubmission.file) formData.append('file', newSubmission.file);

    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (res.ok) {
      setIsSubmitting(false);
      setNewSubmission({ title: '', abstract: '', file: null });
      fetchSubmissions();
    }
  };

  const handleDocUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', newDoc.title);
    if (newDoc.file) formData.append('file', newDoc.file);
    if (user?.role === 'admin' && newDoc.targetUserId) {
      formData.append('user_id', newDoc.targetUserId);
    }

    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    if (res.ok) {
      setIsUploadingDoc(false);
      setNewDoc({ title: '', file: null, targetUserId: '' });
      fetchDocuments();
    }
  };

  const verifyDoc = async (id: number, status: string) => {
    await fetch(`/api/documents/${id}/verify`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ status })
    });
    fetchDocuments();
  };

  const acceptDoc = async (id: number) => {
    await fetch(`/api/documents/${id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` }
    });
    fetchDocuments();
  };

  const handleAssignReviewer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningSubmission || !selectedReviewerId) return;

    const res = await fetch(`/api/submissions/${assigningSubmission.id}/assign`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ reviewer_id: parseInt(selectedReviewerId) })
    });

    if (res.ok) {
      setAssigningSubmission(null);
      setSelectedReviewerId('');
      fetchSubmissions();
    } else {
      const data = await res.json();
      alert(data.error);
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    const formData = new FormData();
    formData.append('name', profileData.name);
    formData.append('affiliation', profileData.affiliation);
    formData.append('bio', profileData.bio);
    if (profileData.profile_picture) {
      formData.append('profile_picture', profileData.profile_picture);
    }

    const res = await fetch('/api/profile', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      updateUser(data);
      alert('Profile updated successfully!');
    }
    setIsUpdatingProfile(false);
  };

  const updateSubmissionStatus = async (id: number, status: string) => {
    await fetch(`/api/submissions/${id}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ status })
    });
    fetchSubmissions();
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center font-mono text-zinc-400">LOADING...</div>;

  if (!token) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Top Bar matching the image style */}
        <div className="w-full px-12 py-6 flex justify-end items-center border-b border-zinc-100">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 text-[#1a1a7a]">
              <User className="w-8 h-8 stroke-[1.2]" />
              <div className="flex items-center gap-2 text-lg font-medium">
                <button 
                  onClick={() => setIsAuthMode('login')}
                  className={`${isAuthMode === 'login' ? 'underline' : 'hover:underline'}`}
                >
                  Login
                </button>
                <span className="text-zinc-300 font-light">|</span>
                <button 
                  onClick={() => setIsAuthMode('register')}
                  className={`${isAuthMode === 'register' ? 'underline' : 'hover:underline'}`}
                >
                  Register
                </button>
              </div>
            </div>
            <div className="text-[#1a1a7a]">
              <ShoppingCart className="w-8 h-8 fill-[#1a1a7a]" />
            </div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 bg-zinc-50/50">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-10 rounded-[40px] shadow-2xl shadow-zinc-200/50 w-full max-w-md border border-zinc-100"
          >
            <div className="flex flex-col items-center mb-10">
              <div className="w-14 h-14 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-zinc-900/20">
                <Calendar className="text-white w-7 h-7" />
              </div>
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">ConfMaster</h1>
              <p className="text-zinc-400 text-sm font-medium mt-1 uppercase tracking-widest">Academic Excellence</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
              {isAuthMode === 'register' && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-2 ml-1">Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Enter your name"
                    className="w-full px-5 py-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-zinc-900/5 transition-all text-sm"
                    value={authData.name}
                    onChange={e => setAuthData({...authData, name: e.target.value})}
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-2 ml-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  placeholder="name@university.edu"
                  className="w-full px-5 py-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-zinc-900/5 transition-all text-sm"
                  value={authData.email}
                  onChange={e => setAuthData({...authData, email: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-2 ml-1">Password</label>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full px-5 py-4 rounded-2xl border border-zinc-100 bg-zinc-50/50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-zinc-900/5 transition-all text-sm"
                  value={authData.password}
                  onChange={e => setAuthData({...authData, password: e.target.value})}
                />
              </div>
              {error && <p className="text-rose-500 text-xs font-bold text-center bg-rose-50 py-2 rounded-lg">{error}</p>}
              <button className="w-full bg-zinc-900 text-white py-4 rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 active:scale-[0.98]">
                {isAuthMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-8 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Welcome back, {user?.name}</h2>
                  <p className="text-zinc-500">Here's what's happening with your conferences and submissions.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-zinc-100 rounded-2xl">
                        <Calendar className="w-5 h-5 text-zinc-900" />
                      </div>
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Conferences</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-900">{conferences.length}</div>
                    <p className="text-xs text-zinc-500 mt-1">Upcoming events</p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-zinc-100 rounded-2xl">
                        <FileText className="w-5 h-5 text-zinc-900" />
                      </div>
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Submissions</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-900">{submissions.length}</div>
                    <p className="text-xs text-zinc-500 mt-1">Total papers submitted</p>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-zinc-100 rounded-2xl">
                        <ShieldCheck className="w-5 h-5 text-zinc-900" />
                      </div>
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Documents</span>
                    </div>
                    <div className="text-3xl font-bold text-zinc-900">{documents.length}</div>
                    <p className="text-xs text-zinc-500 mt-1">Verified files</p>
                  </div>

                  <div className="bg-zinc-900 p-6 rounded-3xl shadow-xl shadow-zinc-900/20">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-white/10 rounded-2xl">
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Next Deadline</span>
                    </div>
                    <div className="text-xl font-bold text-white">June 15, 2026</div>
                    <p className="text-xs text-zinc-400 mt-1">AI Conference 2026</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
                    <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
                      <Calendar className="w-5 h-5" /> Recent Conferences
                    </h3>
                    <div className="space-y-4">
                      {conferences.slice(0, 3).map(conf => (
                        <div key={conf.id} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                          <div>
                            <h4 className="font-bold text-zinc-900 text-sm">{conf.title}</h4>
                            <p className="text-xs text-zinc-500">{conf.location}</p>
                          </div>
                          <button 
                            onClick={() => setActiveTab('conferences')}
                            className="text-xs font-bold text-zinc-900 hover:underline"
                          >
                            Details
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
                    <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
                      <FileText className="w-5 h-5" /> Submission Status
                    </h3>
                    <div className="space-y-4">
                      {submissions.slice(0, 3).map(sub => (
                        <div key={sub.id} className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                          <div className="min-w-0 flex-1 mr-4">
                            <h4 className="font-bold text-zinc-900 text-sm truncate">{sub.title}</h4>
                            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{sub.conference_title}</p>
                          </div>
                          <StatusBadge status={sub.status} />
                        </div>
                      ))}
                      {submissions.length === 0 && (
                        <div className="text-center py-8 text-zinc-400 text-sm italic">No submissions yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'conferences' && (
              <motion.div 
                key="conf"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Available Conferences</h2>
                    <p className="text-zinc-500">Discover and participate in upcoming academic events.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {conferences.map(conf => (
                    <div key={conf.id} className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-zinc-50 rounded-2xl group-hover:bg-zinc-900 transition-colors">
                          <Calendar className="w-6 h-6 text-zinc-900 group-hover:text-white" />
                        </div>
                        <StatusBadge status={conf.status} />
                      </div>
                      <h3 className="text-xl font-bold text-zinc-900 mb-2">{conf.title}</h3>
                      <p className="text-zinc-500 text-sm mb-4 line-clamp-2">{conf.description}</p>
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center gap-2 text-xs text-zinc-600">
                          <Clock className="w-3 h-3" />
                          <span>{format(new Date(conf.date), 'MMMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-600">
                          <MapPin className="w-3 h-3" />
                          <span>{conf.location}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => { setSelectedConf(conf); fetchSchedule(conf.id); }}
                          className="flex-1 bg-zinc-100 text-zinc-900 py-2 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-all"
                        >
                          View Schedule
                        </button>
                        <button 
                          onClick={() => { setSelectedConf(conf); setIsSubmitting(true); }}
                          className="flex-1 bg-zinc-900 text-white py-2 rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all"
                        >
                          Submit Paper
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'submissions' && (
              <motion.div 
                key="sub"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">My Submissions</h2>
                  <p className="text-zinc-500">Track the status of your research papers.</p>
                </div>

                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-bottom border-zinc-200">
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Conference</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Paper Title</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {submissions.map(sub => (
                        <tr key={sub.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-zinc-900">{sub.conference_title}</td>
                          <td className="px-6 py-4 text-sm text-zinc-600">{sub.title}</td>
                          <td className="px-6 py-4"><StatusBadge status={sub.status} /></td>
                          <td className="px-6 py-4">
                            <button className="text-xs font-bold text-zinc-400 hover:text-zinc-900 transition-colors">View Details</button>
                          </td>
                        </tr>
                      ))}
                      {submissions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-zinc-400 font-mono text-sm">NO SUBMISSIONS FOUND</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'documents' && (
              <motion.div 
                key="docs"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Documents</h2>
                    <p className="text-zinc-500">Manage your certifications, identification, and other academic documents.</p>
                  </div>
                  <button 
                    onClick={() => setIsUploadingDoc(true)}
                    className="bg-zinc-900 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/20"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Document
                  </button>
                </div>

                <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-bottom border-zinc-200">
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Document Title</th>
                        {user?.role === 'admin' && <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">User</th>}
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Type</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Acceptance</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {documents.map(doc => (
                        <tr key={doc.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-zinc-100 rounded-lg">
                                <FileText className="w-4 h-4 text-zinc-600" />
                              </div>
                              <span className="text-sm font-medium text-zinc-900">{doc.title}</span>
                            </div>
                          </td>
                          {user?.role === 'admin' && <td className="px-6 py-4 text-sm text-zinc-600">{doc.user_name}</td>}
                          <td className="px-6 py-4 text-xs text-zinc-500 font-mono uppercase">{doc.type.replace('_', ' ')}</td>
                          <td className="px-6 py-4"><StatusBadge status={doc.status} /></td>
                          <td className="px-6 py-4">
                            {doc.type === 'admin_upload' ? (
                              doc.accepted ? (
                                <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                  <CheckCircle className="w-3 h-3" /> Accepted
                                </span>
                              ) : (
                                user?.role === 'user' ? (
                                  <button 
                                    onClick={() => acceptDoc(doc.id)}
                                    className="text-xs font-bold text-zinc-900 underline underline-offset-4 hover:text-zinc-600"
                                  >
                                    Accept Document
                                  </button>
                                ) : (
                                  <span className="text-xs text-zinc-400 italic">Pending User Acceptance</span>
                                )
                              )
                            ) : (
                              <span className="text-xs text-zinc-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <a 
                                href={`/uploads/${doc.file_path}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-2 hover:bg-zinc-200 rounded-lg transition-colors"
                                title="Download"
                              >
                                <Download className="w-4 h-4 text-zinc-600" />
                              </a>
                              {user?.role === 'admin' && doc.status === 'pending' && (
                                <>
                                  <button 
                                    onClick={() => verifyDoc(doc.id, 'verified')}
                                    className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"
                                    title="Verify"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => verifyDoc(doc.id, 'rejected')}
                                    className="p-2 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200"
                                    title="Reject"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {documents.length === 0 && (
                        <tr>
                          <td colSpan={user?.role === 'admin' ? 6 : 5} className="px-6 py-12 text-center text-zinc-400 font-mono text-sm">NO DOCUMENTS FOUND</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'profile' && (
              <motion.div 
                key="profile"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="max-w-4xl space-y-8"
              >
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">My Profile</h2>
                  <p className="text-zinc-500">Manage your personal information and academic affiliation.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex flex-col items-center">
                      <div className="relative group mb-4">
                        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-zinc-50 shadow-inner bg-zinc-100 flex items-center justify-center">
                          {user?.profile_picture ? (
                            <img 
                              src={`/uploads/${user.profile_picture}`} 
                              alt={user.name} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <UserIcon className="w-12 h-12 text-zinc-300" />
                          )}
                        </div>
                        <label className="absolute bottom-0 right-0 p-2 bg-zinc-900 text-white rounded-full cursor-pointer shadow-lg hover:bg-zinc-800 transition-all">
                          <Camera className="w-4 h-4" />
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*"
                            onChange={e => setProfileData({...profileData, profile_picture: e.target.files?.[0] || null})}
                          />
                        </label>
                      </div>
                      <h3 className="font-bold text-zinc-900">{user?.name}</h3>
                      <p className="text-xs text-zinc-500">{user?.email}</p>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <form onSubmit={handleProfileUpdate} className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <UserIcon className="w-3 h-3" /> Full Name
                          </label>
                          <input 
                            type="text" required
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                            value={profileData.name}
                            onChange={e => setProfileData({...profileData, name: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <Building className="w-3 h-3" /> Affiliation
                          </label>
                          <input 
                            type="text"
                            placeholder="University or Organization"
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                            value={profileData.affiliation}
                            onChange={e => setProfileData({...profileData, affiliation: e.target.value})}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                          <Info className="w-3 h-3" /> Short Bio
                        </label>
                        <textarea 
                          rows={4}
                          placeholder="Tell us about your research interests..."
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                          value={profileData.bio}
                          onChange={e => setProfileData({...profileData, bio: e.target.value})}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button 
                          type="submit"
                          disabled={isUpdatingProfile}
                          className="px-8 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/20 disabled:opacity-50"
                        >
                          {isUpdatingProfile ? 'Updating...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'admin' && user?.role === 'admin' && (
              <motion.div 
                key="admin"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-3xl font-bold text-zinc-900 tracking-tight">Admin Dashboard</h2>
                  <p className="text-zinc-500">Manage all conference activities and peer reviews.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5" /> All Submissions
                      </h3>
                      <div className="space-y-4">
                        {submissions.map(sub => (
                          <div key={sub.id} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 flex justify-between items-center">
                            <div>
                              <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{sub.conference_title}</p>
                              <h4 className="font-bold text-zinc-900">{sub.title}</h4>
                              <p className="text-xs text-zinc-500">Author: {sub.author_name}</p>
                              {sub.reviewers && (
                                <p className="text-[10px] text-zinc-400 mt-1">
                                  Reviewers: <span className="text-zinc-600 font-medium">{sub.reviewers}</span>
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => setAssigningSubmission(sub)}
                                className="text-[10px] font-bold text-zinc-400 hover:text-zinc-900 uppercase tracking-wider"
                              >
                                Assign Reviewer
                              </button>
                              <StatusBadge status={sub.status} />
                              <div className="flex gap-1">
                                <button 
                                  onClick={() => updateSubmissionStatus(sub.id, 'accepted')}
                                  className="p-2 rounded-lg bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={() => updateSubmissionStatus(sub.id, 'rejected')}
                                  className="p-2 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-zinc-900 text-white rounded-3xl p-6 shadow-xl">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5" /> Quick Actions
                      </h3>
                      <div className="space-y-2">
                        <button className="w-full text-left px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-sm font-medium">
                          Create New Conference
                        </button>
                        <button className="w-full text-left px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-sm font-medium">
                          Assign Reviewers
                        </button>
                        <button className="w-full text-left px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-sm font-medium">
                          Export Attendee List
                        </button>
                      </div>
                    </div>

                    <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6">
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <UserIcon className="w-5 h-5" /> Registered Users
                      </h3>
                      <div className="space-y-3">
                        {users.map(u => (
                          <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 transition-colors">
                            <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden border border-zinc-200">
                              {u.profile_picture ? (
                                <img src={`/uploads/${u.profile_picture}`} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <UserIcon className="w-4 h-4 text-zinc-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-zinc-900 truncate">{u.name}</p>
                              <p className="text-[10px] text-zinc-500 truncate">{u.affiliation || 'No affiliation'}</p>
                            </div>
                            <StatusBadge status={u.role} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedConf && !isSubmitting && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-zinc-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-2xl font-bold text-zinc-900">{selectedConf.title}</h3>
                    <p className="text-zinc-500 text-sm">Conference Schedule & Details</p>
                  </div>
                  <button onClick={() => setSelectedConf(null)} className="p-2 hover:bg-zinc-100 rounded-full">
                    <XCircle className="w-6 h-6 text-zinc-400" />
                  </button>
                </div>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Daily Schedule</h4>
                  {schedule.map(item => (
                    <div key={item.id} className="flex gap-6 p-4 rounded-2xl bg-zinc-50 border border-zinc-100">
                      <div className="w-20 font-mono text-xs text-zinc-400 pt-1">
                        {item.start_time} - {item.end_time}
                      </div>
                      <div>
                        <h5 className="font-bold text-zinc-900">{item.title}</h5>
                        <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" /> {item.room}
                        </p>
                      </div>
                    </div>
                  ))}
                  {schedule.length === 0 && <p className="text-center py-8 text-zinc-400 italic">No sessions scheduled yet.</p>}
                </div>
              </div>
              <div className="p-8 bg-zinc-50 flex justify-end">
                <button 
                  onClick={() => setSelectedConf(null)}
                  className="px-6 py-2 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isSubmitting && selectedConf && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-8"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">Submit Your Paper</h3>
              <p className="text-zinc-500 text-sm mb-6">Submitting to: <span className="font-bold text-zinc-900">{selectedConf.title}</span></p>
              
              <form onSubmit={handleSubmission} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Paper Title</label>
                  <input 
                    type="text" required
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    value={newSubmission.title}
                    onChange={e => setNewSubmission({...newSubmission, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Abstract</label>
                  <textarea 
                    required rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    value={newSubmission.abstract}
                    onChange={e => setNewSubmission({...newSubmission, abstract: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Upload PDF</label>
                  <input 
                    type="file" accept=".pdf" required
                    className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                    onChange={e => setNewSubmission({...newSubmission, file: e.target.files?.[0] || null})}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" onClick={() => setIsSubmitting(false)}
                    className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold text-zinc-600 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 shadow-lg shadow-zinc-900/20"
                  >
                    Submit Paper
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isUploadingDoc && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-8"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">Upload Document</h3>
              <p className="text-zinc-500 text-sm mb-6">
                {user?.role === 'admin' ? 'Upload a document for a specific user.' : 'Upload a document for verification.'}
              </p>
              
              <form onSubmit={handleDocUpload} className="space-y-4">
                {user?.role === 'admin' && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Target User</label>
                    <select 
                      required
                      className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                      value={newDoc.targetUserId}
                      onChange={e => setNewDoc({...newDoc, targetUserId: e.target.value})}
                    >
                      <option value="">Select a user...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Document Title</label>
                  <input 
                    type="text" required
                    placeholder="e.g., ID Card, Certificate, Review Report"
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    value={newDoc.title}
                    onChange={e => setNewDoc({...newDoc, title: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">File</label>
                  <input 
                    type="file" required
                    className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-100 file:text-zinc-700 hover:file:bg-zinc-200"
                    onChange={e => setNewDoc({...newDoc, file: e.target.files?.[0] || null})}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" onClick={() => setIsUploadingDoc(false)}
                    className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold text-zinc-600 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 shadow-lg shadow-zinc-900/20"
                  >
                    Upload
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {assigningSubmission && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <h3 className="text-2xl font-bold text-zinc-900 mb-2">Assign Reviewer</h3>
              <p className="text-zinc-500 text-sm mb-6">Assign a reviewer for: <span className="font-bold text-zinc-900">{assigningSubmission.title}</span></p>
              
              <form onSubmit={handleAssignReviewer} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">Select Reviewer</label>
                  <select 
                    required
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                    value={selectedReviewerId}
                    onChange={e => setSelectedReviewerId(e.target.value)}
                  >
                    <option value="">Select a user...</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-4">
                  <button 
                    type="button" onClick={() => setAssigningSubmission(null)}
                    className="flex-1 px-6 py-3 border border-zinc-200 rounded-xl font-bold text-zinc-600 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 shadow-lg shadow-zinc-900/20"
                  >
                    Assign
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
