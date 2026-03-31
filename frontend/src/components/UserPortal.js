import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, clearStoredAuth, fileToDataUrl, getStoredAuth, saveStoredAuth } from '../lib/api';
import './AdminPortal.css';

const getEmbedUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) return `https://www.youtube.com/embed/${id}`;
      }
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
  const [tab, setTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('mk-theme') || 'light');
  const [settingsForm, setSettingsForm] = useState({
    fullName: auth?.user?.fullName || '',
    username: auth?.user?.username || '',
    profileImage: auth?.user?.profileImage || '',
    currentPassword: '',
    newPassword: '',
  });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filteredCourses = courses.filter((course) =>
    `${course.title} ${course.description || ''}`.toLowerCase().includes(search.toLowerCase())
  );

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

  useEffect(() => {
    localStorage.setItem('mk-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!status && !error) return undefined;
    const timer = setTimeout(() => {
      setStatus('');
      setError('');
    }, 3000);
    return () => clearTimeout(timer);
  }, [status, error]);

  const handleLogout = () => {
    clearStoredAuth();
    navigate('/');
  };

  return (
    <div className={`portal-shell user-shell theme-${theme}`}>
      <div className="console-layout">
        <aside className="left-nav">
          <h2>Learner Console</h2>
          <button type="button" className={tab === 'courses' ? 'nav-active' : ''} onClick={() => setTab('courses')}>Courses</button>
          <button type="button" className={tab === 'settings' ? 'nav-active' : ''} onClick={() => setTab('settings')}>Settings</button>
          <button type="button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>Theme: {theme}</button>
          <button type="button" className="secondary-button" onClick={handleLogout}>Logout</button>
        </aside>
        <main>
          <div className="page-actions">
            {tab === 'courses' ? (
              <div className="search-wrap">
                <span>🔍</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search courses..." />
              </div>
            ) : <div />}
            <button type="button" className="icon-button" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>🌙</button>
          </div>
          <div className="portal-topbar">
            <div>
              <p className="portal-tag">Learner workspace</p>
              <h1 className="portal-heading">Welcome, {auth?.user?.fullName || auth?.user?.username || 'Learner'}</h1>
              <p className="portal-subtitle">Watch your assigned course videos.</p>
            </div>
          </div>

          {status ? <div className="status-banner success-banner">{status}</div> : null}
          {error ? <div className="status-banner error-banner">{error}</div> : null}
          {loading ? <div className="status-banner">Loading your courses...</div> : null}

          {tab === 'courses' ? (
            <>
              {!loading && !courses.length ? (
                <div className="empty-state">You are not registered for any course yet.</div>
              ) : null}

              {!selectedCourse ? (
                <div className="course-list-grid">
                  {filteredCourses.map((course) => (
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
                  <div className="course-video-layout">
                    <div className="course-video-nav">
                      {(selectedCourse.videos || []).map((video) => (
                        <button type="button" key={video.id} className="video-link" onClick={() => setSelectedVideo(video)}>
                          {video.title}
                        </button>
                      ))}
                    </div>
                    <div className="course-video-player">
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
                  </div>
                </section>
              )}
            </>
          ) : null}

          {tab === 'settings' ? (
            <section className="portal-card">
              <h2>User Settings</h2>
              <form className="stack-form" onSubmit={(event) => event.preventDefault()}>
                <input type="text" value={settingsForm.fullName} onChange={(event) => setSettingsForm({ ...settingsForm, fullName: event.target.value })} placeholder="Full name" />
                <input type="text" value={settingsForm.username} onChange={(event) => setSettingsForm({ ...settingsForm, username: event.target.value })} placeholder="Username" />
                <input type="email" value={auth?.user?.email || ''} disabled />
                <input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setSettingsForm({ ...settingsForm, profileImage: await fileToDataUrl(file) }); }} />
                <input type="password" value={settingsForm.currentPassword} onChange={(event) => setSettingsForm({ ...settingsForm, currentPassword: event.target.value })} placeholder="Current password" />
                <input type="password" value={settingsForm.newPassword} onChange={(event) => setSettingsForm({ ...settingsForm, newPassword: event.target.value })} placeholder="New password" />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setError('');
                      setStatus('');
                      const profile = await apiRequest('/auth/me', {
                        method: 'PUT',
                        body: JSON.stringify({
                          fullName: settingsForm.fullName,
                          username: settingsForm.username,
                          profileImage: settingsForm.profileImage,
                        }),
                      });
                      if (settingsForm.currentPassword && settingsForm.newPassword) {
                        await apiRequest('/auth/me/password', {
                          method: 'PUT',
                          body: JSON.stringify({
                            currentPassword: settingsForm.currentPassword,
                            newPassword: settingsForm.newPassword,
                          }),
                        });
                      }
                      saveStoredAuth({ ...auth, user: { ...auth.user, ...profile.user } });
                      setStatus('Settings updated.');
                      setSettingsForm((prev) => ({ ...prev, currentPassword: '', newPassword: '' }));
                    } catch (requestError) {
                      setError(requestError.message);
                    }
                  }}
                >
                  Save Settings
                </button>
              </form>
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
};

export default UserPortal;
