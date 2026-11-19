import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Application, ApplicationReview, ContactMessage } from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const AUTHORIZED_ADMIN_EMAILS = [
  'seva.ecology@gmail.com',
  'programmes@sevavillage.org',
  'admin@sevavillage.org',
];

export function isAuthorizedAdminUser(user: User | null): boolean {
  if (!user || !user.email) return false;
  return (
    Boolean(user.emailVerified) &&
    AUTHORIZED_ADMIN_EMAILS.includes(user.email.toLowerCase())
  );
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Startup connectivity test (as required for early offline/config detection)
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// --- Auth Helpers ---

export async function signInAdminWithGoogle(): Promise<{
  success: boolean;
  user?: User;
  errorCode?: string;
  errorMessage?: string;
}> {
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (!isAuthorizedAdminUser(user)) {
      const attemptedEmail = user?.email || 'अज्ञात ईमेल';
      await signOut(auth);
      return {
        success: false,
        errorCode: 'auth/not-authorized-admin',
        errorMessage: `प्रवेश नाकारला: '${attemptedEmail}' हा अधिकृत SEVA Admin ईमेल नाही. कृपया seva.ecology@gmail.com या खात्याने लॉग इन करा.`,
      };
    }

    // Keep local session in sync
    try {
      localStorage.setItem(
        'seva_admin_session',
        JSON.stringify({
          email: user.email,
          uid: user.uid,
          authenticatedAt: new Date().toISOString(),
          provider: 'google',
        })
      );
    } catch {
      // ignore storage quota errors
    }

    return { success: true, user };
  } catch (err: any) {
    const code = err?.code || 'auth/unknown';
    if (code === 'auth/unauthorized-domain') {
      return {
        success: false,
        errorCode: code,
        errorMessage: `हा डोमेन (${window.location.hostname}) Firebase Authorized Domains मध्ये जोडलेला नाही. Firebase Console → Authentication → Settings → Authorized domains मध्ये '${window.location.hostname}' जोडा.`,
      };
    }
    if (code === 'auth/popup-closed-by-user') {
      return {
        success: false,
        errorCode: code,
        errorMessage: 'Google लॉग इन विंडो बंद केली गेली. कृपया पुन्हा प्रयत्न करा.',
      };
    }
    return {
      success: false,
      errorCode: code,
      errorMessage: err?.message || 'Google लॉग इन करताना त्रुटी आली.',
    };
  }
}

export async function signOutAdmin(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Firebase signOut warning:', err);
  }
}

export function subscribeAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}

// --- Defensive Payload Sanitizers (Synchronized with firebase-blueprint.json & firestore.rules) ---

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : String(val ?? fallback).trim();
  const safe = str.length > 0 ? str : fallback;
  return safe.slice(0, maxLen);
}

function clampStringList(val: unknown, maxItems: number): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => String(item ?? '').trim().slice(0, 200))
    .filter(Boolean)
    .slice(0, maxItems);
}

function clampNumber(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num)));
}

