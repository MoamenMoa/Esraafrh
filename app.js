import { APP_CONFIG, isFirebaseConfigured } from "./firebase-config.js";
import { STARTER_PROJECT } from "./seed-data.js";

const SDK = APP_CONFIG.firebaseSdkVersion;
let initializeApp, getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged;
let sendPasswordResetEmail, setPersistence, browserLocalPersistence;
let getFirestore, collection, collectionGroup, doc, getDoc, setDoc, addDoc;
let updateDoc, query, orderBy, limit, onSnapshot, serverTimestamp;
let runTransaction, writeBatch, increment;

async function loadFirebaseSdk() {
  const [firebaseApp, firebaseAuth, firebaseFirestore] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-firestore.js`)
  ]);
  ({ initializeApp } = firebaseApp);
  ({ getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged,
     sendPasswordResetEmail, setPersistence, browserLocalPersistence } = firebaseAuth);
  ({ getFirestore, collection, collectionGroup, doc, getDoc, setDoc, addDoc,
     updateDoc, query, orderBy, limit, onSnapshot, serverTimestamp,
     runTransaction, writeBatch, increment } = firebaseFirestore);
}

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const byId = (id) => document.getElementById(id);

const DOM = {
  boot: byId("boot-screen"), setup: byId("setup-screen"), login: byId("login-screen"), shell: byId("app-shell"),
  loginForm: byId("login-form"), loginIdentity: byId("login-identity"), loginPassword: byId("login-password"), loginButton: byId("login-button"),
  pageTitle: byId("page-title"), pageEyebrow: byId("page-eyebrow"),
  projectModal: byId("project-modal"), projectForm: byId("project-form"),
  noteModal: byId("note-modal"), noteForm: byId("note-form"),
  checklistModal: byId("checklist-modal"), checklistForm: byId("checklist-form"),
  itemNoteModal: byId("item-note-modal"), itemNoteForm: byId("item-note-form"),
  expenseModal: byId("expense-modal"), expenseForm: byId("expense-form"),
  excelModal: byId("excel-modal"), excelForm: byId("excel-form"),
  confirmModal: byId("confirm-modal"), backdrop: byId("modal-backdrop")
};

const STATUS = {
  pending: { label: "لم يبدأ", className: "pending" },
  in_progress: { label: "قيد التنفيذ", className: "in_progress" },
  review: { label: "للمراجعة", className: "review" },
  completed: { label: "مكتمل", className: "completed" }
};

const ROLE_LABEL = { admin: "مدير النظام", user: "عضو فريق" };
const state = {
  app: null, auth: null, db: null,
  authUser: null, profile: null,
  projects: [], users: [], allExpenses: [],
  selectedProjectId: null, selectedProject: null,
  checklist: [], notes: [], expenses: [], activity: [],
  currentView: "dashboard", currentProjectTab: "overview",
  excelRows: [], receiptFile: null, confirmCallback: null,
  unsubscribers: [], projectUnsubscribers: [], seedAttempted: false
};

function escapeHTML(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
function normalize(value = "") { return String(value).trim().toLowerCase().replace(/\s+/g, " "); }
function initials(name = "؟") { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "؟"; }
function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function formatDate(value, withTime = false) {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat("ar-EG", withTime
    ? { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric" }).format(date);
}
function formatMoney(value = 0) {
  return new Intl.NumberFormat("ar-EG", { style: "currency", currency: APP_CONFIG.currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
}
function statusInfo(status) { return STATUS[status] || STATUS.pending; }
function isAdmin() { return state.profile?.role === "admin"; }
function isLead(project = state.selectedProject) { return Boolean(project && state.authUser && project.startedByUserId === state.authUser.uid); }
function canWork(project = state.selectedProject) { return isAdmin() || isLead(project); }
function canStart(project) {
  if (!project || isAdmin() || !state.authUser) return false;
  return !project.startedByUserId && (!project.assignedUserId || project.assignedUserId === state.authUser.uid);
}
function activeProject() { return state.projects.find((p) => p.id === state.selectedProjectId) || state.selectedProject; }

function toast(message, type = "info", timeout = 4000) {
  const root = byId("toast-root");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}
function readableError(error) {
  console.error(error);
  const code = error?.code || "";
  const map = {
    "auth/invalid-credential": "بيانات الدخول غير صحيحة.",
    "auth/user-not-found": "الحساب غير موجود.",
    "auth/wrong-password": "كلمة المرور غير صحيحة.",
    "auth/too-many-requests": "محاولات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.",
    "auth/network-request-failed": "تعذر الاتصال بالإنترنت.",
    "permission-denied": "لا تملك صلاحية تنفيذ هذه العملية. تأكد من نشر قواعد Firebase.",
    "failed-precondition": "العملية تحتاج إعدادًا إضافيًا في Firebase. راجع وحدة التحكم."
  };
  return map[code] || error?.message || "حدث خطأ غير متوقع.";
}
function setBusy(button, busy, text = "جاري الحفظ...") {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = text;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function openModal(dialog) {
  DOM.backdrop.classList.remove("hidden");
  document.body.classList.add("modal-open");
  if (!dialog.open) dialog.showModal();
}
function closeModal(dialog) {
  if (dialog?.open) dialog.close();
  if (!$("dialog[open]")) {
    DOM.backdrop.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
}
function closeAllModals() { $$('dialog[open]').forEach((d) => d.close()); DOM.backdrop.classList.add("hidden"); document.body.classList.remove("modal-open"); }
function openMobileSidebar() {
  $(".sidebar")?.classList.add("mobile-open");
  byId("mobile-nav-backdrop")?.classList.remove("hidden");
  document.body.classList.add("mobile-menu-open");
}
function closeMobileSidebar() {
  $(".sidebar")?.classList.remove("mobile-open");
  byId("mobile-nav-backdrop")?.classList.add("hidden");
  document.body.classList.remove("mobile-menu-open");
}
function confirmAction(title, message, callback, dangerLabel = "تأكيد") {
  byId("confirm-title").textContent = title;
  byId("confirm-message").textContent = message;
  byId("confirm-accept").textContent = dangerLabel;
  state.confirmCallback = callback;
  openModal(DOM.confirmModal);
}

function showScreen(name) {
  [DOM.boot, DOM.setup, DOM.login, DOM.shell].forEach((el) => el.classList.add("hidden"));
  ({ boot: DOM.boot, setup: DOM.setup, login: DOM.login, app: DOM.shell }[name])?.classList.remove("hidden");
}

function resolveLoginEmail(identity) {
  const raw = identity.trim();
  if (raw.includes("@")) return raw.toLowerCase();
  return APP_CONFIG.accounts[normalize(raw)]?.email || raw;
}
function accountForEmail(email = "") {
  return Object.values(APP_CONFIG.accounts).find((account) => account.email.toLowerCase() === email.toLowerCase()) || null;
}

async function ensureProfile(user) {
  const allowed = accountForEmail(user.email || "");
  if (!allowed) throw new Error("هذا البريد غير مسموح له باستخدام النظام.");
  const profileRef = doc(state.db, "users", user.uid);
  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) {
    await setDoc(profileRef, {
      name: allowed.name, email: allowed.email, role: allowed.role, active: true,
      createdAt: serverTimestamp(), lastLoginAt: serverTimestamp()
    });
  } else {
    await updateDoc(profileRef, { lastLoginAt: serverTimestamp() });
  }
  const fresh = await getDoc(profileRef);
  const profile = { id: fresh.id, ...fresh.data() };
  if (!profile.active) throw new Error("تم إيقاف هذا الحساب.");
  return profile;
}

async function initializeSystem() {
  if (!isFirebaseConfigured()) { showScreen("setup"); return; }
  try {
    await loadFirebaseSdk();
    state.app = initializeApp(APP_CONFIG.firebaseConfig);
    state.auth = getAuth(state.app);
    state.db = getFirestore(state.app);
    await setPersistence(state.auth, browserLocalPersistence);
    byId("firebase-project-id").textContent = APP_CONFIG.firebaseConfig.projectId;
    onAuthStateChanged(state.auth, handleAuthState);
  } catch (error) {
    showScreen("setup");
    toast(readableError(error), "error", 7000);
  }
}

async function handleAuthState(user) {
  clearSubscriptions();
  if (!user) {
    state.authUser = null; state.profile = null; state.projects = []; state.users = [];
    showScreen("login");
    return;
  }
  showScreen("boot");
  try {
    state.authUser = user;
    state.profile = await ensureProfile(user);
    applyUserInterface();
    subscribeGlobalData();
    showScreen("app");
    navigate("dashboard");
  } catch (error) {
    toast(readableError(error), "error", 7000);
    await signOut(state.auth);
  }
}

function applyUserInterface() {
  const name = state.profile?.name || state.authUser?.email || "—";
  const role = ROLE_LABEL[state.profile?.role] || state.profile?.role || "—";
  ["sidebar-user-name", "top-user-name"].forEach((id) => byId(id).textContent = name);
  ["sidebar-user-role", "top-user-role"].forEach((id) => byId(id).textContent = role);
  ["sidebar-avatar", "top-avatar"].forEach((id) => byId(id).textContent = initials(name));
  $$(".admin-only").forEach((el) => el.classList.toggle("hidden", !isAdmin()));
  $$(".user-only").forEach((el) => el.classList.toggle("hidden", isAdmin()));
  renderProfileSettings();
}

function clearSubscriptions() {
  state.unsubscribers.forEach((unsub) => { try { unsub(); } catch {} });
  state.unsubscribers = [];
  clearProjectSubscriptions();
}
function clearProjectSubscriptions() {
  state.projectUnsubscribers.forEach((unsub) => { try { unsub(); } catch {} });
  state.projectUnsubscribers = [];
  state.checklist = []; state.notes = []; state.expenses = []; state.activity = [];
}

function subscribeGlobalData() {
  const projectsQuery = query(collection(state.db, "projects"), orderBy("updatedAt", "desc"));
  state.unsubscribers.push(onSnapshot(projectsQuery, async (snap) => {
    state.projects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (state.selectedProjectId) state.selectedProject = activeProject();
    renderDashboard(); renderProjects(); renderSelectedProject();
    byId("projects-count-badge").textContent = state.projects.length;
    if (isAdmin() && state.projects.length === 0 && !state.seedAttempted) {
      state.seedAttempted = true;
      try { await seedStarterProject(true); } catch (error) { console.warn(error); }
    }
  }, (error) => toast(readableError(error), "error")));

  state.unsubscribers.push(onSnapshot(collection(state.db, "users"), (snap) => {
    state.users = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.active !== false);
    renderTeam(); populateLeadSelect();
  }, (error) => console.warn(error)));

  const expensesQuery = query(collectionGroup(state.db, "expenses"), orderBy("date", "desc"));
  state.unsubscribers.push(onSnapshot(expensesQuery, (snap) => {
    state.allExpenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAllExpenses(); renderDashboard();
  }, (error) => console.warn("Expenses query", error)));
}

function navigate(view) {
  state.currentView = view;
  $$(".view").forEach((el) => el.classList.remove("active"));
  const target = byId(`view-${view}`);
  if (!target) return;
  target.classList.add("active");
  $$("[data-view]").forEach((el) => el.classList.toggle("active", el.dataset.view === view));
  const titles = {
    dashboard: ["نظرة عامة", "الرئيسية"], projects: ["إدارة العمل", "المشاريع"],
    expenses: ["الحسابات", "المصروفات"], team: ["المستخدمون", "فريق العمل"],
    settings: ["النظام", "الإعدادات"], "project-detail": ["تفاصيل المشروع", activeProject()?.title || "المشروع"]
  };
  DOM.pageEyebrow.textContent = titles[view]?.[0] || "";
  DOM.pageTitle.textContent = titles[view]?.[1] || "";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function projectProgress(project) {
  if (Number.isFinite(project?.progress)) return Math.max(0, Math.min(100, Number(project.progress)));
  const total = Number(project?.checklistTotal) || 0;
  return total ? Math.round(((Number(project?.checklistDone) || 0) / total) * 100) : 0;
}
function projectCardHTML(project, compact = false) {
  const progress = projectProgress(project);
  const status = statusInfo(project.status);
  const lead = project.startedByUserName || project.assignedUserName || "متاح للفريق";
  if (compact) return `
    <button class="mini-project" data-open-project="${project.id}" type="button">
      <div><h4>${escapeHTML(project.title)}</h4><p>${escapeHTML(project.description || project.location || "")}</p></div>
      <div class="mini-progress"><strong>${progress}%</strong><small>${status.label}</small></div>
    </button>`;
  return `
    <article class="project-card" data-project-id="${project.id}">
      <div class="project-card-head">
        <div><span class="code">كود ${escapeHTML(project.code || "—")}</span><h3>${escapeHTML(project.title)}</h3></div>
        <span class="status-pill ${status.className}">${status.label}</span>
      </div>
      <div class="project-card-description">${escapeHTML(project.description || "لا يوجد وصف")}</div>
      <div class="project-metrics">
        <div><span>المكتمل</span><b>${Number(project.checklistDone) || 0}/${Number(project.checklistTotal) || 0}</b></div>
        <div><span>الملاحظات</span><b>${Math.max(0, (Number(project.notesTotal) || 0) - (Number(project.notesDone) || 0))}</b></div>
        <div><span>المصروفات</span><b>${formatMoney(project.expensesTotal || 0)}</b></div>
      </div>
      <div class="project-progress-row"><div class="progress-track"><i style="width:${progress}%"></i></div><b>${progress}%</b></div>
      <div class="project-card-foot">
        <div class="lead-chip"><span class="avatar">${initials(lead)}</span><span>${escapeHTML(lead)}</span></div>
        <div class="project-card-buttons">
          ${canStart(project) ? `<button class="claim-project-card" data-claim-project="${project.id}" type="button">✓ ابدأ العمل</button>` : ""}
          <button class="open-project" data-open-project="${project.id}" type="button">فتح المشروع</button>
        </div>
      </div>
    </article>`;
}

function renderDashboard() {
  const projects = state.projects;
  const totalExpenses = state.allExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const counts = { pending: 0, in_progress: 0, review: 0, completed: 0 };
  projects.forEach((project) => { counts[project.status] = (counts[project.status] || 0) + 1; });
  byId("stat-projects").textContent = projects.length;
  byId("stat-progress").textContent = counts.in_progress;
  byId("stat-completed").textContent = counts.completed;
  byId("stat-expenses").textContent = formatMoney(totalExpenses);
  byId("summary-pending").textContent = counts.pending;
  byId("summary-progress").textContent = counts.in_progress;
  byId("summary-review").textContent = counts.review;
  byId("summary-done").textContent = counts.completed;
  const average = projects.length ? Math.round(projects.reduce((sum, p) => sum + projectProgress(p), 0) / projects.length) : 0;
  byId("dashboard-percent").textContent = `${average}%`;
  byId("dashboard-donut").style.setProperty("--value", average);
  byId("recent-projects").innerHTML = projects.length
    ? projects.slice(0, 5).map((p) => projectCardHTML(p, true)).join("")
    : `<div class="empty-state"><strong>لا توجد مشاريع بعد</strong><span>سيتم إنشاء مشروع الصور تلقائيًا بعد أول دخول للمدير.</span></div>`;
}

function renderProjects() {
  const search = normalize(byId("project-search")?.value || "");
  const status = byId("project-status-filter")?.value || "all";
  const filtered = state.projects.filter((project) => {
    const haystack = normalize(`${project.title} ${project.client} ${project.location} ${project.description} ${project.code}`);
    return (!search || haystack.includes(search)) && (status === "all" || project.status === status);
  });
  byId("projects-grid").innerHTML = filtered.length
    ? filtered.map((p) => projectCardHTML(p)).join("")
    : `<div class="empty-state"><strong>لا توجد نتائج</strong><span>جرّب تغيير البحث أو الفلتر.</span></div>`;
}

function renderTeam() {
  const grid = byId("team-grid");
  if (!grid) return;
  grid.innerHTML = state.users.length ? state.users.map((user) => `
    <article class="team-card">
      <div class="avatar">${initials(user.name)}</div>
      <div><strong>${escapeHTML(user.name)}</strong><span>${escapeHTML(user.email)}</span></div>
      <span class="role-badge">${ROLE_LABEL[user.role] || user.role}</span>
    </article>`).join("") : `<div class="empty-state"><strong>لا يوجد مستخدمون ظاهرون</strong><span>يظهر المستخدم بعد تسجيل دخوله أول مرة.</span></div>`;
}

function renderProfileSettings() {
  const wrap = byId("profile-settings");
  if (!wrap || !state.profile) return;
  wrap.innerHTML = `
    <div><span>الاسم</span><b>${escapeHTML(state.profile.name)}</b></div>
    <div><span>البريد</span><b>${escapeHTML(state.profile.email)}</b></div>
    <div><span>الصلاحية</span><b>${ROLE_LABEL[state.profile.role] || state.profile.role}</b></div>`;
}
function populateLeadSelect() {
  const select = byId("project-lead-select");
  if (!select) return;
  const current = select.value;
  select.innerHTML = `<option value="">متاح لكل الفريق</option>` + state.users.filter((u) => u.role === "user").map((u) => `<option value="${u.id}">${escapeHTML(u.name)}</option>`).join("");
  select.value = current;
}

function renderAllExpenses() {
  const total = state.allExpenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  byId("all-expenses-total").textContent = formatMoney(total);
  byId("all-expenses-list").innerHTML = state.allExpenses.length
    ? state.allExpenses.map((expense) => expenseHTML(expense, false)).join("")
    : `<div class="empty-state"><strong>لا توجد مصروفات</strong><span>المصروفات التي يضيفها الفريق ستظهر هنا.</span></div>`;
}

function openProject(projectId) {
  const project = state.projects.find((p) => p.id === projectId);
  if (!project) return;
  state.selectedProjectId = projectId;
  state.selectedProject = project;
  state.currentProjectTab = "overview";
  subscribeProjectData(projectId);
  navigate("project-detail");
  setProjectTab("overview");
  renderSelectedProject();
}
function subscribeProjectData(projectId) {
  clearProjectSubscriptions();
  const base = doc(state.db, "projects", projectId);
  state.projectUnsubscribers.push(onSnapshot(query(collection(base, "checklist"), orderBy("order", "asc")), (snap) => {
    state.checklist = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderChecklist(); renderSelectedProject();
  }, (e) => toast(readableError(e), "error")));
  state.projectUnsubscribers.push(onSnapshot(query(collection(base, "notes"), orderBy("createdAt", "desc")), (snap) => {
    state.notes = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderNotes(); renderSelectedProject();
  }, (e) => toast(readableError(e), "error")));
  state.projectUnsubscribers.push(onSnapshot(query(collection(base, "expenses"), orderBy("date", "desc")), (snap) => {
    state.expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderProjectExpenses(); renderSelectedProject();
  }, (e) => toast(readableError(e), "error")));
  state.projectUnsubscribers.push(onSnapshot(query(collection(base, "activity"), orderBy("createdAt", "desc"), limit(100)), (snap) => {
    state.activity = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderActivity();
  }, (e) => console.warn(e)));
}

function renderSelectedProject() {
  const project = activeProject();
  if (!project || state.currentView !== "project-detail") return;
  state.selectedProject = project;
  const status = statusInfo(project.status);
  const progress = projectProgress(project);
  byId("detail-project-code").textContent = `المشروع رقم ${project.code || "—"}`;
  byId("detail-project-title").textContent = project.title;
  byId("detail-project-description").textContent = project.description || "—";
  byId("detail-status").textContent = status.label;
  byId("detail-due-date").textContent = project.dueDate ? formatDate(`${project.dueDate}T12:00:00`) : "—";
  byId("detail-location").textContent = project.location || "—";
  byId("detail-budget").textContent = Number(project.budget) ? formatMoney(project.budget) : "غير محددة";
  byId("detail-lead").textContent = project.startedByUserName || project.assignedUserName || "متاح للفريق";
  byId("detail-progress-value").textContent = `${progress}%`;
  byId("detail-progress-bar").style.width = `${progress}%`;
  byId("overview-description").textContent = project.description || "لا يوجد وصف.";
  byId("overview-checklist").textContent = `${project.checklistDone || 0} / ${project.checklistTotal || 0}`;
  byId("overview-notes-open").textContent = Math.max(0, (project.notesTotal || 0) - (project.notesDone || 0));
  byId("overview-expenses").textContent = formatMoney(project.expensesTotal || 0);
  byId("notes-tab-count").textContent = project.notesTotal || 0;
  byId("checklist-tab-count").textContent = project.checklistTotal || 0;
  byId("expenses-tab-count").textContent = state.expenses.length || 0;
  byId("claim-project-button").classList.toggle("hidden", !canStart(project));
  byId("release-project-button").classList.toggle("hidden", !(isAdmin() && (project.assignedUserId || project.startedByUserId)));
  const startedInfo = byId("started-info");
  if (project.startedByUserName) {
    startedInfo.classList.remove("hidden");
    startedInfo.innerHTML = `<strong>بدأ العمل عليه: ${escapeHTML(project.startedByUserName)}</strong><br>${formatDate(project.startedAt, true)}`;
  } else if (project.assignedUserName) {
    startedInfo.classList.remove("hidden");
    startedInfo.innerHTML = `<strong>مُعيّن إلى: ${escapeHTML(project.assignedUserName)}</strong><br>في انتظار أن يضغط المستخدم «ابدأ العمل»`;
  } else startedInfo.classList.add("hidden");
  byId("add-note-button").disabled = !canWork(project);
  byId("add-expense-button").disabled = !canWork(project);
}

function setProjectTab(tab) {
  state.currentProjectTab = tab;
  $$(".tab-button").forEach((btn) => btn.classList.toggle("active", btn.dataset.projectTab === tab));
  $$(".project-tab").forEach((section) => section.classList.toggle("active", section.id === `project-tab-${tab}`));
}

function noteHTML(note) {
  const canToggle = canWork();
  const categoryLabel = { general: "عام", issue: "مشكلة", checklist: "قائمة التحقق" }[note.category] || "ملاحظة";
  return `<article class="note-card ${note.completed ? "completed" : ""}">
    <button class="check-button ${note.completed ? "checked" : ""}" data-toggle-note="${note.id}" ${canToggle ? "" : "disabled"} type="button">✓</button>
    <div><div class="note-text">${escapeHTML(note.text)}</div><div class="note-meta"><span class="note-category">${categoryLabel}</span><span>أضافها ${escapeHTML(note.createdByName || "—")}</span>${note.completed ? `<span>أنهى ${escapeHTML(note.completedByName || "—")} — ${formatDate(note.completedAt, true)}</span>` : ""}</div></div>
    ${isAdmin() || (isLead() && note.createdBy === state.authUser?.uid) ? `<button class="row-menu" data-delete-note="${note.id}" type="button" title="حذف">✕</button>` : ""}
  </article>`;
}
function renderNotes() {
  const openCount = state.notes.filter((n) => !n.completed).length;
  const doneCount = state.notes.length - openCount;
  byId("notes-open-count").textContent = openCount;
  byId("notes-done-count").textContent = doneCount;
  byId("notes-list").innerHTML = state.notes.length ? state.notes.map(noteHTML).join("") : `<div class="empty-state"><strong>لا توجد ملاحظات</strong><span>أضف أول ملاحظة للمشروع.</span></div>`;
}

function renderChecklist() {
  const total = state.checklist.length;
  const done = state.checklist.filter((item) => item.completed).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  byId("checklist-progress-numbers").textContent = `${done} / ${total} مكتمل`;
  byId("checklist-progress-percent").textContent = `${percent}%`;
  byId("checklist-progress-bar").style.width = `${percent}%`;
  const groups = new Map();
  state.checklist.forEach((item) => {
    const phase = item.phase || "عام";
    if (!groups.has(phase)) groups.set(phase, []);
    groups.get(phase).push(item);
  });
  const canToggle = canWork();
  const showNotes = byId("show-item-notes")?.checked;
  byId("checklist-groups").innerHTML = groups.size ? [...groups.entries()].map(([phase, items]) => {
    const phaseDone = items.filter((i) => i.completed).length;
    return `<section class="phase-card">
      <button class="phase-head" type="button"><span>${escapeHTML(phase)}</span><b>${phaseDone}/${items.length}</b></button>
      <div class="phase-items">${items.map((item, index) => `
        <article class="checklist-item ${item.completed ? "completed" : ""}">
          <button class="item-note-button" data-item-note="${item.id}" type="button" title="ملاحظة البند">+</button>
          <button class="check-button ${item.completed ? "checked" : ""}" data-toggle-item="${item.id}" ${canToggle ? "" : "disabled"} type="button">✓</button>
          <div class="item-body"><div>${escapeHTML(item.text)}</div>${showNotes && item.note ? `<div class="item-note">${escapeHTML(item.note)}</div>` : ""}${item.completed ? `<div class="item-meta">تم بواسطة ${escapeHTML(item.completedByName || "—")} — ${formatDate(item.completedAt, true)}</div>` : ""}</div>
          <span class="item-index">${item.order || index + 1}</span>
        </article>`).join("")}</div>
    </section>`;
  }).join("") : `<div class="empty-state"><strong>قائمة التحقق فارغة</strong><span>يمكن للمدير إضافة البنود يدويًا أو رفعها من Excel.</span></div>`;
}

function expenseHTML(expense, allowDelete = true) {
  const canDelete = allowDelete && (isAdmin() || (isLead() && expense.createdBy === state.authUser?.uid));
  return `<article class="expense-card">
    <div><h4>${escapeHTML(expense.title)}</h4><p>${escapeHTML(expense.projectTitle || activeProject()?.title || "")} — ${escapeHTML(expense.category || "أخرى")} — ${formatDate(expense.date ? `${expense.date}T12:00:00` : expense.createdAt)}</p><p>أضافه ${escapeHTML(expense.createdByName || "—")}${expense.vendor ? ` — المورد: ${escapeHTML(expense.vendor)}` : ""}${expense.invoiceNumber ? ` — فاتورة: ${escapeHTML(expense.invoiceNumber)}` : ""}</p>${expense.note ? `<p>${escapeHTML(expense.note)}</p>` : ""}${expense.hasReceipt ? `<button class="receipt-link" data-open-receipt="${expense.id}" data-receipt-project="${expense.projectId || activeProject()?.id || ""}" type="button">فتح صورة الفاتورة</button>` : ""}</div>
    <div><div class="expense-amount">${formatMoney(expense.amount)}</div>${canDelete ? `<button class="row-menu" data-delete-expense="${expense.id}" type="button">حذف</button>` : ""}</div>
  </article>`;
}
function renderProjectExpenses() {
  const total = state.expenses.reduce((sum, expense) => sum + (Number(expense.amount) || 0), 0);
  byId("project-expense-total").textContent = formatMoney(total);
  byId("project-expenses-list").innerHTML = state.expenses.length ? state.expenses.map((e) => expenseHTML(e, true)).join("") : `<div class="empty-state"><strong>لا توجد مصروفات</strong><span>أضف مصروفًا وارفع صورة الفاتورة.</span></div>`;
}
function activityHTML(item) {
  return `<article class="timeline-item"><span class="timeline-dot"></span><div class="timeline-content"><p>${escapeHTML(item.message || item.type || "تحديث")}</p><small>${escapeHTML(item.userName || "النظام")} — ${formatDate(item.createdAt, true)}</small></div></article>`;
}
function renderActivity() {
  const html = state.activity.length ? state.activity.map(activityHTML).join("") : `<div class="empty-state"><strong>لا يوجد نشاط بعد</strong></div>`;
  byId("activity-list").innerHTML = html;
  byId("overview-activity").innerHTML = state.activity.length ? state.activity.slice(0, 5).map(activityHTML).join("") : html;
}

async function addActivity(projectId, type, message) {
  try {
    await addDoc(collection(state.db, "projects", projectId, "activity"), {
      type, message, userId: state.authUser.uid, userName: state.profile.name, createdAt: serverTimestamp()
    });
  } catch (error) { console.warn("Activity", error); }
}

function openProjectForm(project = null) {
  if (!isAdmin()) return;
  DOM.projectForm.reset();
  byId("project-id").value = project?.id || "";
  byId("project-modal-title").textContent = project ? "تعديل المشروع" : "إضافة مشروع";
  byId("project-title").value = project?.title || "";
  byId("project-code").value = project?.code || String((Math.max(0, ...state.projects.map((p) => Number(p.code) || 0)) + 1));
  byId("project-client").value = project?.client || "";
  byId("project-location").value = project?.location || "";
  byId("project-due-date").value = project?.dueDate || "";
  byId("project-budget").value = project?.budget || "";
  byId("project-description").value = project?.description || "";
  byId("project-status").value = project?.status || "pending";
  byId("project-lead-select").value = project?.assignedUserId || project?.startedByUserId || "";
  openModal(DOM.projectModal);
}

async function saveProject(event) {
  event.preventDefault();
  if (!isAdmin()) return;
  const submit = $("button[type='submit']", DOM.projectForm);
  setBusy(submit, true);
  const projectId = byId("project-id").value;
  const selectedUserId = byId("project-lead-select").value;
  const selectedUser = state.users.find((u) => u.id === selectedUserId);
  const existing = projectId ? state.projects.find((p) => p.id === projectId) : null;
  const assignmentChanged = existing && (existing.assignedUserId || existing.startedByUserId || "") !== selectedUserId;
  const payload = {
    title: byId("project-title").value.trim(), code: byId("project-code").value.trim(),
    client: byId("project-client").value.trim(), location: byId("project-location").value.trim(),
    dueDate: byId("project-due-date").value, budget: Number(byId("project-budget").value) || 0,
    description: byId("project-description").value.trim(), status: byId("project-status").value,
    assignedUserId: selectedUserId || "", assignedUserName: selectedUser?.name || "",
    visibleToAll: true, updatedAt: serverTimestamp()
  };
  if (!payload.title) { toast("اكتب اسم المشروع.", "error"); setBusy(submit, false); return; }
  try {
    if (projectId) {
      if (assignmentChanged) Object.assign(payload, { startedByUserId: "", startedByUserName: "", startedAt: null });
      await updateDoc(doc(state.db, "projects", projectId), payload);
      await addActivity(projectId, "project_updated", `عدّل المدير بيانات المشروع.`);
      toast("تم تحديث المشروع.", "success");
    } else {
      const ref = await addDoc(collection(state.db, "projects"), {
        ...payload, startedByUserId: "", startedByUserName: "", startedAt: null,
        checklistTotal: 0, checklistDone: 0, notesTotal: 0, notesDone: 0,
        expensesTotal: 0, progress: 0, createdBy: state.authUser.uid,
        createdByName: state.profile.name, createdAt: serverTimestamp()
      });
      await addActivity(ref.id, "project_created", `أنشأ المدير المشروع «${payload.title}».`);
      toast("تم إنشاء المشروع ويظهر الآن لكل المستخدمين.", "success");
    }
    closeModal(DOM.projectModal);
  } catch (error) { toast(readableError(error), "error"); }
  finally { setBusy(submit, false); }
}

async function claimProject(projectId = state.selectedProjectId) {
  const project = state.projects.find((item) => item.id === projectId) || activeProject();
  if (!canStart(project)) return;
  const button = byId("claim-project-button");
  setBusy(button, true, "جاري تسجيل البداية...");
  try {
    const projectRef = doc(state.db, "projects", project.id);
    await runTransaction(state.db, async (transaction) => {
      const snap = await transaction.get(projectRef);
      if (!snap.exists()) throw new Error("المشروع غير موجود.");
      const data = snap.data();
      if (data.startedByUserId) throw new Error(`بدأ ${data.startedByUserName || "مستخدم آخر"} العمل على المشروع بالفعل.`);
      if (data.assignedUserId && data.assignedUserId !== state.authUser.uid) throw new Error("هذا المشروع معيّن لمستخدم آخر.");
      transaction.update(projectRef, {
        assignedUserId: state.authUser.uid, assignedUserName: state.profile.name,
        startedByUserId: state.authUser.uid, startedByUserName: state.profile.name,
        startedAt: serverTimestamp(), status: "in_progress", updatedAt: serverTimestamp()
      });
    });
    await addActivity(project.id, "project_started", `بدأ ${state.profile.name} العمل على المشروع.`);
    toast(`تم تسجيل بدء العمل باسم ${state.profile.name}.`, "success");
  } catch (error) { toast(readableError(error), "error"); }
  finally { setBusy(button, false); }
}

async function releaseProject() {
  const project = activeProject();
  if (!isAdmin() || !project) return;
  confirmAction("إلغاء استلام المشروع", "سيصبح المشروع متاحًا لكل الفريق مرة أخرى.", async () => {
    try {
      await updateDoc(doc(state.db, "projects", project.id), {
        assignedUserId: "", assignedUserName: "", startedByUserId: "", startedByUserName: "", startedAt: null,
        status: "pending", updatedAt: serverTimestamp()
      });
      await addActivity(project.id, "project_released", "ألغى المدير استلام المشروع وأعاده للفريق.");
      toast("أصبح المشروع متاحًا للفريق.", "success");
    } catch (error) { toast(readableError(error), "error"); }
  }, "إلغاء الاستلام");
}

async function addNote(event) {
  event.preventDefault();
  const project = activeProject();
  if (!project || !canWork(project)) return;
  const submit = $("button[type='submit']", DOM.noteForm);
  const text = byId("note-text").value.trim();
  if (!text) return;
  setBusy(submit, true);
  try {
    const noteRef = doc(collection(state.db, "projects", project.id, "notes"));
    const projectRef = doc(state.db, "projects", project.id);
    const batch = writeBatch(state.db);
    batch.set(noteRef, {
      text, category: byId("note-category").value, completed: false,
      createdBy: state.authUser.uid, createdByName: state.profile.name, createdAt: serverTimestamp(),
      completedBy: "", completedByName: "", completedAt: null, updatedAt: serverTimestamp()
    });
    batch.update(projectRef, { notesTotal: increment(1), updatedAt: serverTimestamp() });
    await batch.commit();
    await addActivity(project.id, "note_added", `أضاف ${state.profile.name} ملاحظة: ${text}`);
    DOM.noteForm.reset(); closeModal(DOM.noteModal); toast("تمت إضافة الملاحظة.", "success");
  } catch (error) { toast(readableError(error), "error"); }
  finally { setBusy(submit, false); }
}

async function toggleNote(noteId) {
  const project = activeProject();
  if (!project || !canWork(project)) return;
  try {
    const noteRef = doc(state.db, "projects", project.id, "notes", noteId);
    const projectRef = doc(state.db, "projects", project.id);
    let newState = false;
    await runTransaction(state.db, async (transaction) => {
      const [noteSnap, projectSnap] = await Promise.all([transaction.get(noteRef), transaction.get(projectRef)]);
      if (!noteSnap.exists() || !projectSnap.exists()) throw new Error("الملاحظة غير موجودة.");
      const note = noteSnap.data(); const p = projectSnap.data();
      newState = !note.completed;
      const done = Math.max(0, (Number(p.notesDone) || 0) + (newState ? 1 : -1));
      transaction.update(noteRef, {
        completed: newState, completedBy: newState ? state.authUser.uid : "",
        completedByName: newState ? state.profile.name : "", completedAt: newState ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
      transaction.update(projectRef, { notesDone: done, updatedAt: serverTimestamp() });
    });
    await addActivity(project.id, "note_toggled", `${state.profile.name} ${newState ? "أنهى" : "أعاد فتح"} ملاحظة.`);
  } catch (error) { toast(readableError(error), "error"); }
}

async function deleteNote(noteId) {
  const project = activeProject(); const note = state.notes.find((n) => n.id === noteId);
  if (!project || !note) return;
  confirmAction("حذف الملاحظة", "لن تتمكن من استعادتها بعد الحذف.", async () => {
    try {
      const batch = writeBatch(state.db);
      batch.delete(doc(state.db, "projects", project.id, "notes", noteId));
      batch.update(doc(state.db, "projects", project.id), {
        notesTotal: increment(-1), notesDone: increment(note.completed ? -1 : 0), updatedAt: serverTimestamp()
      });
      await batch.commit();
      await addActivity(project.id, "note_deleted", `حذف ${state.profile.name} ملاحظة.`);
      toast("تم حذف الملاحظة.", "success");
    } catch (error) { toast(readableError(error), "error"); }
  }, "حذف");
}

async function addChecklistItem(event) {
  event.preventDefault();
  const project = activeProject();
  if (!project || !isAdmin()) return;
  const submit = $("button[type='submit']", DOM.checklistForm);
  setBusy(submit, true);
  try {
    const itemRef = doc(collection(state.db, "projects", project.id, "checklist"));
    const batch = writeBatch(state.db);
    const order = state.checklist.length ? Math.max(...state.checklist.map((i) => Number(i.order) || 0)) + 1 : 1;
    batch.set(itemRef, {
      phase: byId("checklist-phase").value.trim(), text: byId("checklist-text").value.trim(), order,
      completed: false, note: "", completedBy: "", completedByName: "", completedAt: null,
      createdBy: state.authUser.uid, createdByName: state.profile.name, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    batch.update(doc(state.db, "projects", project.id), { checklistTotal: increment(1), updatedAt: serverTimestamp() });
    await batch.commit();
    await addActivity(project.id, "checklist_added", "أضاف المدير بندًا إلى قائمة التحقق.");
    DOM.checklistForm.reset(); closeModal(DOM.checklistModal); toast("تمت إضافة البند.", "success");
  } catch (error) { toast(readableError(error), "error"); }
  finally { setBusy(submit, false); }
}

async function toggleChecklistItem(itemId) {
  const project = activeProject();
  if (!project || !canWork(project)) return;
  try {
    const itemRef = doc(state.db, "projects", project.id, "checklist", itemId);
    const projectRef = doc(state.db, "projects", project.id);
    let newCompleted = false;
    await runTransaction(state.db, async (transaction) => {
      const [itemSnap, projectSnap] = await Promise.all([transaction.get(itemRef), transaction.get(projectRef)]);
      if (!itemSnap.exists() || !projectSnap.exists()) throw new Error("البند غير موجود.");
      const item = itemSnap.data(); const p = projectSnap.data();
      newCompleted = !item.completed;
      const total = Number(p.checklistTotal) || 0;
      const done = Math.max(0, Math.min(total, (Number(p.checklistDone) || 0) + (newCompleted ? 1 : -1)));
      const progress = total ? Math.round((done / total) * 100) : 0;
      let nextStatus = p.status;
      if (done === total && total > 0) nextStatus = "review";
      else if (p.startedByUserId && p.status !== "completed") nextStatus = "in_progress";
      transaction.update(itemRef, {
        completed: newCompleted, completedBy: newCompleted ? state.authUser.uid : "",
        completedByName: newCompleted ? state.profile.name : "", completedAt: newCompleted ? serverTimestamp() : null,
        updatedAt: serverTimestamp()
      });
      transaction.update(projectRef, { checklistDone: done, progress, status: nextStatus, updatedAt: serverTimestamp() });
    });
    await addActivity(project.id, "checklist_toggled", `${state.profile.name} ${newCompleted ? "أنهى" : "أعاد فتح"} بندًا من قائمة التحقق.`);
  } catch (error) { toast(readableError(error), "error"); }
}

function openItemNote(itemId) {
  const item = state.checklist.find((i) => i.id === itemId);
  if (!item) return;
  byId("item-note-id").value = itemId;
  byId("item-note-text").value = item.note || "";
  byId("item-note-text").disabled = !canWork();
  $("button[type='submit']", DOM.itemNoteForm).classList.toggle("hidden", !canWork());
  openModal(DOM.itemNoteModal);
}
async function saveItemNote(event) {
  event.preventDefault();
  const project = activeProject(); const itemId = byId("item-note-id").value;
  if (!project || !itemId || !canWork(project)) return;
  const submit = $("button[type='submit']", DOM.itemNoteForm); setBusy(submit, true);
  try {
    await updateDoc(doc(state.db, "projects", project.id, "checklist", itemId), {
      note: byId("item-note-text").value.trim(), updatedAt: serverTimestamp()
    });
    await addActivity(project.id, "item_note", `${state.profile.name} حدّث ملاحظة بند في قائمة التحقق.`);
    closeModal(DOM.itemNoteModal); toast("تم حفظ ملاحظة البند.", "success");
  } catch (error) { toast(readableError(error), "error"); }
  finally { setBusy(submit, false); }
}

function previewReceipt(file) {
  const wrap = byId("receipt-preview");
  state.receiptFile = file || null;
  if (!file) { wrap.classList.add("hidden"); wrap.innerHTML = ""; return; }
  const url = URL.createObjectURL(file);
  wrap.classList.remove("hidden");
  wrap.innerHTML = `<img src="${url}" alt="معاينة الفاتورة" /><div><strong>${escapeHTML(file.name)}</strong><small>${(file.size / 1024 / 1024).toFixed(2)} MB</small></div>`;
}

async function compressInvoiceImage(file) {
  if (!file.type.startsWith("image/")) throw new Error("اختر صورة فاتورة بصيغة JPG أو PNG أو WEBP.");
  if (file.size > 12 * 1024 * 1024) throw new Error("حجم الصورة الأصلية أكبر من 12 MB.");
  const image = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    let maxSide = 1500;
    let quality = .78;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (!blob) throw new Error("تعذر ضغط صورة الفاتورة.");
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      if (String(dataUrl).length < 820000) return { dataUrl, contentType: "image/jpeg", name: file.name.replace(/\.[^.]+$/, ".jpg"), size: blob.size };
      maxSide = Math.round(maxSide * .82); quality = Math.max(.5, quality - .06);
    }
    throw new Error("الصورة تحتوي تفاصيل كثيرة جدًا. التقط صورة أقرب للفاتورة وحاول مرة أخرى.");
  } finally { URL.revokeObjectURL(url); }
}

async function addExpense(event) {
  event.preventDefault();
  const project = activeProject();
  if (!project || !canWork(project)) return;
  const submit = byId("save-expense-button"); setBusy(submit, true, "جاري الحفظ...");
  const amount = Number(byId("expense-amount").value);
  if (!(amount > 0)) { toast("اكتب مبلغًا صحيحًا.", "error"); setBusy(submit, false); return; }
  const expenseRef = doc(collection(state.db, "projects", project.id, "expenses"));
  try {
    const receipt = state.receiptFile ? await compressInvoiceImage(state.receiptFile) : null;
    const batch = writeBatch(state.db);
    batch.set(expenseRef, {
      projectId: project.id, projectTitle: project.title,
      title: byId("expense-title").value.trim(), category: byId("expense-category").value,
      amount, date: byId("expense-date").value, invoiceNumber: byId("expense-invoice-number").value.trim(),
      vendor: byId("expense-vendor").value.trim(), note: byId("expense-note").value.trim(),
      hasReceipt: Boolean(receipt), createdBy: state.authUser.uid, createdByName: state.profile.name,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    if (receipt) {
      batch.set(doc(state.db, "projects", project.id, "expenses", expenseRef.id, "receipt", "file"), {
        ...receipt, createdBy: state.authUser.uid, createdAt: serverTimestamp()
      });
    }
    batch.update(doc(state.db, "projects", project.id), { expensesTotal: increment(amount), updatedAt: serverTimestamp() });
    await batch.commit();
    await addActivity(project.id, "expense_added", `أضاف ${state.profile.name} مصروفًا بقيمة ${formatMoney(amount)}${receipt ? " مع صورة فاتورة" : ""}.`);
    DOM.expenseForm.reset(); state.receiptFile = null; previewReceipt(null);
    closeModal(DOM.expenseModal); toast("تم حفظ المصروف وصورة الفاتورة.", "success");
  } catch (error) { toast(readableError(error), "error"); }
  finally { setBusy(submit, false); }
}

async function openReceipt(expenseId, projectId = activeProject()?.id) {
  const project = state.projects.find((item) => item.id === projectId) || (activeProject()?.id === projectId ? activeProject() : null);
  if (!project) return;
  const dialog = byId("receipt-viewer-modal");
  const image = byId("receipt-viewer-image");
  const download = byId("receipt-download-link");
  byId("receipt-viewer-status").textContent = "جاري تحميل الصورة...";
  image.classList.add("hidden"); download.classList.add("hidden");
  openModal(dialog);
  try {
    const snap = await getDoc(doc(state.db, "projects", project.id, "expenses", expenseId, "receipt", "file"));
    if (!snap.exists()) throw new Error("صورة الفاتورة غير موجودة.");
    const receipt = snap.data();
    image.src = receipt.dataUrl; image.alt = receipt.name || "صورة الفاتورة"; image.classList.remove("hidden");
    download.href = receipt.dataUrl; download.download = receipt.name || "invoice.jpg"; download.classList.remove("hidden");
    byId("receipt-viewer-status").textContent = receipt.name || "صورة الفاتورة";
  } catch (error) { byId("receipt-viewer-status").textContent = readableError(error); }
}

async function deleteExpense(expenseId) {
  const project = activeProject(); const expense = state.expenses.find((e) => e.id === expenseId);
  if (!project || !expense) return;
  confirmAction("حذف المصروف", `سيتم حذف المصروف بقيمة ${formatMoney(expense.amount)} وصورة الفاتورة المرتبطة به.`, async () => {
    try {
      const batch = writeBatch(state.db);
      batch.delete(doc(state.db, "projects", project.id, "expenses", expenseId));
      if (expense.hasReceipt) batch.delete(doc(state.db, "projects", project.id, "expenses", expenseId, "receipt", "file"));
      batch.update(doc(state.db, "projects", project.id), { expensesTotal: increment(-(Number(expense.amount) || 0)), updatedAt: serverTimestamp() });
      await batch.commit();
      await addActivity(project.id, "expense_deleted", `حذف ${state.profile.name} مصروفًا بقيمة ${formatMoney(expense.amount)}.`);
      toast("تم حذف المصروف.", "success");
    } catch (error) { toast(readableError(error), "error"); }
  }, "حذف");
}

function parseExcelRows(rows) {
  const cleanRows = rows.filter((row) => Array.isArray(row) && row.some((cell) => String(cell ?? "").trim()));
  if (!cleanRows.length) return [];
  const normalizedHeader = cleanRows[0].map((cell) => normalize(cell));
  const phaseAliases = ["المرحلة", "مرحلة", "phase", "stage"];
  const itemAliases = ["البند", "العنصر", "المهمة", "التفاصيل", "item", "task", "description"];
  const orderAliases = ["الترتيب", "ترتيب", "order", "no", "#"];
  const findColumn = (aliases) => normalizedHeader.findIndex((header) => aliases.includes(header));
  let phaseCol = findColumn(phaseAliases), itemCol = findColumn(itemAliases), orderCol = findColumn(orderAliases), start = 1;
  if (itemCol < 0) { itemCol = cleanRows[0].length > 1 ? 1 : 0; phaseCol = cleanRows[0].length > 1 ? 0 : -1; orderCol = -1; start = 0; }
  let lastPhase = "عام";
  return cleanRows.slice(start).map((row, index) => {
    const phaseValue = phaseCol >= 0 ? String(row[phaseCol] ?? "").trim() : "";
    if (phaseValue) lastPhase = phaseValue;
    const text = String(row[itemCol] ?? "").trim();
    const order = orderCol >= 0 ? Number(row[orderCol]) || index + 1 : index + 1;
    return { phase: lastPhase || "عام", text, order };
  }).filter((item) => item.text);
}

async function handleExcelFile(file) {
  if (!file) return;
  if (!window.XLSX) { toast("تعذر تحميل أداة Excel. تحقق من الاتصال بالإنترنت.", "error"); return; }
  try {
    const data = await file.arrayBuffer();
    const workbook = window.XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    const parsed = parseExcelRows(rows);
    const existing = new Set(state.checklist.map((item) => normalize(`${item.phase}|${item.text}`)));
    state.excelRows = parsed.filter((item) => !existing.has(normalize(`${item.phase}|${item.text}`)));
    byId("excel-preview-count").textContent = state.excelRows.length;
    byId("excel-preview-body").innerHTML = state.excelRows.slice(0, 200).map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHTML(item.phase)}</td><td>${escapeHTML(item.text)}</td></tr>`).join("");
    byId("excel-preview-wrap").classList.toggle("hidden", !state.excelRows.length);
    byId("import-excel-confirm").disabled = !state.excelRows.length;
    if (!state.excelRows.length) toast("لم يتم العثور على عناصر جديدة صالحة.", "info");
  } catch (error) { toast(`تعذر قراءة الملف: ${readableError(error)}`, "error"); }
}

