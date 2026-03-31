import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, clearStoredAuth, getStoredAuth } from '../lib/api';
import './AdminPortal.css';

const emptyCourseForm = { title: '', description: '', imageUrl: '' };
const emptyUserForm = { fullName: '', username: '', email: '', password: '', role: 'user', assignedCourseIds: [] };
const THEME_KEY = 'mk-theme';

const getThemeFromStorage = () => localStorage.getItem(THEME_KEY) || 'light';

const AdminPortal = () => {
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const [theme, setTheme] = useState(getThemeFromStorage);
  const [activeNav, setActiveNav] = useState('learners');
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState(null);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [videoForms, setVideoForms] = useState({});
  const [courseSearch, setCourseSearch] = useState('');
  const [learnerSearch, setLearnerSearch] = useState('');
  const [enrolledLearners, setEnrolledLearners] = useState([]);
  const [selectedLearnerCourses, setSelectedLearnerCourses] = useState([]);
  const [courseEnrollSelection, setCourseEnrollSelection] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');

  const loadDashboard = async () => {
    try {
      setError('');
      const data = await apiRequest('/admin/dashboard');
      setCourses(data.courses || []);
      setUsers(data.users || []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const handleLogout = () => {
    clearStoredAuth();
    navigate('/');
  };

  const learners = useMemo(
    () => users.filter((user) => user.role === 'user'),
    [users]
  );

  const filteredCourses = useMemo(
    () =>
      courses.filter(
        (course) =>
          `${course.title} ${course.description}`.toLowerCase().includes(courseSearch.toLowerCase())
      ),
    [courses, courseSearch]
  );

  const filteredLearners = useMemo(
    () =>
      learners.filter((learner) =>
        `${learner.fullName} ${learner.username} ${learner.email || ''}`
          .toLowerCase()
          .includes(learnerSearch.toLowerCase())
      ),
    [learners, learnerSearch]
  );

  const handleCourseSubmit = async (event) => {
    event.preventDefault();
    setBusyAction('course');
    setStatusMessage('');
    setError('');

    try {
      if (editingCourseId) {
        await apiRequest(`/admin/courses/${editingCourseId}`, {
          method: 'PUT',
          body: JSON.stringify(courseForm),
        });
      } else {
        await apiRequest('/admin/courses', {
          method: 'POST',
          body: JSON.stringify(courseForm),
        });
      }

      setCourseForm({ ...emptyCourseForm });
      setEditingCourseId(null);
      setStatusMessage(editingCourseId ? 'Course updated successfully.' : 'Course created successfully.');
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  };

  const handleUserSubmit = async (event) => {
    event.preventDefault();
    setBusyAction('user');
    setStatusMessage('');
    setError('');

    try {
      if (editingUserId) {
        await apiRequest(`/admin/users/${editingUserId}`, {
          method: 'PUT',
          body: JSON.stringify(userForm),
        });
      } else {
        await apiRequest('/admin/users', {
          method: 'POST',
          body: JSON.stringify(userForm),
        });
      }

      setUserForm({ ...emptyUserForm });
      setEditingUserId(null);
      setStatusMessage(
        editingUserId
          ? 'User updated successfully.'
          : userForm.role === 'admin'
            ? 'Admin created successfully.'
            : 'Learner created successfully.'
      );
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  };

  const handleCourseDelete = async (courseId) => {
    setBusyAction(`course-delete-${courseId}`);
    setError('');
    setStatusMessage('');
    try {
      await apiRequest(`/admin/courses/${courseId}`, { method: 'DELETE' });
      setStatusMessage('Course deleted successfully.');
      if (selectedCourseId === courseId) {
        setSelectedCourseId(null);
        setEnrolledLearners([]);
      }
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  };

  const handleLearnerDelete = async (learnerId) => {
    setBusyAction(`learner-delete-${learnerId}`);
    setError('');
    setStatusMessage('');
    try {
      await apiRequest(`/admin/users/${learnerId}`, { method: 'DELETE' });
      setStatusMessage('Learner deleted successfully.');
      if (selectedLearnerId === learnerId) {
        setSelectedLearnerId(null);
        setSelectedLearnerCourses([]);
      }
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  };

  const handleVideoChange = (courseId, field, value) => {
    setVideoForms((currentValue) => ({
      ...currentValue,
      [courseId]: {
        title: '',
        videoUrl: '',
        ...currentValue[courseId],
        [field]: value,
      },
    }));
  };

  const handleVideoSubmit = async (event, courseId) => {
    event.preventDefault();
    setBusyAction(`video-${courseId}`);
    setStatusMessage('');
    setError('');

    try {
      await apiRequest(`/admin/courses/${courseId}/videos`, {
        method: 'POST',
        body: JSON.stringify(videoForms[courseId] || { title: '', videoUrl: '' }),
      });

      setVideoForms((currentValue) => ({
        ...currentValue,
        [courseId]: { title: '', videoUrl: '' },
      }));
      setStatusMessage('Video link added successfully.');
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  };

  const toggleCourseSelection = (courseId) => {
    setUserForm((currentValue) => {
      const selectedIds = currentValue.assignedCourseIds.includes(courseId)
        ? currentValue.assignedCourseIds.filter((id) => id !== courseId)
        : [...currentValue.assignedCourseIds, courseId];

      return {
        ...currentValue,
        assignedCourseIds: selectedIds,
      };
    });
  };

  const loadCourseLearners = async (courseId) => {
    setSelectedCourseId(courseId);
    setSelectedLearnerId(null);
    setSelectedLearnerCourses([]);
    try {
      const data = await apiRequest(`/admin/courses/${courseId}/learners`);
      setEnrolledLearners(data.learners || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const loadLearnerCourses = async (learnerId) => {
    setSelectedLearnerId(learnerId);
    setSelectedCourseId(null);
    setEnrolledLearners([]);
    try {
      const data = await apiRequest(`/admin/learners/${learnerId}/courses`);
      setSelectedLearnerCourses(data.courses || []);
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const addLearnersToCourse = async () => {
    if (!selectedCourseId || !courseEnrollSelection.length) {
      return;
    }
    setBusyAction(`enroll-${selectedCourseId}`);
    setStatusMessage('');
    setError('');
    try {
      await apiRequest(`/admin/courses/${selectedCourseId}/learners`, {
        method: 'POST',
        body: JSON.stringify({ learnerIds: courseEnrollSelection }),
      });
      setStatusMessage('Learners added to course.');
      setCourseEnrollSelection([]);
      await loadCourseLearners(selectedCourseId);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  };

  const removeLearnerCourse = async (learnerId, courseId) => {
    setBusyAction(`remove-course-${learnerId}-${courseId}`);
    setStatusMessage('');
    setError('');
    try {
      await apiRequest(`/admin/learners/${learnerId}/courses/${courseId}`, { method: 'DELETE' });
      setStatusMessage('Course removed from learner.');
      await loadLearnerCourses(learnerId);
      await loadDashboard();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className={`portal-shell theme-${theme}`}>
      <div className="console-layout">
        <aside className="left-nav">
          <h2>Admin Console</h2>
          <button type="button" className={activeNav === 'learners' ? 'nav-active' : ''} onClick={() => setActiveNav('learners')}>Learner Management</button>
          <button type="button" className={activeNav === 'courses' ? 'nav-active' : ''} onClick={() => setActiveNav('courses')}>Course Management</button>
          <button type="button" className={activeNav === 'settings' ? 'nav-active' : ''} onClick={() => setActiveNav('settings')}>Settings</button>
          <button type="button" className="secondary-button" onClick={handleLogout}>Logout</button>
        </aside>

        <main>
          <div className="portal-topbar">
            <div>
              <p className="portal-tag">Admin workspace</p>
              <h1 className="portal-heading">Welcome {auth?.user?.fullName || auth?.user?.username || 'Admin'}</h1>
              <p className="portal-subtitle">Manage learners, admins, courses, videos, and enrollments.</p>
            </div>
          </div>

          {statusMessage ? <div className="status-banner success-banner">{statusMessage}</div> : null}
          {error ? <div className="status-banner error-banner">{error}</div> : null}
          {loading ? <div className="status-banner">Loading dashboard...</div> : null}

          {activeNav === 'settings' ? (
            <section className="portal-card">
              <h2>Application theme</h2>
              <div className="inline-form">
                <button type="button" onClick={() => setTheme('light')}>Light</button>
                <button type="button" onClick={() => setTheme('dark')}>Dark</button>
              </div>
            </section>
          ) : null}

          {activeNav === 'courses' ? (
            <>
              <div className="admin-layout">
                <section className="portal-card">
                  <h2>Create course</h2>
                  <form className="stack-form" onSubmit={handleCourseSubmit}>
                    <input type="text" placeholder="Course title" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} required />
                    <textarea rows="4" placeholder="Course description" value={courseForm.description} onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })} />
                    <input type="url" placeholder="Course image URL" value={courseForm.imageUrl} onChange={(event) => setCourseForm({ ...courseForm, imageUrl: event.target.value })} />
                    <button type="submit" disabled={busyAction === 'course'}>{busyAction === 'course' ? 'Saving...' : editingCourseId ? 'Update course' : 'Create course'}</button>
                  </form>
                </section>
                <section className="portal-card">
                  <h2>Search courses</h2>
                  <input type="text" placeholder="Search by title or description..." value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} />
                </section>
              </div>

              <section className="portal-card">
                <h2>Courses</h2>
                <div className="course-list-grid">
                  {filteredCourses.map((course) => (
                    <article className="course-card-panel" key={course.id}>
                      <h3>{course.title}</h3>
                      <p>{course.description || 'No description provided yet.'}</p>
                      <p className="muted-text">{course.videos?.length || 0} videos</p>
                      <div className="inline-form">
                        <button type="button" onClick={() => loadCourseLearners(course.id)}>Manage Enrollments</button>
                        <button type="button" onClick={() => { setEditingCourseId(course.id); setCourseForm({ title: course.title, description: course.description || '', imageUrl: course.imageUrl || '' }); }}>Edit</button>
                        <button type="button" onClick={() => handleCourseDelete(course.id)} disabled={busyAction === `course-delete-${course.id}`}>Delete</button>
                      </div>
                      <form className="inline-form" onSubmit={(event) => handleVideoSubmit(event, course.id)}>
                        <input type="text" placeholder="Video title" value={videoForms[course.id]?.title || ''} onChange={(event) => handleVideoChange(course.id, 'title', event.target.value)} required />
                        <input type="url" placeholder="https://video-link" value={videoForms[course.id]?.videoUrl || ''} onChange={(event) => handleVideoChange(course.id, 'videoUrl', event.target.value)} required />
                        <button type="submit" disabled={busyAction === `video-${course.id}`}>{busyAction === `video-${course.id}` ? 'Saving...' : 'Add video'}</button>
                      </form>
                    </article>
                  ))}
                </div>
              </section>

              {selectedCourseId ? (
                <section className="portal-card">
                  <h2>Enrolled learners</h2>
                  <div className="checkbox-grid">
                    {learners.map((learner) => (
                      <label key={learner.id} className="checkbox-item">
                        <input type="checkbox" checked={courseEnrollSelection.includes(learner.id)} onChange={() => setCourseEnrollSelection((ids) => ids.includes(learner.id) ? ids.filter((id) => id !== learner.id) : [...ids, learner.id])} />
                        <span>{learner.fullName} ({learner.email || learner.username})</span>
                      </label>
                    ))}
                  </div>
                  <button type="button" onClick={addLearnersToCourse} disabled={busyAction === `enroll-${selectedCourseId}`}>Add Selected Learners</button>
                  <div className="user-grid">
                    {enrolledLearners.map((learner) => (
                      <div className="user-summary" key={learner.id}>
                        <strong>{learner.fullName}</strong>
                        <span>{learner.email || learner.username}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}

          {activeNav === 'learners' ? (
            <>
              <div className="admin-layout">
                <section className="portal-card">
                  <h2>Create admin/learner</h2>
                  <form className="stack-form" onSubmit={handleUserSubmit}>
                    <input type="text" placeholder="Full name" value={userForm.fullName} onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })} required />
                    <input type="text" placeholder="Username" value={userForm.username} onChange={(event) => setUserForm({ ...userForm, username: event.target.value })} required />
                    <input type="email" placeholder="Email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required />
                    <input type="password" placeholder="Temporary password" value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} required={!editingUserId} />
                    <select value={userForm.role} onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}>
                      <option value="user">Learner</option>
                      <option value="admin">Admin</option>
                    </select>
                    <div>
                      <p className="field-label">Assign courses (for learner)</p>
                      <div className="checkbox-grid">
                        {courses.map((course) => (
                          <label key={course.id} className="checkbox-item">
                            <input type="checkbox" checked={userForm.assignedCourseIds.includes(course.id)} onChange={() => toggleCourseSelection(course.id)} />
                            <span>{course.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <button type="submit" disabled={busyAction === 'user'}>{busyAction === 'user' ? 'Saving...' : editingUserId ? 'Update user' : 'Create user'}</button>
                  </form>
                </section>
                <section className="portal-card">
                  <h2>Search learners</h2>
                  <input type="text" placeholder="Search by name, username or email..." value={learnerSearch} onChange={(event) => setLearnerSearch(event.target.value)} />
                </section>
              </div>
              <section className="portal-card">
                <h2>Learners</h2>
                <div className="user-grid">
                  {filteredLearners.map((learner) => (
                    <div className="user-summary" key={learner.id}>
                      <strong>{learner.fullName}</strong>
                      <span>{learner.email || learner.username}</span>
                      <div className="inline-form">
                        <button type="button" onClick={() => loadLearnerCourses(learner.id)}>Manage Courses</button>
                        <button type="button" onClick={() => { setEditingUserId(learner.id); setUserForm({ fullName: learner.fullName, username: learner.username, email: learner.email || '', password: '', role: 'user', assignedCourseIds: [] }); }}>Edit</button>
                        <button type="button" onClick={() => handleLearnerDelete(learner.id)} disabled={busyAction === `learner-delete-${learner.id}`}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              {selectedLearnerId ? (
                <section className="portal-card">
                  <h2>Remove enrolled courses</h2>
                  <div className="user-grid">
                    {selectedLearnerCourses.map((course) => (
                      <div className="user-summary" key={course.id}>
                        <strong>{course.title}</strong>
                        <button type="button" onClick={() => removeLearnerCourse(selectedLearnerId, course.id)} disabled={busyAction === `remove-course-${selectedLearnerId}-${course.id}`}>Remove</button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default AdminPortal;

