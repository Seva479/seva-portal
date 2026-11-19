import React, { useState } from 'react';
import { User } from 'firebase/auth';
import {
  LayoutDashboard,
  FileText,
  Calendar,
  Mail,
  PlayCircle,
  Settings,
  Database,
  ShieldCheck,
  LogOut,
  Bell,
  Search,
  UserCheck,
  ChevronRight,
  MessageSquare,
  FileCheck,
  Download,
  Upload,
  RefreshCw,
  Cloud,
  CloudOff,
  AlertCircle,
  ExternalLink,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';
import { SevaStore, ADMIN_USERS } from '../../services/store';
import { Application, UserProfile, Meeting, ProgrammeProject } from '../../types';
import { SevaLogo } from '../../components/SevaLogo';
import { AdminOverview } from './AdminOverview';
import { ApplicationsManager } from './ApplicationsManager';
import { AgreementBudgetManager } from './AgreementBudgetManager';
import { InquiriesManager } from './InquiriesManager';
import { ApplicationDetailModal } from './ApplicationDetailModal';
import { MeetingsManager } from './MeetingsManager';
import { EmailManager } from './EmailManager';
import { ProjectsTracker } from './ProjectsTracker';
import { ContentManager } from './ContentManager';
import { DatabaseSchemaModal } from './DatabaseSchemaModal';
import { ExcelImportModal } from './ExcelImportModal';
import { fetchRemoteApplications, isSupabaseConfigured } from '../../services/supabase';
import {
  auth,
  fetchFirestoreApplications,
  isAuthorizedAdminUser,
  saveApplicationToFirestore,
  signInAdminWithGoogle,
  subscribeAuthState,
  subscribeToFirestoreApplications,
  subscribeToFirestoreContactMessages,
} from '../../services/firebase';

interface AdminLayoutProps {
  onExitAdmin: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ onExitAdmin }) => {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'applications' | 'agreements' | 'inquiries' | 'meetings' | 'emails' | 'projects' | 'cms' | 'database'
  >('overview');

  const [currentUser, setCurrentUser] = useState<UserProfile>(SevaStore.getCurrentUser());
  const [applications, setApplications] = useState<Application[]>(SevaStore.getApplications());
  const [projects, setProjects] = useState<ProgrammeProject[]>(SevaStore.getProjects());
  const [meetings, setMeetings] = useState<Meeting[]>(SevaStore.getMeetings());
  const [contactMessages, setContactMessages] = useState(SevaStore.getContactMessages());

  // Modal states
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [preselectedAppForMeeting, setPreselectedAppForMeeting] = useState<Application | null>(null);
  const [preselectedAppForEmail, setPreselectedAppForEmail] = useState<Application | null>(null);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  // Firebase Cloud Auth & Live Sync state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [cloudAuthLoading, setCloudAuthLoading] = useState<boolean>(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudErrorCode, setCloudErrorCode] = useState<string | null>(null);
  const [cloudAppIds, setCloudAppIds] = useState<Set<string> | null>(null);
  const [syncingLocal, setSyncingLocal] = useState<boolean>(false);
  const [cloudNotice, setCloudNotice] = useState<string | null>(null);
  const [isRefreshingHeader, setIsRefreshingHeader] = useState<boolean>(false);

  const cloudConnected = isAuthorizedAdminUser(firebaseUser);

  const refreshAll = () => {
    setApplications(SevaStore.getApplications());
    setProjects(SevaStore.getProjects());
    setMeetings(SevaStore.getMeetings());
    setContactMessages(SevaStore.getContactMessages());
  };

  const handleHeaderRefresh = async () => {
    setIsRefreshingHeader(true);
    try {
      if (isAuthorizedAdminUser(auth.currentUser)) {
        const remoteApps = await fetchFirestoreApplications();
        setCloudAppIds(new Set(remoteApps.map((a) => a.id)));
        SevaStore.syncRemoteApplications(remoteApps);
      } else if (isSupabaseConfigured()) {
        const remoteApps = await fetchRemoteApplications();
        if (remoteApps && remoteApps.length > 0) {
          SevaStore.syncRemoteApplications(remoteApps);
        }
      }
    } catch (err) {
      console.warn('Header refresh warning:', err);
    } finally {
      refreshAll();
      setIsRefreshingHeader(false);
    }
  };

  const handleConnectGoogleCloud = async () => {
    setCloudError(null);
    setCloudErrorCode(null);
    setCloudAuthLoading(true);
    const res = await signInAdminWithGoogle();
    setCloudAuthLoading(false);
    if (!res.success) {
      setCloudErrorCode(res.errorCode || null);
      setCloudError(res.errorMessage || 'Google क्लाउड लॉग इन करताना त्रुटी आली.');
    } else {
      setCloudNotice('क्लाउड डेटाबेस यशस्वीरीत्या जोडला गेला! सर्व नवीन अर्ज आता थेट येथे दिसतील.');
      setTimeout(() => setCloudNotice(null), 5000);
    }
  };

  const localOnlyApps =
    cloudConnected && cloudAppIds !== null
      ? applications.filter((a) => !cloudAppIds.has(a.id))
      : [];

  const handlePushLocalAppsToCloud = async () => {
    if (!cloudConnected || localOnlyApps.length === 0) return;
    setSyncingLocal(true);
    let uploaded = 0;
    for (const app of localOnlyApps) {
      const res = await saveApplicationToFirestore(app, true);
      if (res.success) uploaded += 1;
    }
    setSyncingLocal(false);
    setCloudNotice(`${uploaded} लोकल अर्ज यशस्वीरीत्या क्लाउड डेटाबेसवर अपलोड झाले.`);
    setTimeout(() => setCloudNotice(null), 5000);
  };

  const handleExportData = () => {
    try {
      const jsonStr = SevaStore.exportAllDataJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `seva_admin_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('बॅकअप तयार करताना त्रुटी: ' + (e?.message || 'अज्ञात त्रुटी'));
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = SevaStore.importAllDataJSON(content);
        if (res.success) {
          refreshAll();
          alert(res.message);
        } else {
          alert('त्रुटी: ' + res.message);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Subscribe to Firebase Auth readiness
  React.useEffect(() => {
    const unsub = subscribeAuthState((user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Real-time Firestore live listeners (only attached AFTER auth is ready & admin verified)
  React.useEffect(() => {
    if (!authReady || !cloudConnected) {
      setCloudAppIds(null);
      return;
    }

    setCloudError(null);
    const unsubApps = subscribeToFirestoreApplications(
      (remoteApps) => {
        setCloudAppIds(new Set(remoteApps.map((a) => a.id)));
        SevaStore.syncRemoteApplications(remoteApps);
        setApplications(SevaStore.getApplications());
      },
      (err) => {
        console.error('Firestore live applications listener error:', err);
        setCloudError('क्लाउड अर्जांचा लाईव्ह डेटा लोड करताना त्रुटी आली. कृपया पुन्हा Google लॉग इन करा किंवा रिफ्रेश दाबा.');
      }
    );

    const unsubMessages = subscribeToFirestoreContactMessages(
      (remoteMsgs) => {
        SevaStore.syncRemoteContactMessages(remoteMsgs);
        setContactMessages(SevaStore.getContactMessages());
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('seva_store_updated', { detail: { type: 'contact_sync' } }));
        }
      },
      (err) => {
        console.error('Firestore live contact listener error:', err);
      }
    );

    return () => {
      unsubApps();
      unsubMessages();
    };
  }, [authReady, cloudConnected]);

  // Auto-refresh when applications are submitted in another tab, window, or on the portal
  React.useEffect(() => {
    const handleStoreChange = () => {
      refreshAll();
    };

    window.addEventListener('storage', handleStoreChange);
    window.addEventListener('seva_store_updated', handleStoreChange);

    // Optional legacy Supabase check if configured
    if (isSupabaseConfigured()) {
      fetchRemoteApplications()
        .then((remoteApps) => {
          if (remoteApps && remoteApps.length > 0) {
            const res = SevaStore.syncRemoteApplications(remoteApps);
            if (res.newCount > 0) {
              refreshAll();
            }
          }
        })
        .catch((e) => {
          console.warn('Background remote sync skipped:', e);
        });
    }

    return () => {
      window.removeEventListener('storage', handleStoreChange);
      window.removeEventListener('seva_store_updated', handleStoreChange);
    };
  }, []);

  const handleUpdateApp = (updated: Application) => {
    refreshAll();
    setSelectedApp(updated);
  };

  const handleRoleChange = (roleName: string) => {
    const found = ADMIN_USERS.find((u) => u.role === roleName) || ADMIN_USERS[0];
    SevaStore.setCurrentUser(found);
    setCurrentUser(found);
  };

  const handleScheduleMeetingFromApp = (app: Application) => {
    setSelectedApp(null);
    setPreselectedAppForMeeting(app);
    setActiveTab('meetings');
  };

  const handleComposeEmailFromApp = (app: Application) => {
    setSelectedApp(null);
    setPreselectedAppForEmail(app);
    setActiveTab('emails');
  };

  const handleConvertToProjectFromApp = (app: Application) => {
    const newProj = SevaStore.convertApplicationToProject(app, {
      agreed_cost: 65000,
      assigned_lead: 'Pravin R. (SEVA Tech Lead)',
      duration_months: 4,
      start_date: new Date().toISOString().split('T')[0],
    });
    refreshAll();
    setSelectedApp(null);
    setActiveTab('projects');
  };

  const newCount = applications.filter((a) => a.status === 'New Application').length;

  return (
    <div className="min-h-screen bg-[#F1F5F9] flex flex-col font-sans">
      {/* Top Admin Header Bar */}
      <header className="bg-[#0F3825] text-white sticky top-0 z-40 border-b border-[#184E34] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand & Area */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <SevaLogo variant="dark" showSubtitle={false} />
            <div className="border-l border-emerald-700/60 pl-2.5 sm:pl-3">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-xs sm:text-base tracking-tight block text-white whitespace-nowrap">
                  Admin Console
                </span>
                <span className="px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-800 text-[9px] sm:text-[10px] font-bold text-emerald-200 border border-emerald-600/40 whitespace-nowrap">
                  प्रशासकीय कक्ष
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-emerald-200/90 hidden sm:block -mt-0.5 font-medium truncate max-w-xs">
                Grassroots Digital Management Platform · Ralegaon
              </span>
            </div>
          </div>

          {/* Action Buttons: Cloud status, Refresh, Export Data, Import Data, Logout */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs">
            {/* Cloud Status Pill */}
            {authReady && (
              cloudConnected ? (
                <span
                  className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 text-[11px] font-bold whitespace-nowrap"
                  title={`Cloud Live: ${firebaseUser?.email}`}
                >
                  <Cloud className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Cloud Live</span>
                </span>
              ) : (
                <button
                  onClick={handleConnectGoogleCloud}
                  disabled={cloudAuthLoading}
                  className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400 hover:bg-amber-300 text-stone-950 text-[11px] font-extrabold whitespace-nowrap cursor-pointer transition-colors shadow-xs"
                  title="क्लाउड डेटाबेस जोडण्यासाठी Google लॉग इन करा"
                >
                  <CloudOff className="w-3.5 h-3.5" />
                  <span>{cloudAuthLoading ? 'जोडत आहे...' : 'क्लाउड जोडा'}</span>
                </button>
              )
            )}

            {/* Quick Refresh */}
            <button
              onClick={handleHeaderRefresh}
              disabled={isRefreshingHeader}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-full bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 hover:text-white font-bold transition-all cursor-pointer border border-emerald-700/50 flex items-center gap-1.5 shadow-xs disabled:opacity-60"
              title="क्लाउड व लोकल डेटा रिफ्रेश करा (Refresh Store)"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-300 ${isRefreshingHeader ? 'animate-spin' : ''}`} />
              <span className="hidden lg:inline text-[11px]">रिफ्रेश</span>
            </button>

            {/* Export JSON Backup */}
            <button
              onClick={handleExportData}
              className="px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-900/70 hover:bg-emerald-800 text-emerald-100 hover:text-white font-bold transition-all cursor-pointer border border-emerald-600/60 flex items-center gap-1.5 shadow-xs"
              title="संपूर्ण ॲडमिन डेटा JSON फाईल म्हणून डाउनलोड करा (Export Data Backup)"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-[11px] whitespace-nowrap">डेटा बॅकअप</span>
            </button>

            {/* Import JSON Restore */}
            <label
              className="px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-900/70 hover:bg-emerald-800 text-emerald-100 hover:text-white font-bold transition-all cursor-pointer border border-emerald-600/60 flex items-center gap-1.5 shadow-xs"
              title="पूर्वी सेव्ह केलेली JSON फाईल अपलोड करून डेटा रीस्टोअर करा (Import Data Backup)"
            >
              <Upload className="w-3.5 h-3.5 text-sky-300" />
              <span className="text-[11px] whitespace-nowrap">डेटा लोड</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>

            {/* User Chip */}
            <div className="hidden xl:flex items-center gap-2 bg-emerald-950/70 px-3.5 py-1.5 rounded-full border border-emerald-700/60">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-100 font-semibold">{currentUser.name}</span>
            </div>

            {/* Logout / Exit button */}
            <button
              onClick={onExitAdmin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-950/70 hover:bg-red-900 text-red-200 hover:text-white font-bold transition-all cursor-pointer border border-red-800/60 shadow-xs"
              title="सुरक्षितपणे बाहेर पडा (Logout and return to public website)"
            >
              <LogOut className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">लॉगआउट</span>
            </button>
          </div>
        </div>
      </header>

      {/* Admin Navigation Sub-Bar with clean pill buttons */}
      <nav className="bg-white border-b border-stone-200 sticky top-16 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'bg-[#184E34] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>डॅशबोर्ड (Overview)</span>
          </button>

          <button
            onClick={() => setActiveTab('applications')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 relative ${
              activeTab === 'applications'
                ? 'bg-[#184E34] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>अर्ज व्यवस्थापन (Applications)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'applications' ? 'bg-amber-400 text-stone-900' : 'bg-emerald-100 text-[#184E34]'
            }`}>
              {applications.length}
            </span>
            {newCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('agreements')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'agreements'
                ? 'bg-[#184E34] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>करार व बजेट (Agreement &amp; Budget)</span>
          </button>

          <button
            onClick={() => setActiveTab('inquiries')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 relative ${
              activeTab === 'inquiries'
                ? 'bg-[#184E34] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>चौकशी संदेश (Inquiries)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'inquiries' ? 'bg-amber-400 text-stone-900' : 'bg-emerald-100 text-[#184E34]'
            }`}>
              {contactMessages.length}
            </span>
            {contactMessages.filter((m) => m.status === 'Unread').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('meetings')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'meetings'
                ? 'bg-[#184E34] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>बैठका (Meetings)</span>
            <span className="text-[11px] text-stone-400 font-mono">({meetings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'emails'
                ? 'bg-[#184E34] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>ईमेल केंद्र (Emails)</span>
          </button>

          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'projects'
                ? 'bg-[#184E34] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <PlayCircle className="w-3.5 h-3.5" />
            <span>प्रकल्प ट्रॅकर (Projects)</span>
            <span className="text-[11px] text-stone-400 font-mono">({projects.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('cms')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'cms'
                ? 'bg-[#184E34] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>सामग्री व केसेस (CMS)</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'database'
                ? 'bg-[#184E34] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>डेटाबेस (SQL Schema)</span>
          </button>
        </div>
      </nav>

      {/* Main Admin Workspace Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full space-y-5">
        {/* Cloud Notice Toast Banner */}
        {cloudNotice && (
          <div className="p-3.5 rounded-2xl bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
              <span>{cloudNotice}</span>
            </div>
            <button
              onClick={() => setCloudNotice(null)}
              className="text-emerald-100 hover:text-white cursor-pointer px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Cloud Auth Required Banner (shown when admin opened panel via local password instead of Google Auth) */}
        {authReady && !cloudConnected && (
          <div className="rounded-2xl bg-amber-50 border border-amber-300 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                <CloudOff className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-amber-950">
                  इतर संस्थांचे ऑनलाइन अर्ज लोड करण्यासाठी क्लाउड सिंक सक्रिय करा
                </h3>
                <p className="text-xs text-amber-900/90 leading-relaxed">
                  तुम्ही सध्या ऑफलाईन/लोकल सेशनमध्ये आहात. Apply पेजवरून इतर मोबाईल किंवा कॉम्प्युटरवरून अपलोड केलेले सर्व अर्ज थेट येथे पाहण्यासाठी अधिकृत Google खात्याने (<strong>seva.ecology@gmail.com</strong>) लॉग इन करा.
                </p>
                {cloudError && (
                  <div className="pt-1 text-xs font-bold text-red-700 flex flex-wrap items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{cloudError}</span>
                    {cloudErrorCode === 'auth/unauthorized-domain' && (
                      <a
                        href="https://console.firebase.google.com/project/hybrid-passage-jfx4d/authentication/settings"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline text-[#064E36]"
                      >
                        <span>Authorized Domains उघडा</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={handleConnectGoogleCloud}
              disabled={cloudAuthLoading}
              className="px-5 py-2.5 rounded-full bg-[#064E36] hover:bg-[#043E2B] text-white text-xs sm:text-sm font-extrabold whitespace-nowrap cursor-pointer shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-60"
            >
              <Cloud className="w-4 h-4 text-emerald-300" />
              <span>{cloudAuthLoading ? 'लॉग इन सुरू आहे...' : 'Google ने क्लाउड अर्ज लोड करा'}</span>
            </button>
          </div>
        )}

        {/* Cloud Error Banner when already connected */}
        {cloudConnected && cloudError && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-xs sm:text-sm text-red-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{cloudError}</span>
            </div>
            <button
              onClick={handleHeaderRefresh}
              className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold cursor-pointer"
            >
              पुन्हा प्रयत्न करा
            </button>
          </div>
        )}

        {/* Helpful strip if local-only applications exist that haven't been pushed to cloud yet */}
        {cloudConnected && localOnlyApps.length > 0 && (
          <div className="rounded-2xl bg-sky-50 border border-sky-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-sky-950">
            <div className="flex items-center gap-2.5">
              <UploadCloud className="w-4 h-4 text-sky-700 shrink-0" />
              <span>
                या ब्राउझरमध्ये <strong>{localOnlyApps.length}</strong> जुने/लोकल अर्ज आहेत जे अद्याप क्लाउडवर अपलोड झालेले नाहीत.
              </span>
            </div>
            <button
              onClick={handlePushLocalAppsToCloud}
              disabled={syncingLocal}
              className="px-4 py-1.5 rounded-full bg-sky-700 hover:bg-sky-800 text-white font-bold whitespace-nowrap cursor-pointer transition-colors disabled:opacity-60"
            >
              {syncingLocal ? 'अपलोड होत आहे...' : 'लोकल अर्ज क्लाउडवर सिंक करा'}
            </button>
          </div>
        )}

        {activeTab === 'overview' && (
          <AdminOverview
            applications={applications}
            projects={projects}
            meetings={meetings}
            onSelectApplication={(app) => setSelectedApp(app)}
            onNavigateTab={(tab) => setActiveTab(tab as any)}
            onOpenExcelImport={() => setIsExcelModalOpen(true)}
          />
        )}

        {activeTab === 'applications' && (
          <ApplicationsManager
            applications={applications}
            onSelectApplication={(app) => setSelectedApp(app)}
            onRefresh={refreshAll}
            cloudConnected={cloudConnected}
          />
        )}

        {activeTab === 'agreements' && (
          <AgreementBudgetManager
            applications={applications}
            onSelectApplicationForDetail={(app) => setSelectedApp(app)}
            onNavigateToEmails={(app) => {
              setPreselectedAppForEmail(app);
              setActiveTab('emails');
            }}
          />
        )}

        {activeTab === 'inquiries' && (
          <InquiriesManager messages={contactMessages} onRefresh={refreshAll} />
        )}

        {activeTab === 'meetings' && (
          <MeetingsManager
            meetings={meetings}
            applications={applications}
            onRefreshMeetings={refreshAll}
            preselectedApp={preselectedAppForMeeting}
          />
        )}

        {activeTab === 'emails' && (
          <EmailManager
            applications={applications}
            preselectedApp={preselectedAppForEmail}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectsTracker
            projects={projects}
            onRefreshProjects={refreshAll}
          />
        )}

        {activeTab === 'cms' && <ContentManager />}

        {activeTab === 'database' && <DatabaseSchemaModal />}
      </main>

      {/* Application Detail / Review Modal */}
      {selectedApp && (
        <ApplicationDetailModal
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdateApp={handleUpdateApp}
          onScheduleMeeting={handleScheduleMeetingFromApp}
          onComposeEmail={handleComposeEmailFromApp}
          onConvertToProject={handleConvertToProjectFromApp}
          onCreateAgreement={(app) => {
            setSelectedApp(null);
            setActiveTab('agreements');
          }}
          onDeleteApp={() => {
            setSelectedApp(null);
            refreshAll();
          }}
        />
      )}

      {/* Global Excel / CSV Bulk Import Modal */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        onImportSuccess={() => {
          refreshAll();
        }}
      />
    </div>
  );
};
