import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, clearStoredAuth, fileToDataUrl, getStoredAuth, saveStoredAuth } from '../lib/api';
import './AdminPortal.css';

const THEME_KEY = 'mk-theme';
const emptyCourse = { title: '', description: '', imageUrl: '' };
const emptyUser = { fullName: '', username: '', email: '', password: '', role: 'user', profileImage: '' };

const AdminPortal = () => {
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || 'light');
  const [tab, setTab] = useState('learners');
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [userForm, setUserForm] = useState(emptyUser);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [courseLearners, setCourseLearners] = useState([]);
  const [learnerCourses, setLearnerCourses] = useState([]);
  const [selectedLearnersToEnroll, setSelectedLearnersToEnroll] = useState([]);
  const [videoForm, setVideoForm] = useState({ title: '', videoUrl: '' });
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
  const filteredUsers = useMemo(
    () => users.filter((item) => `${item.username} ${item.fullName} ${item.email || ''}`.toLowerCase().includes(search.toLowerCase())),
    [users, search]
  );

  const loadDashboard = async () => {
    const data = await apiRequest('/admin/dashboard');
    setCourses(data.courses || []);
    setUsers(data.users || []);
  };

  useEffect(() => {
    loadDashboard().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const openCourse = async (course) => {
    setSelectedCourse(course);
    setSelectedUser(null);
    setCourseForm({ title: course.title, description: course.description || '', imageUrl: course.imageUrl || '' });
    const data = await apiRequest(`/admin/courses/${course.id}/learners`);
    setCourseLearners(data.learners || []);
    setVideoForm({ title: '', videoUrl: '' });
  };

  const openUser = async (user) => {
    setSelectedUser(user);
    setSelectedCourse(null);
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
      setCourseForm(emptyCourse);
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
      await apiRequest(`/admin/courses/${selectedCourse.id}/videos`, { method: 'POST', body: JSON.stringify(videoForm) });
      setVideoForm({ title: '', videoUrl: '' });
      await loadDashboard();
      const refreshed = await apiRequest('/admin/dashboard');
      const latest = (refreshed.courses || []).find((item) => item.id === selectedCourse.id);
      if (latest) setSelectedCourse(latest);
      setStatus('Video added.');
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

  return (
    <div className={`portal-shell theme-${theme}`}>
      <div className="console-layout">
        <aside className="left-nav">
          <h2>Admin Console</h2>
          <button type="button" className={tab === 'learners' ? 'nav-active' : ''} onClick={() => { setTab('learners'); setSearch(''); setSelectedUser(null); }}>Learner Management</button>
          <button type="button" className={tab === 'courses' ? 'nav-active' : ''} onClick={() => { setTab('courses'); setSearch(''); setSelectedCourse(null); }}>Course Management</button>
          <button type="button" className={tab === 'settings' ? 'nav-active' : ''} onClick={() => setTab('settings')}>Settings</button>
          <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>Theme: {theme}</button>
          <button type="button" className="secondary-button" onClick={() => { clearStoredAuth(); navigate('/'); }}>Logout</button>
        </aside>
        <main>
          {status ? <div className="status-banner success-banner">{status}</div> : null}
          {error ? <div className="status-banner error-banner">{error}</div> : null}

          {tab === 'courses' ? (
            <>
              {!selectedCourse ? (
                <section className="portal-card">
                  <h2>Course Management</h2>
                  <form className="stack-form" onSubmit={handleCreateCourse}>
                    <input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} placeholder="Course title" required />
                    <textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} placeholder="Description" />
                    <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setCourseForm({ ...courseForm, imageUrl: await fileToDataUrl(file) }); }} required />
                    <button type="submit">Create Course</button>
                  </form>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search courses..." />
                  <table className="data-table">
                    <thead><tr><th>Title</th><th>Description</th><th>Videos</th></tr></thead>
                    <tbody>
                      {filteredCourses.map((item) => (
                        <tr key={item.id} onClick={() => openCourse(item)}>
                          <td>{item.title}</td><td>{item.description}</td><td>{item.videos?.length || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ) : (
                <section className="portal-card">
                  <div className="section-title-row">
                    <h2>{selectedCourse.title}</h2>
                    <button type="button" onClick={() => setSelectedCourse(null)}>Back</button>
                  </div>
                  <form className="stack-form" onSubmit={(e) => e.preventDefault()}>
                    <input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} required />
                    <textarea value={courseForm.description} onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })} />
                    <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setCourseForm({ ...courseForm, imageUrl: await fileToDataUrl(file) }); }} />
                    <button type="button" onClick={handleUpdateCourse}>Update Course</button>
                  </form>
                  <h3>Course Videos</h3>
                  <div className="video-list">{(selectedCourse.videos || []).map((v) => <div key={v.id} className="video-link">{v.title}</div>)}</div>
                  <div className="inline-form">
                    <input value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} placeholder="Video title" />
                    <input value={videoForm.videoUrl} onChange={(e) => setVideoForm({ ...videoForm, videoUrl: e.target.value })} placeholder="Video URL" />
                    <button type="button" onClick={handleAddVideo}>Add Video</button>
                  </div>
                  <h3>Enroll Learners</h3>
                  <div className="checkbox-grid">
                    {learners.map((learner) => (
                      <label key={learner.id} className="checkbox-item">
                        <input type="checkbox" checked={selectedLearnersToEnroll.includes(learner.id)} onChange={() => setSelectedLearnersToEnroll((prev) => prev.includes(learner.id) ? prev.filter((id) => id !== learner.id) : [...prev, learner.id])} />
                        <span>{learner.fullName}</span>
                      </label>
                    ))}
                  </div>
                  <button type="button" onClick={handleAddLearnersToCourse}>Add Learners</button>
                  <table className="data-table"><thead><tr><th>Enrolled Learners</th><th>Email</th></tr></thead><tbody>{courseLearners.map((l) => <tr key={l.id}><td>{l.fullName}</td><td>{l.email}</td></tr>)}</tbody></table>
                </section>
              )}
            </>
          ) : null}

          {tab === 'learners' ? (
            <>
              {!selectedUser ? (
                <section className="portal-card">
                  <h2>Learner/Admin Management</h2>
                  <form className="stack-form" onSubmit={handleCreateUser}>
                    <input value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} placeholder="Full name" required />
                    <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} placeholder="Username" required />
                    <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} placeholder="Email" required />
                    <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Password" required />
                    <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}><option value="user">Learner</option><option value="admin">Admin</option></select>
                    <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setUserForm({ ...userForm, profileImage: await fileToDataUrl(file) }); }} required={userForm.role === 'user'} />
                    <button type="submit">Create User</button>
                  </form>
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search learners/admins..." />
                  <table className="data-table"><thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th></tr></thead><tbody>{filteredUsers.map((item) => <tr key={item.id} onClick={() => openUser(item)}><td>{item.fullName}</td><td>{item.username}</td><td>{item.email}</td><td>{item.role}</td></tr>)}</tbody></table>
                </section>
              ) : (
                <section className="portal-card">
                  <div className="section-title-row"><h2>{selectedUser.fullName}</h2><button type="button" onClick={() => setSelectedUser(null)}>Back</button></div>
                  <form className="stack-form" onSubmit={(e) => e.preventDefault()}>
                    <input value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} />
                    <input value={userForm.username} onChange={(e) => setUserForm({ ...userForm, username: e.target.value })} />
                    <input type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} />
                    <input type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} placeholder="Optional new password" />
                    <select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}><option value="user">Learner</option><option value="admin">Admin</option></select>
                    <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setUserForm({ ...userForm, profileImage: await fileToDataUrl(file) }); }} />
                    <button type="button" onClick={handleUpdateUser}>Update User</button>
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
                <input value={profileForm.fullName} onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })} placeholder="Full name" />
                <input value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} placeholder="Username" />
                <input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setProfileForm({ ...profileForm, profileImage: await fileToDataUrl(file) }); }} />
                <input type="password" value={profileForm.currentPassword} onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })} placeholder="Current password" />
                <input type="password" value={profileForm.newPassword} onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })} placeholder="New password" />
                <button type="button" onClick={handleSettingsSave}>Save Settings</button>
              </form>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default AdminPortal;

