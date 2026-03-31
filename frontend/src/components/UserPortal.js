import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, clearStoredAuth, getStoredAuth } from '../lib/api';
import './AdminPortal.css';

const UserPortal = () => {
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const data = await apiRequest('/user/courses');
        setCourses(data.courses || []);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    };

    loadCourses();
  }, []);

  const handleLogout = () => {
    clearStoredAuth();
    navigate('/');
  };

  return (
    <div className="portal-shell user-shell">
      <div className="portal-topbar">
        <div>
          <p className="portal-tag">Learner workspace</p>
          <h1 className="portal-heading">Welcome, {auth?.user?.fullName || auth?.user?.username || 'Learner'}</h1>
          <p className="portal-subtitle">Watch the course videos assigned to you by the admin.</p>
        </div>
        <button type="button" className="secondary-button" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {error ? <div className="status-banner error-banner">{error}</div> : null}
      {loading ? <div className="status-banner">Loading your courses...</div> : null}

      {!loading && !courses.length ? (
        <div className="empty-state">You are not registered for any course yet.</div>
      ) : null}

      <div className="course-list-grid">
        {courses.map((course) => (
          <section className="portal-card" key={course.id}>
            <h2>{course.title}</h2>
            <p>{course.description || 'No description available for this course yet.'}</p>

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
          </section>
        ))}
      </div>
    </div>
  );
};

export default UserPortal;