async function importExcelItems(event) {
  event.preventDefault();
  const project = activeProject();
  if (!project || !isAdmin() || !state.excelRows.length) return;
  const submit = byId("import-excel-confirm"); setBusy(submit, true, "جاري الإضافة...");
  try {
    let imported = 0;
    for (let offset = 0; offset < state.excelRows.length; offset += 400) {
      const batch = writeBatch(state.db);
      const chunk = state.excelRows.slice(offset, offset + 400);
      chunk.forEach((item, index) => {
        const itemRef = doc(collection(state.db, "projects", project.id, "checklist"));
        batch.set(itemRef, {
          phase: item.phase, text: item.text, order: state.checklist.length + offset + index + 1,
          completed: false, note: "", completedBy: "", completedByName: "", completedAt: null,
          createdBy: state.authUser.uid, createdByName: state.profile.name, createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
      });
      await batch.commit(); imported += chunk.length;
    }
    await updateDoc(doc(state.db, "projects", project.id), { checklistTotal: increment(imported), updatedAt: serverTimestamp() });
    await addActivity(project.id, "excel_import", `رفع المدير ${imported} بندًا من ملف Excel.`);
    state.excelRows = []; DOM.excelForm.reset(); byId("excel-preview-wrap").classList.add("hidden");
    closeModal(DOM.excelModal); toast(`تمت إضافة ${imported} بندًا من Excel.`, "success");
  } catch (error) { toast(readableError(error), "error"); }
  finally { setBusy(submit, false); }
}

async function seedStarterProject(silent = false) {
  if (!isAdmin()) return;
  const fixedRef = doc(state.db, "projects", "heliopolis-project-1");
  const existing = await getDoc(fixedRef);
  if (existing.exists()) { if (!silent) toast("مشروع هليوبوليس موجود بالفعل.", "info"); return; }
  const batch = writeBatch(state.db);
  batch.set(fixedRef, {
    code: STARTER_PROJECT.code, title: STARTER_PROJECT.title, client: STARTER_PROJECT.client,
    location: STARTER_PROJECT.location, description: STARTER_PROJECT.description, dueDate: STARTER_PROJECT.dueDate,
    budget: STARTER_PROJECT.budget, status: STARTER_PROJECT.status, assignedUserId: "", assignedUserName: "",
    startedByUserId: "", startedByUserName: "", startedAt: null, visibleToAll: true,
    checklistTotal: STARTER_PROJECT.checklist.length, checklistDone: 0,
    notesTotal: STARTER_PROJECT.notes.length, notesDone: STARTER_PROJECT.notes.filter((n) => n.completed).length,
    expensesTotal: 0, progress: 0, createdBy: state.authUser.uid, createdByName: state.profile.name,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  STARTER_PROJECT.checklist.forEach((item, index) => {
    const itemRef = doc(collection(fixedRef, "checklist"));
    batch.set(itemRef, { ...item, order: index + 1, completed: false, note: "", completedBy: "", completedByName: "", completedAt: null, createdBy: state.authUser.uid, createdByName: state.profile.name, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  STARTER_PROJECT.notes.forEach((note) => {
    const noteRef = doc(collection(fixedRef, "notes"));
    batch.set(noteRef, { ...note, createdBy: state.authUser.uid, createdByName: state.profile.name, createdAt: serverTimestamp(), completedBy: note.completed ? state.authUser.uid : "", completedByName: note.completed ? state.profile.name : "", completedAt: note.completed ? serverTimestamp() : null, updatedAt: serverTimestamp() });
  });
  const activityRef = doc(collection(fixedRef, "activity"));
  batch.set(activityRef, { type: "seed", message: "تم إنشاء مشروع هليوبوليس وقائمة التحقق المستخرجة من الصور.", userId: state.authUser.uid, userName: state.profile.name, createdAt: serverTimestamp() });
  await batch.commit();
  if (!silent) toast("تم إنشاء مشروع هليوبوليس وعناصره.", "success");
}

function exportProjectExcel() {
  const project = activeProject();
  if (!project || !window.XLSX) { toast("تعذر تحميل أداة Excel.", "error"); return; }
  const wb = window.XLSX.utils.book_new();
  const summary = [
    ["بيانات المشروع", "القيمة"], ["الكود", project.code], ["اسم المشروع", project.title], ["العميل", project.client],
    ["الموقع", project.location], ["الوصف", project.description], ["الحالة", statusInfo(project.status).label],
    ["تاريخ التسليم", project.dueDate], ["المسؤول", project.startedByUserName || project.assignedUserName || "متاح للفريق"],
    ["نسبة الإنجاز", `${projectProgress(project)}%`], ["إجمالي المصروفات", project.expensesTotal || 0]
  ];
  const checklistRows = [["الترتيب", "المرحلة", "البند", "مكتمل", "تم بواسطة", "تاريخ الإتمام", "ملاحظة"]].concat(state.checklist.map((i) => [i.order, i.phase, i.text, i.completed ? "نعم" : "لا", i.completedByName || "", formatDate(i.completedAt, true), i.note || ""]));
  const notesRows = [["الملاحظة", "التصنيف", "مكتملة", "أضافها", "أنهى بواسطة"]].concat(state.notes.map((n) => [n.text, n.category, n.completed ? "نعم" : "لا", n.createdByName || "", n.completedByName || ""]));
  const expenseRows = [["التاريخ", "البيان", "التصنيف", "المورد", "رقم الفاتورة", "المبلغ", "توجد صورة فاتورة"]].concat(state.expenses.map((e) => [e.date, e.title, e.category, e.vendor, e.invoiceNumber, e.amount, e.hasReceipt ? "نعم" : "لا"]));
  [["المشروع", summary], ["قائمة التحقق", checklistRows], ["الملاحظات", notesRows], ["المصروفات", expenseRows]].forEach(([name, rows]) => window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(rows), name));
  window.XLSX.writeFile(wb, `${project.title.replace(/[\\/:*?"<>|]/g, "-")}.xlsx`);
}

function openExpenseModal() {
  const project = activeProject();
  if (!project || !canWork(project)) { toast("ابدأ العمل على المشروع أولًا.", "info"); return; }
  DOM.expenseForm.reset(); state.receiptFile = null; previewReceipt(null);
  byId("expense-date").value = new Date().toISOString().slice(0, 10);
  openModal(DOM.expenseModal);
}
function openExcelModal() {
  if (!isAdmin()) return;
  DOM.excelForm.reset(); state.excelRows = [];
  byId("excel-preview-wrap").classList.add("hidden"); byId("import-excel-confirm").disabled = true;
  openModal(DOM.excelModal);
}

async function handleLogin(event) {
  event.preventDefault();
  const email = resolveLoginEmail(DOM.loginIdentity.value);
  const password = DOM.loginPassword.value;
  setBusy(DOM.loginButton, true, "جاري الدخول...");
  try { await signInWithEmailAndPassword(state.auth, email, password); }
  catch (error) { toast(readableError(error), "error"); }
  finally { setBusy(DOM.loginButton, false); }
}
async function resetPassword() {
  const identity = DOM.loginIdentity.value.trim();
  if (!identity) { toast("اكتب اسم المستخدم أو البريد أولًا.", "info"); return; }
  try { await sendPasswordResetEmail(state.auth, resolveLoginEmail(identity)); toast("تم إرسال رابط إعادة تعيين كلمة المرور.", "success"); }
  catch (error) { toast(readableError(error), "error"); }
}

function attachEvents() {
  DOM.loginForm.addEventListener("submit", handleLogin);
  byId("toggle-password").addEventListener("click", () => { DOM.loginPassword.type = DOM.loginPassword.type === "password" ? "text" : "password"; });
  byId("reset-password-button").addEventListener("click", resetPassword);
  byId("logout-button").addEventListener("click", () => signOut(state.auth));
  byId("refresh-button").addEventListener("click", () => location.reload());
  byId("mobile-menu-button").addEventListener("click", openMobileSidebar);
  byId("mobile-nav-backdrop").addEventListener("click", closeMobileSidebar);
  byId("quick-add-project").addEventListener("click", () => openProjectForm());
  byId("project-search").addEventListener("input", renderProjects);
  byId("project-status-filter").addEventListener("change", renderProjects);
  byId("back-to-projects").addEventListener("click", () => navigate("projects"));
  byId("claim-project-button").addEventListener("click", claimProject);
  byId("release-project-button").addEventListener("click", releaseProject);
  byId("edit-project-button").addEventListener("click", () => openProjectForm(activeProject()));
  byId("print-project-button").addEventListener("click", () => window.print());
  byId("export-project-button").addEventListener("click", exportProjectExcel);
  byId("add-note-button").addEventListener("click", () => { if (canWork()) { DOM.noteForm.reset(); openModal(DOM.noteModal); } else toast("ابدأ العمل على المشروع أولًا.", "info"); });
  byId("add-checklist-button").addEventListener("click", () => { DOM.checklistForm.reset(); openModal(DOM.checklistModal); });
  byId("import-excel-button").addEventListener("click", openExcelModal);
  byId("add-expense-button").addEventListener("click", openExpenseModal);
  byId("seed-project-button").addEventListener("click", () => seedStarterProject(false).catch((e) => toast(readableError(e), "error")));
  byId("show-item-notes").addEventListener("change", renderChecklist);
  byId("expense-receipt").addEventListener("change", (e) => previewReceipt(e.target.files?.[0] || null));
  byId("excel-file").addEventListener("change", (e) => handleExcelFile(e.target.files?.[0]));
  DOM.projectForm.addEventListener("submit", saveProject);
  DOM.noteForm.addEventListener("submit", addNote);
  DOM.checklistForm.addEventListener("submit", addChecklistItem);
  DOM.itemNoteForm.addEventListener("submit", saveItemNote);
  DOM.expenseForm.addEventListener("submit", addExpense);
  DOM.excelForm.addEventListener("submit", importExcelItems);

  document.addEventListener("click", (event) => {
    const target = event.target.closest("button,a");
    if (!target) return;
    if (target.matches(".close-modal")) closeModal(target.closest("dialog"));
    if (target.dataset.view) { navigate(target.dataset.view); closeMobileSidebar(); }
    if (target.dataset.action === "add-project") openProjectForm();
    if (target.dataset.openProject) openProject(target.dataset.openProject);
    if (target.dataset.projectTab) setProjectTab(target.dataset.projectTab);
    if (target.dataset.toggleNote) toggleNote(target.dataset.toggleNote);
    if (target.dataset.deleteNote) deleteNote(target.dataset.deleteNote);
    if (target.dataset.toggleItem) toggleChecklistItem(target.dataset.toggleItem);
    if (target.dataset.itemNote) openItemNote(target.dataset.itemNote);
    if (target.dataset.deleteExpense) deleteExpense(target.dataset.deleteExpense);
    if (target.dataset.openReceipt) openReceipt(target.dataset.openReceipt, target.dataset.receiptProject);
    if (target.dataset.claimProject) claimProject(target.dataset.claimProject);
    if (target.classList.contains("phase-head")) target.nextElementSibling?.classList.toggle("hidden");
  });
  DOM.backdrop.addEventListener("click", closeAllModals);
  byId("confirm-cancel").addEventListener("click", () => { state.confirmCallback = null; closeModal(DOM.confirmModal); });
  byId("confirm-accept").addEventListener("click", async () => {
    const callback = state.confirmCallback; state.confirmCallback = null; closeModal(DOM.confirmModal);
    if (callback) await callback();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeAllModals(); closeMobileSidebar(); } });
}

attachEvents();
initializeSystem();
