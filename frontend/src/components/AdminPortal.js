import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, clearStoredAuth, getStoredAuth } from '../lib/api';
import './AdminPortal.css';

const emptyCourseForm = { title: '', description: '' };
const emptyUserForm = { fullName: '', username: '', password: '', assignedCourseIds: [] };

const AdminPortal = () => {
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [courseForm, setCourseForm] = useState(emptyCourseForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [videoForms, setVideoForms] = useState({});
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

  const handleLogout = () => {
    clearStoredAuth();
    navigate('/');
  };

  const handleCourseSubmit = async (event) => {
    event.preventDefault();
    setBusyAction('course');
    setStatusMessage('');
    setError('');

    try {
      await apiRequest('/admin/courses', {
        method: 'POST',
        body: JSON.stringify(courseForm),
      });

      setCourseForm({ ...emptyCourseForm });
      setStatusMessage('Course created successfully.');
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
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      });

      setUserForm({ ...emptyUserForm });
      setStatusMessage('Learner created and registered successfully.');
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

  return (
    <div className="portal-shell">
      <div className="portal-topbar">
        <div>
          <p className="portal-tag">Admin workspace</p>
          <h1 className="portal-heading">Admin control center</h1>
          <p className="portal-subtitle">
            Welcome {auth?.user?.fullName || auth?.user?.username || 'Admin'}. Create courses,
            add video links, and register learners from one place.
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {statusMessage ? <div className="status-banner success-banner">{statusMessage}</div> : null}
      {error ? <div className="status-banner error-banner">{error}</div> : null}
      {loading ? <div className="status-banner">Loading dashboard...</div> : null}

      <div className="admin-layout">
        <section className="portal-card">
          <h2>Create course</h2>
          <form className="stack-form" onSubmit={handleCourseSubmit}>
            <input
              type="text"
              placeholder="Course title"
              value={courseForm.title}
              onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })}
              required
            />
            <textarea
              rows="4"
              placeholder="Course description"
              value={courseForm.description}
              onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })}
            />
            <button type="submit" disabled={busyAction === 'course'}>
              {busyAction === 'course' ? 'Saving...' : 'Create course'}
            </button>
          </form>
        </section>

        <section className="portal-card">
          <h2>Create learner</h2>
          <form className="stack-form" onSubmit={handleUserSubmit}>
            <input
              type="text"
              placeholder="Full name"
              value={userForm.fullName}
              onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })}
              required
            />
            <input
              type="text"
              placeholder="Username"
              value={userForm.username}
              onChange={(event) => setUserForm({ ...userForm, username: event.target.value })}
              required
            />
            <input
              type="password"
              placeholder="Temporary password"
              value={userForm.password}
              onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
              required
            />

            <div>
              <p className="field-label">Register learner to courses</p>
              <div className="checkbox-grid">
                {courses.length ? (
                  courses.map((course) => (
                    <label key={course.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={userForm.assignedCourseIds.includes(course.id)}
                        onChange={() => toggleCourseSelection(course.id)}
                      />
                      <span>{course.title}</span>
                    </label>
                  ))
                ) : (
                  <span className="muted-text">Create a course first to assign it.</span>
                )}
              </div>
            </div>

            <button type="submit" disabled={busyAction === 'user'}>
              {busyAction === 'user' ? 'Saving...' : 'Create learner'}
            </button>
          </form>
        </section>
      </div>

      <section className="portal-card">
        <div className="section-title-row">
          <h2>Courses and videos</h2>
          <span className="pill">{courses.length} total</span>
        </div>

        {courses.length === 0 ? (
          <div className="empty-state">No courses created yet.</div>
        ) : (
          <div className="course-list-grid">
            {courses.map((course) => (
              <article className="course-card-panel" key={course.id}>
                <h3>{course.title}</h3>
                <p>{course.description || 'No description provided yet.'}</p>

                <div className="video-list">
                  {course.videos?.length ? (
                    course.videos.map((video) => (
                      <a
                        key={video.id}
                        className="video-link"
                        href={video.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        ▶ {video.title}
                      </a>
                    ))
                  ) : (
                    <span className="muted-text">No videos added yet.</span>
                  )}
                </div>

                <form className="inline-form" onSubmit={(event) => handleVideoSubmit(event, course.id)}>
                  <input
                    type="text"
                    placeholder="Video title"
                    value={videoForms[course.id]?.title || ''}
                    onChange={(event) => handleVideoChange(course.id, 'title', event.target.value)}
                    required
                  />
                  <input
                    type="url"
                    placeholder="https://video-link"
                    value={videoForms[course.id]?.videoUrl || ''}
                    onChange={(event) => handleVideoChange(course.id, 'videoUrl', event.target.value)}
                    required
                  />
                  <button type="submit" disabled={busyAction === `video-${course.id}`}>
                    {busyAction === `video-${course.id}` ? 'Saving...' : 'Add video link'}
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="portal-card">
        <div className="section-title-row">
          <h2>Registered learners</h2>
          <span className="pill">{users.length} total</span>
        </div>

        {users.length === 0 ? (
          <div className="empty-state">No learners created yet.</div>
        ) : (
          <div className="user-grid">
            {users.map((user) => (
              <div className="user-summary" key={user.id}>
                <strong>{user.fullName}</strong>
                <span>@{user.username}</span>
                <p>
                  {user.courses?.length
                    ? user.courses.map((course) => course.title).join(', ')
                    : 'No courses assigned yet.'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminPortal;

