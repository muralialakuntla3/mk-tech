import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, clearStoredAuth, fileToDataUrl, getStoredAuth, saveStoredAuth } from '../lib/api';
import './AdminPortal.css';

const THEME_KEY = 'mk-theme';
const ADMIN_TAB_KEY = 'mk-admin-tab';
const ADMIN_COURSE_KEY = 'mk-admin-course-id';
const ADMIN_USER_KEY = 'mk-admin-user-id';
const emptyCourse = { title: '', description: '', imageUrl: '' };
const emptyUser = { fullName: '', username: '', email: '', password: '', role: 'user', profileImage: '' };
const getEmbedUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('drive.google.com')) {
      const parts = parsed.pathname.split('/');
      const fileIdIndex = parts.findIndex((p) => p === 'd') + 1;
      const fileId = fileIdIndex > 0 ? parts[fileIdIndex] : '';
      if (fileId) return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
      const videoId = parsed.searchParams.get('v');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '');
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return url;
  } catch {
    return url;
  }
};

const AdminPortal = () => {
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'light');
  const [tab, setTab] = useState(localStorage.getItem(ADMIN_TAB_KEY) || 'dashboard');
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [userForm, setUserForm] = useState(emptyUser);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [editingCourse, setEditingCourse] = useState(false);
  const [editingUser, setEditingUser] = useState(false);
  const [courseLearners, setCourseLearners] = useState([]);
  const [learnerCourses, setLearnerCourses] = useState([]);
  const [selectedLearnersToEnroll, setSelectedLearnersToEnroll] = useState([]);
  const [videoForm, setVideoForm] = useState({ title: '', videoUrl: '' });
  const [courseVideos, setCourseVideos] = useState([]);
  const [modules, setModules] = useState([]);
  const [moduleTitle, setModuleTitle] = useState('');
  const [editingModuleId, setEditingModuleId] = useState(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState('');
  const [expandedModuleId, setExpandedModuleId] = useState(null);
  const [editingVideoId, setEditingVideoId] = useState(null);
  const [courseViewTab, setCourseViewTab] = useState('overview');
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrollEmail, setEnrollEmail] = useState('');
  const [courseDocuments, setCourseDocuments] = useState([]);
  const [docForm, setDocForm] = useState({ name: '', fileUrl: '' });
  const [newCourseDocs, setNewCourseDocs] = useState([]);
  const [learnerSection, setLearnerSection] = useState('user');
  const [learnerPage, setLearnerPage] = useState(1);
  const [learnerPageSize, setLearnerPageSize] = useState(10);
  const [pagedUsers, setPagedUsers] = useState([]);
  const [serverTotalUsers, setServerTotalUsers] = useState(0);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [profileForm, setProfileForm] = useState({
    username: auth?.user?.username || '',
    fullName: auth?.user?.fullName || '',
    profileImage: auth?.user?.profileImage || '',
    currentPassword: '',
    newPassword: '',
  });

  const learners = useMemo(() => users.filter((user) => user.role === 'user'), [users]);
  const filteredCourses = useMemo(
    () => courses.filter((item) => `${item.title} ${item.description}`.toLowerCase().includes(search.toLowerCase())),
    [courses, search]
  );
  const totalLearnerPages = Math.max(1, Math.ceil(serverTotalUsers / learnerPageSize));

  const loadUsersPage = async () => {
    try {
      setIsUsersLoading(true);
      const data = await apiRequest(`/admin/learners?role=${encodeURIComponent(learnerSection)}&search=${encodeURIComponent(search)}&page=${learnerPage}&pageSize=${learnerPageSize}`);
      setPagedUsers(data.learners || []);
      setServerTotalUsers(data.pagination?.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUsersLoading(false);
    }
  };

  const loadDashboard = async () => {
    const data = await apiRequest('/admin/dashboard');
    const nextCourses = (data.courses || []).slice().sort((a, b) => (a.title || '').localeCompare((b.title || ''), undefined, { sensitivity: 'base' }));
    const nextUsers = (data.users || []).slice().sort((a, b) => {
      const aKey = (a.fullName || a.username || '').toLowerCase();
      const bKey = (b.fullName || b.username || '').toLowerCase();
      return aKey.localeCompare(bKey, undefined, { sensitivity: 'base' });
    });
    setCourses(nextCourses);
    setUsers(nextUsers);
  };

  useEffect(() => {
    loadDashboard().catch((err) => setError(err.message));
  }, []);
  useEffect(() => {
    if (!courses.length && !users.length) return;
    const savedCourseId = Number(localStorage.getItem(ADMIN_COURSE_KEY));
    const savedUserId = Number(localStorage.getItem(ADMIN_USER_KEY));
    if (savedCourseId) {
      const savedCourse = courses.find((item) => item.id === savedCourseId);
      if (savedCourse) {
        openCourse(savedCourse).catch(() => {});
      }
    } else if (savedUserId) {
      const savedUser = users.find((item) => item.id === savedUserId);
      if (savedUser) {
        openUser(savedUser).catch(() => {});
      }
    }
  }, [courses, users]);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);
  useEffect(() => {
    localStorage.setItem(ADMIN_TAB_KEY, tab);
  }, [tab]);
  useEffect(() => {
    if (selectedCourse?.id) {
      localStorage.setItem(ADMIN_COURSE_KEY, String(selectedCourse.id));
    } else {
      localStorage.removeItem(ADMIN_COURSE_KEY);
    }
  }, [selectedCourse]);
  useEffect(() => {
    if (selectedUser?.id) {
      localStorage.setItem(ADMIN_USER_KEY, String(selectedUser.id));
    } else {
      localStorage.removeItem(ADMIN_USER_KEY);
    }
  }, [selectedUser]);

  useEffect(() => {
    if (!status && !error) return undefined;
    const timer = setTimeout(() => {
      setStatus('');
      setError('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [status, error]);

  const openCourse = async (course) => {
    setSelectedCourse(course);
    setSelectedUser(null);
    setEditingCourse(false);
    setCourseViewTab('overview');
    setCourseForm({ title: course.title, description: course.description || '', imageUrl: course.imageUrl || '' });
    const data = await apiRequest(`/admin/courses/${course.id}/learners`);
    setCourseLearners(data.learners || []);
    const moduleData = await apiRequest(`/admin/courses/${course.id}/modules`);
    setModules(moduleData.modules || []);
    const videosData = await apiRequest(`/admin/courses/${course.id}/videos`);
    setCourseVideos(videosData.videos || []);
    const docsData = await apiRequest(`/admin/courses/${course.id}/documents`);
    setCourseDocuments(docsData.documents || []);
    setVideoForm({ title: '', videoUrl: '' });
    setEditingVideoId(null);
    setEnrollSearch('');
    setEnrollEmail('');
    setEditingModuleId(null);
    setEditingModuleTitle('');
    setExpandedModuleId(null);
  };

  const openUser = async (user) => {
    setSelectedUser(user);
    setSelectedCourse(null);
    setEditingUser(false);
    setUserForm({
      fullName: user.fullName,
      username: user.username,
      email: user.email || '',
      password: '',
      role: user.role,
      profileImage: user.profileImage || '',
    });
    const data = await apiRequest(`/admin/learners/${user.id}/courses`);
    setLearnerCourses(data.courses || []);
  };

  const handleCreateCourse = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      await apiRequest('/admin/courses', { method: 'POST', body: JSON.stringify(courseForm) });
      const refreshed = await apiRequest('/admin/dashboard');
      const created = (refreshed.courses || []).find((item) => item.title === courseForm.title);
      if (created && newCourseDocs.length) {
        for (const doc of newCourseDocs) {
          await apiRequest(`/admin/courses/${created.id}/documents`, {
            method: 'POST',
            body: JSON.stringify({ name: doc.name, fileUrl: doc.fileUrl }),
          });
        }
      }
      setCourseForm(emptyCourse);
      setNewCourseDocs([]);
      await loadDashboard();
      setStatus('Course created.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateCourse = async () => {
    if (!selectedCourse) return;
    setError('');
    setStatus('');
    try {
      await apiRequest(`/admin/courses/${selectedCourse.id}`, { method: 'PUT', body: JSON.stringify(courseForm) });
      await loadDashboard();
      setStatus('Course updated.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddVideo = async () => {
    if (!selectedCourse) return;
    setError('');
    setStatus('');
    try {
      if (editingVideoId) {
        await apiRequest(`/admin/courses/${selectedCourse.id}/videos/${editingVideoId}`, {
          method: 'PUT',
          body: JSON.stringify(videoForm),
        });
      } else {
        await apiRequest(`/admin/courses/${selectedCourse.id}/videos`, { method: 'POST', body: JSON.stringify(videoForm) });
      }
      setVideoForm({ title: '', videoUrl: '' });
      setEditingVideoId(null);
      const videosData = await apiRequest(`/admin/courses/${selectedCourse.id}/videos`);
      setCourseVideos(videosData.videos || []);
      setStatus(editingVideoId ? 'Video updated.' : 'Video added.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    setError('');
    setStatus('');
    try {
      await apiRequest('/admin/users', { method: 'POST', body: JSON.stringify(userForm) });
      setUserForm(emptyUser);
      await loadDashboard();
      setStatus('User created.');
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (tab !== 'learners') return;
    loadUsersPage().catch(() => {});
  }, [tab, learnerSection, learnerPage, learnerPageSize, search]);

  const handleUpdateUser = async () => {
    if (!selectedUser) return;
    setError('');
    setStatus('');
    try {
      await apiRequest(`/admin/users/${selectedUser.id}`, { method: 'PUT', body: JSON.stringify(userForm) });
      await loadDashboard();
      setStatus('User updated.');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddLearnersToCourse = async () => {
    if (!selectedCourse) return;
    await apiRequest(`/admin/courses/${selectedCourse.id}/learners`, {
      method: 'POST',
      body: JSON.stringify({ learnerIds: selectedLearnersToEnroll }),
    });
    const data = await apiRequest(`/admin/courses/${selectedCourse.id}/learners`);
    setCourseLearners(data.learners || []);
    setSelectedLearnersToEnroll([]);
  };

  const handleRemoveLearnerCourse = async (courseId) => {
    if (!selectedUser) return;
    await apiRequest(`/admin/learners/${selectedUser.id}/courses/${courseId}`, { method: 'DELETE' });
    const data = await apiRequest(`/admin/learners/${selectedUser.id}/courses`);
    setLearnerCourses(data.courses || []);
  };

  const handleSettingsSave = async () => {
    setError('');
    setStatus('');
    try {
      const profileResult = await apiRequest('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({
          username: profileForm.username,
          fullName: profileForm.fullName,
          profileImage: profileForm.profileImage,
        }),
      });
      if (profileForm.currentPassword && profileForm.newPassword) {
        await apiRequest('/auth/me/password', {
          method: 'PUT',
          body: JSON.stringify({
            currentPassword: profileForm.currentPassword,
            newPassword: profileForm.newPassword,
          }),
        });
      }
      saveStoredAuth({
        ...auth,
        user: {
          ...auth.user,
          username: profileResult.user.username,
          fullName: profileResult.user.fullName,
          profileImage: profileResult.user.profileImage,
        },
      });
      setProfileForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
      setStatus('Settings updated.');
    } catch (err) {
      setError(err.message);
    }
  };

  const topSearchList = tab === 'courses' ? filteredCourses : pagedUsers;
  const learnerCount = users.filter((item) => item.role === 'user').length;
  const adminCount = users.filter((item) => item.role === 'admin').length;
  const managerCount = users.filter((item) => item.role === 'manager').length;
  const videoCount = courses.reduce((sum, course) => sum + (course.videoCount || 0), 0);
  const maxCount = Math.max(courses.length, learnerCount, adminCount, videoCount, 1);

  return (
    <div className={`portal-shell theme-${theme}`}>
      <div className="console-layout">
        <aside className="left-nav">
          <h2>Admin Console</h2>
          <button type="button" className={tab === 'dashboard' ? 'nav-active' : ''} onClick={() => { setTab('dashboard'); setSelectedCourse(null); setSelectedUser(null); }}>Dashboard</button>
          <button type="button" className={tab === 'learners' ? 'nav-active' : ''} onClick={() => { setTab('learners'); setSearch(''); setSelectedUser(null); }}>Learner Management</button>
          <button type="button" className={tab === 'courses' ? 'nav-active' : ''} onClick={() => { setTab('courses'); setSearch(''); setSelectedCourse(null); }}>Course Management</button>
          <button type="button" className={tab === 'settings' ? 'nav-active' : ''} onClick={() => setTab('settings')}>Settings</button>
          <button type="button" className="secondary-button" onClick={() => { clearStoredAuth(); navigate('/'); }}>Logout</button>
        </aside>
        <main>
          <div className="top-profile">
            {auth?.user?.profileImage ? <img src={auth.user.profileImage} alt={auth.user.fullName || auth.user.username} className="top-avatar" /> : null}
            <span>{auth?.user?.fullName || auth?.user?.username || 'Admin'}</span>
            <button type="button" className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label="Toggle theme">🌙</button>
          </div>
          <div className="page-actions">
            {(tab === 'courses' || tab === 'learners') ? (
              <div className="search-wrap">
                <span>🔍</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${tab}...`} />
              </div>
            ) : <div />}
            <div />
          </div>
          {status ? <div className="status-banner success-banner">{status}</div> : null}
          {error ? <div className="status-banner error-banner">{error}</div> : null}

          {tab === 'dashboard' ? (
            <section className="portal-card">
              <h2>Admin Dashboard</h2>
              <div className="dashboard-stats">
                <div className="stat-card"><strong>{courses.length}</strong><span>Courses</span></div>
                <div className="stat-card"><strong>{learnerCount}</strong><span>Learners</span></div>
                <div className="stat-card"><strong>{adminCount}</strong><span>Admins</span></div>
                <div className="stat-card"><strong>{videoCount}</strong><span>Videos</span></div>
                <div className="stat-card"><strong>{managerCount}</strong><span>Managers</span></div>
              </div>
              <div className="bar-chart">
                {[{ label: 'Courses', value: courses.length }, { label: 'Learners', value: learnerCount }, { label: 'Admins', value: adminCount }, { label: 'Videos', value: videoCount }].map((item) => (
                  <div key={item.label} className="bar-item">
                    <span>{item.label}</span>
                    <div className="bar-track"><div className="bar-fill" style={{ width: `${(item.value / maxCount) * 100}%` }} /></div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {tab === 'courses' ? (
            <>
              {!selectedCourse ? (
                <section className="portal-card">
                  <h2>Course Management</h2>
                  <form className="stack-form" onSubmit={handleCreateCourse}>
                    <label>Course Title</label>
                    <input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} placeholder="Course title" required />
                    <label>Description</label>
                    <textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} placeholder="Description" />
                    <label>Course Image Upload</label>
                    <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setCourseForm({ ...courseForm, imageUrl: await fileToDataUrl(file) }); }} required />
                    <label>Document Upload</label>
                    <input type="file" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const fileUrl = await fileToDataUrl(file); setNewCourseDocs((prev) => [...prev, { name: file.name, fileUrl }]); }} />
                    <label>Document Link (optional)</label>
                    <input placeholder="Paste a document link and press Enter" onKeyDown={(e) => { if (e.key !== 'Enter') return; e.preventDefault(); const link = e.currentTarget.value.trim(); if (!link) return; setNewCourseDocs((prev) => [...prev, { name: link, fileUrl: link }]); e.currentTarget.value = ''; }} />
                    {newCourseDocs.length ? <div className="muted-text">{newCourseDocs.length} document(s) selected.</div> : null}
                    <button type="submit">Create Course</button>
                  </form>
                  <table className="data-table">
                    <thead><tr><th>Image</th><th>Title</th><th>Description</th><th>Videos</th></tr></thead>
                    <tbody>
                      {filteredCourses.map((item) => (
                        <tr key={item.id} onClick={() => openCourse(item)}>
                          <td>{item.imageUrl ? <img src={item.imageUrl} alt={item.title} className="table-thumb" /> : '-'}</td><td>{item.title}</td><td>{item.description}</td><td>{item.videoCount || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ) : (
                <section className="portal-card">
                  <div className="section-title-row">
                    <h2>{selectedCourse.title}</h2>
                    <div className="inline-form">
                      <button type="button" onClick={() => setEditingCourse((current) => !current)}>{editingCourse ? 'Done' : '✏️ Edit'}</button>
                      <button type="button" onClick={async () => { await apiRequest(`/admin/courses/${selectedCourse.id}`, { method: 'DELETE' }); setSelectedCourse(null); await loadDashboard(); setStatus('Course deleted.'); }}>🗑️ Delete</button>
                      <button type="button" onClick={() => setSelectedCourse(null)}>Back</button>
                    </div>
                  </div>
                  <div className="inline-form" style={{ gridTemplateColumns: 'repeat(3, auto)', justifyContent: 'start' }}>
                    <button type="button" className={courseViewTab === 'overview' ? 'nav-active' : ''} onClick={() => setCourseViewTab('overview')}>Overview</button>
                    <button type="button" className={courseViewTab === 'videos' ? 'nav-active' : ''} onClick={() => setCourseViewTab('videos')}>Videos</button>
                    <button type="button" className={courseViewTab === 'enrolled' ? 'nav-active' : ''} onClick={() => setCourseViewTab('enrolled')}>Enrolled</button>
                  </div>

                  {courseViewTab === 'overview' ? (
                    <form className="stack-form" onSubmit={(e) => e.preventDefault()}>
                      {courseForm.imageUrl ? <img src={courseForm.imageUrl} alt={courseForm.title} className="course-image" /> : null}
                      <label>Course Title</label>
                      <input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} required disabled={!editingCourse} />
                      <label>Description</label>
                      <textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} disabled={!editingCourse} />
                      <label>Course Image</label>
                      <input type="file" accept="image/*" disabled={!editingCourse} onChange={async (e) => { const file = e.target.files?.[0]; if (file) setCourseForm({ ...courseForm, imageUrl: await fileToDataUrl(file) }); }} />
                      {editingCourse ? <button type="button" onClick={handleUpdateCourse}>Update Course</button> : null}
                      <label>Upload Course Document / Add Document Link</label>
                      <div className="inline-form">
                        <input value={docForm.name} onChange={(e) => setDocForm({ ...docForm, name: e.target.value })} placeholder="Document name" />
                        <input value={docForm.fileUrl} onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })} placeholder="Document link (or choose file)" />
                        <input type="file" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setDocForm({ name: file.name, fileUrl: await fileToDataUrl(file) }); }} />
                        <button type="button" onClick={async () => { if (!docForm.name || !docForm.fileUrl) return; await apiRequest(`/admin/courses/${selectedCourse.id}/documents`, { method: 'POST', body: JSON.stringify(docForm) }); const docsData = await apiRequest(`/admin/courses/${selectedCourse.id}/documents`); setCourseDocuments(docsData.documents || []); setDocForm({ name: '', fileUrl: '' }); setStatus('Document uploaded.'); }}>Upload</button>
                      </div>
                      <table className="data-table">
                        <thead><tr><th>S.No</th><th>Name</th><th>Read</th><th>Delete</th></tr></thead>
                        <tbody>
                          {courseDocuments.map((doc, idx) => (
                            <tr key={doc.id}>
                              <td>{idx + 1}</td>
                              <td>{doc.name}</td>
                              <td><button type="button" onClick={() => setPreviewDoc(doc)}>Open</button></td>
                              <td><button type="button" onClick={async () => { await apiRequest(`/admin/courses/${selectedCourse.id}/documents/${doc.id}`, { method: 'DELETE' }); const docsData = await apiRequest(`/admin/courses/${selectedCourse.id}/documents`); setCourseDocuments(docsData.documents || []); }}>🗑️</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </form>
                  ) : null}

                  {courseViewTab === 'videos' ? (
                    <>
                      <div className="inline-form">
                        <div>
                          <label>Add / Update Video</label>
                          <div className="inline-form">
                            <input value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} placeholder="Video title" />
                            <input value={videoForm.videoUrl} onChange={(e) => setVideoForm({ ...videoForm, videoUrl: e.target.value })} placeholder="YouTube / Drive / Link" />
                            <select value={videoForm.moduleId || ''} onChange={(e) => setVideoForm({ ...videoForm, moduleId: e.target.value ? Number(e.target.value) : '' })}>
                              <option value="">No Module</option>
                              {modules.map((moduleItem) => <option key={moduleItem.id} value={moduleItem.id}>{moduleItem.title}</option>)}
                            </select>
                            <button type="button" onClick={handleAddVideo}>{editingVideoId ? 'Update Video' : 'Add Video'}</button>
                          </div>
                        </div>
                        <div>
                          <label>Create Module</label>
                          <div className="inline-form">
                            <input value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} placeholder="New module title" />
                            <button type="button" onClick={async () => { try { if (!moduleTitle.trim()) return; await apiRequest(`/admin/courses/${selectedCourse.id}/modules`, { method: 'POST', body: JSON.stringify({ title: moduleTitle }) }); const moduleData = await apiRequest(`/admin/courses/${selectedCourse.id}/modules`); setModules(moduleData.modules || []); setModuleTitle(''); setStatus('Module added.'); } catch (err) { setError(err.message); } }}>Add Module</button>
                          </div>
                        </div>
                      </div>
                      <h3>Modules</h3>
                      <table className="data-table">
                        <thead><tr><th>S.No</th><th>Module</th><th>Videos</th><th>Edit</th><th>Delete</th></tr></thead>
                        <tbody>
                          {modules.map((moduleItem, idx) => (
                            <React.Fragment key={moduleItem.id}>
                              <tr>
                                <td>{idx + 1}</td>
                                <td>{editingModuleId === moduleItem.id ? <input value={editingModuleTitle} onChange={(e) => setEditingModuleTitle(e.target.value)} /> : moduleItem.title}</td>
                                <td>{moduleItem.videos?.length || 0}</td>
                                <td>
                                  {editingModuleId === moduleItem.id ? (
                                    <button type="button" onClick={async () => { await apiRequest(`/admin/courses/${selectedCourse.id}/modules/${moduleItem.id}`, { method: 'PUT', body: JSON.stringify({ title: editingModuleTitle }) }); const moduleData = await apiRequest(`/admin/courses/${selectedCourse.id}/modules`); setModules(moduleData.modules || []); setEditingModuleId(null); setEditingModuleTitle(''); }}>Save</button>
                                  ) : (
                                    <button type="button" onClick={() => { setEditingModuleId(moduleItem.id); setEditingModuleTitle(moduleItem.title); }}>✏️</button>
                                  )}
                                </td>
                                <td><button type="button" onClick={async () => { await apiRequest(`/admin/courses/${selectedCourse.id}/modules/${moduleItem.id}`, { method: 'DELETE' }); const moduleData = await apiRequest(`/admin/courses/${selectedCourse.id}/modules`); setModules(moduleData.modules || []); }}>🗑️</button></td>
                              </tr>
                              <tr>
                                <td colSpan={5}>
                                  <button type="button" onClick={() => setExpandedModuleId((curr) => curr === moduleItem.id ? null : moduleItem.id)}>
                                    {expandedModuleId === moduleItem.id ? 'Hide Videos' : 'Show Videos'}
                                  </button>
                                  {expandedModuleId === moduleItem.id ? (
                                    <table className="data-table">
                                      <thead><tr><th>S.No</th><th>Title</th><th>Link</th></tr></thead>
                                      <tbody>
                                        {(moduleItem.videos || []).map((v, vIdx) => <tr key={v.id}><td>{vIdx + 1}</td><td>{v.title}</td><td><a href={v.videoUrl} target="_blank" rel="noreferrer">Open</a></td></tr>)}
                                      </tbody>
                                    </table>
                                  ) : null}
                                </td>
                              </tr>
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>

                      <h3>Videos</h3>
                      <table className="data-table">
                        <thead><tr><th>S.No</th><th>Title</th><th>Link</th><th>Edit</th><th>Delete</th></tr></thead>
                        <tbody>
                          {(courseVideos || []).map((v, idx) => (
                            <tr key={v.id}>
                              <td>{idx + 1}</td>
                              <td>{v.title}</td>
                              <td><a href={v.videoUrl} target="_blank" rel="noreferrer">Open</a></td>
                              <td><button type="button" onClick={() => { setEditingVideoId(v.id); setVideoForm({ title: v.title, videoUrl: v.videoUrl, moduleId: v.moduleId || '' }); }}>✏️</button></td>
                              <td><button type="button" onClick={async () => { try { await apiRequest(`/admin/courses/${selectedCourse.id}/videos/${v.id}`, { method: 'DELETE' }); const videosData = await apiRequest(`/admin/courses/${selectedCourse.id}/videos`); setCourseVideos(videosData.videos || []); setStatus('Video deleted.'); } catch (err) { setError(err.message); } }}>🗑️</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : null}

                  {courseViewTab === 'enrolled' ? (
                    <>
                      <h3>Enroll Learners</h3>
                      <div className="inline-form">
                        <input value={enrollSearch} onChange={(e) => setEnrollSearch(e.target.value)} placeholder="Search learners by name/email..." />
                        <button
                          type="button"
                          onClick={() => {
                            const q = enrollSearch.trim().toLowerCase();
                            if (!q) return;
                            const match = learners.find((l) => (l.email || '').toLowerCase() === q)
                              || learners.find((l) => (l.fullName || '').toLowerCase().includes(q) || (l.username || '').toLowerCase().includes(q));
                            if (match) {
                              setSelectedLearnersToEnroll((prev) => (prev.includes(match.id) ? prev : [...prev, match.id]));
                              setEnrollSearch('');
                            }
                          }}
                        >
                          Add
                        </button>
                      </div>
                      <div className="inline-form">
                        <input value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} placeholder="Or enroll by learner email..." />
                        <button
                          type="button"
                          onClick={async () => {
                            const email = enrollEmail.trim().toLowerCase();
                            if (!email) return;
                            await apiRequest(`/admin/courses/${selectedCourse.id}/learners`, { method: 'POST', body: JSON.stringify({ learnerEmails: [email] }) });
                            const data = await apiRequest(`/admin/courses/${selectedCourse.id}/learners`);
                            setCourseLearners(data.learners || []);
                            setEnrollEmail('');
                            setStatus('Learner enrolled.');
                          }}
                        >
                          Enroll
                        </button>
                      </div>
                      {selectedLearnersToEnroll.length ? (
                        <button type="button" onClick={handleAddLearnersToCourse}>Enroll selected ({selectedLearnersToEnroll.length})</button>
                      ) : null}
                      <table className="data-table">
                        <thead><tr><th>Name</th><th>Email</th><th>Remove</th></tr></thead>
                        <tbody>
                          {courseLearners.map((l) => (
                            <tr key={l.id}>
                              <td>{l.fullName}</td>
                              <td>{l.email}</td>
                              <td><button type="button" onClick={async () => { await apiRequest(`/admin/courses/${selectedCourse.id}/learners/${l.id}`, { method: 'DELETE' }); const data = await apiRequest(`/admin/courses/${selectedCourse.id}/learners`); setCourseLearners(data.learners || []); setStatus('Learner removed.'); }}>🗑️</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  ) : null}
                </section>
              )}
            </>
          ) : null}

          {tab === 'learners' ? (
            <>
              {!selectedUser ? (
                <section className="portal-card">
                  <h2>Learner/Admin Management</h2>
                  <div className="inline-form" style={{ gridTemplateColumns: 'repeat(2, auto)', justifyContent: 'start' }}>
                    <button type="button" className={learnerSection === 'user' ? 'nav-active' : ''} onClick={() => { setLearnerSection('user'); setLearnerPage(1); }}>Learners</button>
                    <button type="button" className={learnerSection === 'admin' ? 'nav-active' : ''} onClick={() => { setLearnerSection('admin'); setLearnerPage(1); }}>Admins</button>
                    <button type="button" className={learnerSection === 'manager' ? 'nav-active' : ''} onClick={() => { setLearnerSection('manager'); setLearnerPage(1); }}>Managers</button>
                  </div>
                  <form className="stack-form" onSubmit={handleCreateUser}>
                    <input value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} placeholder="Full name" required />
                    <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} placeholder="Username" required />
                    <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="Email" required />
                    <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Password" required />
                    <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                      <option value="user">Learner</option>
                      {auth?.user?.role === 'admin' ? <option value="manager">Manager</option> : null}
                      {auth?.user?.role === 'admin' ? <option value="admin">Admin</option> : null}
                    </select>
                    <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setUserForm({ ...userForm, profileImage: await fileToDataUrl(file) }); }} required={userForm.role === 'user'} />
                    <button type="submit">Create User</button>
                  </form>
                  {isUsersLoading ? <div className="status-banner">Loading users...</div> : null}
                  <table className="data-table"><thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th></tr></thead><tbody>{pagedUsers.map((item) => <tr key={item.id} onClick={() => openUser(item)}><td>{item.fullName}</td><td>{item.username}</td><td>{item.email}</td><td>{item.role}</td></tr>)}</tbody></table>
                  <div className="inline-form" style={{ gridTemplateColumns: 'auto auto auto auto', alignItems: 'center' }}>
                    <span>Show</span>
                    <select value={learnerPageSize} onChange={(e) => { setLearnerPageSize(Number(e.target.value)); setLearnerPage(1); }}>
                      <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                    </select>
                    <button type="button" disabled={learnerPage <= 1} onClick={() => setLearnerPage((p) => Math.max(1, p - 1))}>Prev</button>
                    <button type="button" disabled={learnerPage >= totalLearnerPages} onClick={() => setLearnerPage((p) => Math.min(totalLearnerPages, p + 1))}>Next</button>
                  </div>
                </section>
              ) : (
                <section className="portal-card">
                  <div className="section-title-row">
                    <h2>{selectedUser.fullName}</h2>
                    <div className="inline-form">
                      <button type="button" onClick={() => setEditingUser((current) => !current)}>📌 Edit</button>
                      <button type="button" onClick={async () => { await apiRequest(`/admin/users/${selectedUser.id}`, { method: 'DELETE' }); setSelectedUser(null); await loadDashboard(); setStatus('User deleted.'); }} disabled={Boolean(selectedUser.isMasterAdmin)}>Delete User</button>
                      <button type="button" onClick={() => setSelectedUser(null)}>Back</button>
                    </div>
                  </div>
                  <form className="stack-form" onSubmit={(e) => e.preventDefault()}>
                    <label>Full Name</label>
                    <input value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} disabled={!editingUser} />
                    <label>Username</label>
                    <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} disabled={!editingUser} />
                    <label>Email</label>
                    <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} disabled={!editingUser} />
                    <label>Password</label>
                    <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Optional new password" disabled={!editingUser} />
                    <label>Role</label>
                    <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} disabled={!editingUser || Boolean(selectedUser.isMasterAdmin)}>
                      <option value="user">Learner</option>
                      {auth?.user?.role === 'admin' ? <option value="manager">Manager</option> : null}
                      {auth?.user?.role === 'admin' ? <option value="admin">Admin</option> : null}
                    </select>
                    <label>Profile Image</label>
                    <input type="file" accept="image/*" disabled={!editingUser} onChange={async (e) => { const file = e.target.files?.[0]; if (file) setUserForm({ ...userForm, profileImage: await fileToDataUrl(file) }); }} />
                    {editingUser ? <button type="button" onClick={handleUpdateUser}>Update User</button> : null}
                  </form>
                  {selectedUser.role === 'user' ? (
                    <>
                      <h3>Enrolled Courses</h3>
                      <table className="data-table"><thead><tr><th>Course</th><th>Action</th></tr></thead><tbody>{learnerCourses.map((course) => <tr key={course.id}><td>{course.title}</td><td><button type="button" onClick={() => handleRemoveLearnerCourse(course.id)}>Remove</button></td></tr>)}</tbody></table>
                    </>
                  ) : null}
                </section>
              )}
            </>
          ) : null}

          {tab === 'settings' ? (
            <section className="portal-card">
              <h2>Admin Settings</h2>
              <form className="stack-form" onSubmit={(e) => e.preventDefault()}>
                <label>Full Name</label>
                <input value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })} placeholder="Full name" />
                <label>Username</label>
                <input value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} placeholder="Username" />
                <label>Profile Image</label>
                <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setProfileForm({ ...profileForm, profileImage: await fileToDataUrl(file) }); }} />
                <label>Current Password</label>
                <input type="password" value={profileForm.currentPassword} onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })} placeholder="Current password" />
                <label>New Password</label>
                <input type="password" value={profileForm.newPassword} onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })} placeholder="New password" />
                <button type="button" onClick={handleSettingsSave}>Save Settings</button>
              </form>
            </section>
          ) : null}
          {previewDoc ? (
            <div className="modal-overlay" role="dialog" aria-modal="true" onClick={() => setPreviewDoc(null)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <strong>{previewDoc.name || 'Document'}</strong>
                  <button type="button" onClick={() => setPreviewDoc(null)}>Close</button>
                </div>
                <div className="modal-body">
                  <iframe title={previewDoc.name || 'Document'} src={previewDoc.fileUrl} className="modal-frame" />
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default AdminPortal;