function buildSafeApplicationPayload(app: Application, allowAdminFields = false): Record<string, any> {
  const safeId = clampString(app.id, 128).replace(/[^a-zA-Z0-9_-]/g, '-');
  const nowIso = new Date().toISOString();

  const safeDocuments = Array.isArray(app.documents)
    ? app.documents.slice(0, 10).map((d) => ({
        document_name: clampString(d?.document_name, 200, 'Document'),
        document_type: clampString(d?.document_type, 100, 'Supporting Document'),
        file_url: clampString(d?.file_url, 500, '#'),
        file_size: clampString(d?.file_size, 40, '0 MB'),
      }))
    : [];

  const safeStatusHistory = Array.isArray(app.status_history)
    ? app.status_history.slice(0, 50).map((h) => ({
        id: clampString(h?.id, 80, `sh-${Date.now()}`),
        application_id: safeId,
        previous_status: clampString(h?.previous_status, 60, 'None'),
        new_status: clampString(h?.new_status, 60, 'New Application'),
        changed_by: clampString(h?.changed_by, 150, 'Public Applicant Portal'),
        changed_at: clampString(h?.changed_at, 64, nowIso),
        internal_remarks: clampString(h?.internal_remarks, 500, ''),
      }))
    : [];

  const payload: Record<string, any> = {
    id: safeId,
    status: allowAdminFields ? clampString(app.status, 60, 'New Application') : 'New Application',
    priority: allowAdminFields ? clampString(app.priority, 20, 'Medium') : 'Medium',
    created_at: clampString(app.created_at, 64, nowIso),
    updated_at: clampString(app.updated_at, 64, nowIso),
    server_created_at: serverTimestamp(),
    server_updated_at: serverTimestamp(),

    // Section A
    name_of_organization: clampString(app.name_of_organization, 250, 'Unnamed Organisation'),
    type_of_organization: clampString(app.type_of_organization, 120, 'Society'),
    year_of_establishment: clampNumber(app.year_of_establishment, 1800, 2030, 2020),
    registration_number: clampString(app.registration_number, 120, 'N/A'),
    state: clampString(app.state, 100, 'Maharashtra'),
    district: clampString(app.district, 100, 'Yavatmal'),
    organisation_address: clampString(app.organisation_address, 600, 'Address not provided'),
    organisation_website: clampString(app.organisation_website, 300, ''),
    organisation_email: clampString(app.organisation_email, 200, 'no-email@example.org'),

    // Section B
    contact_person_name: clampString(app.contact_person_name, 150, 'Applicant'),
    designation: clampString(app.designation, 150, 'Representative'),
    contact_number: clampString(app.contact_number, 25, '0000000000'),

    // Section C
    brief_description: clampString(app.brief_description, 4000, 'Not specified'),
    key_areas_of_work: clampStringList(app.key_areas_of_work, 20),
    villages_covered: clampNumber(app.villages_covered, 0, 1000000, 0),
    geographical_area_of_operation: clampString(app.geographical_area_of_operation, 500, 'Not specified'),
    annual_beneficiaries_reached: clampNumber(app.annual_beneficiaries_reached, 0, 100000000, 0),
    primary_beneficiaries: clampString(app.primary_beneficiaries, 500, 'Rural Communities'),

    // Section D
    has_website: Boolean(app.has_website),
    has_mis_system: Boolean(app.has_mis_system),
    current_digital_tools: clampStringList(app.current_digital_tools, 20),

    // Section E
    major_technology_challenges: clampString(app.major_technology_challenges, 4000, 'Not specified'),
    support_type_seeking: clampStringList(app.support_type_seeking, 20),
    description_of_solution_needed: clampString(app.description_of_solution_needed, 4000, 'Not specified'),
    main_problem_to_solve: clampString(app.main_problem_to_solve, 2500, 'Not specified'),
    intended_users: clampString(app.intended_users, 500, 'Staff'),
    estimated_users_count: clampNumber(app.estimated_users_count, 0, 1000000, 1),

    // Section F
    has_previous_digital_project: Boolean(app.has_previous_digital_project),
    previous_digital_project_details: clampString(app.previous_digital_project_details, 3000, ''),

    // Section G
    requirement_urgency: clampString(app.requirement_urgency, 100, 'Moderate (1-3 months)'),
    preferred_timeline: clampString(app.preferred_timeline, 200, '3 to 4 months'),
    first_priority_support: clampString(app.first_priority_support, 500, 'Technology Support'),

    documents: safeDocuments,
    status_history: safeStatusHistory,
  };

  if (allowAdminFields) {
    if (app.reviews && typeof app.reviews === 'object') {
      payload.reviews = app.reviews;
    }
    if (app.assigned_reviewer_id) {
      payload.assigned_reviewer_id = clampString(app.assigned_reviewer_id, 128);
    }
    if (app.assigned_reviewer_name) {
      payload.assigned_reviewer_name = clampString(app.assigned_reviewer_name, 150);
    }
  }

  return payload;
}

function docToApplication(raw: Record<string, any>): Application {
  return {
    id: String(raw.id || ''),
    created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : new Date().toISOString(),
    status: raw.status || 'New Application',
    priority: raw.priority || 'Medium',
    assigned_reviewer_id: raw.assigned_reviewer_id || undefined,
    assigned_reviewer_name: raw.assigned_reviewer_name || undefined,
    name_of_organization: raw.name_of_organization || '',
    type_of_organization: raw.type_of_organization || 'Society',
    year_of_establishment: Number(raw.year_of_establishment) || 2020,
    registration_number: raw.registration_number || '',
    state: raw.state || 'Maharashtra',
    district: raw.district || '',
    organisation_address: raw.organisation_address || '',
    organisation_website: raw.organisation_website || '',
    organisation_email: raw.organisation_email || '',
    contact_person_name: raw.contact_person_name || '',
    designation: raw.designation || '',
    contact_number: raw.contact_number || '',
    brief_description: raw.brief_description || '',
    key_areas_of_work: Array.isArray(raw.key_areas_of_work) ? raw.key_areas_of_work : [],
    villages_covered: Number(raw.villages_covered) || 0,
    geographical_area_of_operation: raw.geographical_area_of_operation || '',
    annual_beneficiaries_reached: Number(raw.annual_beneficiaries_reached) || 0,
    primary_beneficiaries: raw.primary_beneficiaries || '',
    has_website: Boolean(raw.has_website),
    has_mis_system: Boolean(raw.has_mis_system),
    current_digital_tools: Array.isArray(raw.current_digital_tools) ? raw.current_digital_tools : [],
    major_technology_challenges: raw.major_technology_challenges || '',
    support_type_seeking: Array.isArray(raw.support_type_seeking) ? raw.support_type_seeking : [],
    description_of_solution_needed: raw.description_of_solution_needed || '',
    main_problem_to_solve: raw.main_problem_to_solve || '',
    intended_users: raw.intended_users || '',
    estimated_users_count: Number(raw.estimated_users_count) || 1,
    has_previous_digital_project: Boolean(raw.has_previous_digital_project),
    previous_digital_project_details: raw.previous_digital_project_details || '',
    requirement_urgency: raw.requirement_urgency || 'Moderate (1-3 months)',
    preferred_timeline: raw.preferred_timeline || '',
    first_priority_support: raw.first_priority_support || '',
    documents: Array.isArray(raw.documents) ? raw.documents : [],
    status_history: Array.isArray(raw.status_history) ? raw.status_history : [],
    reviews: raw.reviews || undefined,
  };
}

