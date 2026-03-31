import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, clearStoredAuth, getStoredAuth } from '../lib/api';
import './AdminPortal.css';

const getEmbedUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      const videoId = parsed.searchParams.get('v');
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '');
      if (id) {
        return `https://www.youtube.com/embed/${id}`;
      }
    }
    return url;
  } catch {
    return url;
  }
};

const UserPortal = () => {
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
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

      {!selectedCourse ? (
        <div className="course-list-grid">
          {courses.map((course) => (
            <section className="portal-card" key={course.id}>
              {course.imageUrl ? <img src={course.imageUrl} alt={course.title} className="course-image" /> : null}
              <h2>{course.title}</h2>
              <p>{course.description || 'No description available for this course yet.'}</p>
              <p className="muted-text">{course.videos?.length || 0} videos</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCourse(course);
                  setSelectedVideo(course.videos?.[0] || null);
                }}
              >
                Open course
              </button>
            </section>
          ))}
        </div>
      ) : (
        <section className="portal-card">
          <div className="section-title-row">
            <h2>{selectedCourse.title}</h2>
            <button type="button" onClick={() => setSelectedCourse(null)}>Back to courses</button>
          </div>
          <p>{selectedCourse.description || 'No description available.'}</p>
          <div className="video-player-shell">
            {selectedVideo ? (
              <iframe
                title={selectedVideo.title}
                src={getEmbedUrl(selectedVideo.videoUrl)}
                className="video-frame"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <div className="empty-state">No videos available in this course.</div>
            )}
          </div>
          <div className="video-list">
            {(selectedCourse.videos || []).map((video) => (
              <button type="button" key={video.id} className="video-link" onClick={() => setSelectedVideo(video)}>
                ▶ {video.title}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default UserPortal;