// --- Firestore Applications CRUD ---

export async function saveApplicationToFirestore(
  app: Application,
  allowAdminFields = false
): Promise<{ success: boolean; error?: string }> {
  const path = `applications/${app.id}`;
  try {
    const payload = buildSafeApplicationPayload(app, allowAdminFields);
    await setDoc(doc(db, 'applications', payload.id), payload);
    return { success: true };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.CREATE, path);
    } catch (wrapped: any) {
      return { success: false, error: wrapped?.message || String(error) };
    }
  }
}

export function subscribeToFirestoreApplications(
  onData: (apps: Application[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'applications';
  const q = query(collection(db, path), orderBy('created_at', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const apps = snapshot.docs.map((d) => docToApplication({ id: d.id, ...d.data() }));
      onData(apps);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped: any) {
        onError?.(wrapped);
      }
    }
  );
}

export async function fetchFirestoreApplications(): Promise<Application[]> {
  const path = 'applications';
  try {
    const q = query(collection(db, path), orderBy('created_at', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => docToApplication({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function updateApplicationStatusInFirestore(
  appId: string,
  status: Application['status'],
  statusHistory: Application['status_history'],
  updatedAt: string
): Promise<void> {
  if (!isAuthorizedAdminUser(auth.currentUser)) return;
  const path = `applications/${appId}`;
  try {
    await updateDoc(doc(db, 'applications', appId), {
      status,
      status_history: (statusHistory || []).slice(0, 50),
      updated_at: updatedAt,
      server_updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateApplicationReviewInFirestore(
  appId: string,
  review: ApplicationReview,
  priority: Application['priority'],
  updatedAt: string
): Promise<void> {
  if (!isAuthorizedAdminUser(auth.currentUser)) return;
  const path = `applications/${appId}`;
  try {
    await updateDoc(doc(db, 'applications', appId), {
      reviews: review,
      priority,
      updated_at: updatedAt,
      server_updated_at: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteApplicationFromFirestore(appId: string): Promise<void> {
  if (!isAuthorizedAdminUser(auth.currentUser)) return;
  const path = `applications/${appId}`;
  try {
    await deleteDoc(doc(db, 'applications', appId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// --- Firestore Contact Messages CRUD ---

export async function saveContactMessageToFirestore(
  msg: ContactMessage
): Promise<{ success: boolean; error?: string }> {
  const safeId = clampString(msg.id, 128).replace(/[^a-zA-Z0-9_-]/g, '-');
  const path = `contact_messages/${safeId}`;
  try {
    const payload = {
      id: safeId,
      name: clampString(msg.name, 150, 'Visitor'),
      email: clampString(msg.email, 200, 'no-email@example.org'),
      phone: clampString(msg.phone, 30, ''),
      organisation: clampString(msg.organisation, 200, ''),
      subject: clampString(msg.subject, 250, 'General Inquiry'),
      message: clampString(msg.message, 4000, 'No message'),
      submitted_at: clampString(msg.submitted_at, 64, new Date().toISOString()),
      server_created_at: serverTimestamp(),
      status: 'Unread' as const,
    };
    await setDoc(doc(db, 'contact_messages', safeId), payload);
    return { success: true };
  } catch (error) {
    try {
      handleFirestoreError(error, OperationType.CREATE, path);
    } catch (wrapped: any) {
      return { success: false, error: wrapped?.message || String(error) };
    }
  }
}

export function subscribeToFirestoreContactMessages(
  onData: (messages: ContactMessage[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'contact_messages';
  const q = query(collection(db, path), orderBy('submitted_at', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const msgs: ContactMessage[] = snapshot.docs.map((d) => {
        const raw = d.data();
        return {
          id: String(raw.id || d.id),
          name: String(raw.name || ''),
          email: String(raw.email || ''),
          phone: String(raw.phone || ''),
          organisation: String(raw.organisation || ''),
          subject: String(raw.subject || ''),
          message: String(raw.message || ''),
          submitted_at: String(raw.submitted_at || new Date().toISOString()),
          status: (raw.status as ContactMessage['status']) || 'Unread',
        };
      });
      onData(msgs);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped: any) {
        onError?.(wrapped);
      }
    }
  );
}

export async function updateContactMessageStatusInFirestore(
  id: string,
  status: ContactMessage['status']
): Promise<void> {
  if (!isAuthorizedAdminUser(auth.currentUser)) return;
  const path = `contact_messages/${id}`;
  try {
    await updateDoc(doc(db, 'contact_messages', id), { status });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteContactMessageFromFirestore(id: string): Promise<void> {
  if (!isAuthorizedAdminUser(auth.currentUser)) return;
  const path = `contact_messages/${id}`;
  try {
    await deleteDoc(doc(db, 'contact_messages', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
