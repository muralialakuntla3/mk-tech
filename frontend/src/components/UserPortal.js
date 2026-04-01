import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest, clearStoredAuth, fileToDataUrl, getStoredAuth, saveStoredAuth } from '../lib/api';
import './AdminPortal.css';

const getEmbedUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('drive.google.com')) {
      const parts = parsed.pathname.split('/');
      const fileIdIndex = parts.findIndex((p) => p === 'd') + 1;
      const fileId = fileIdIndex > 0 ? parts[fileIdIndex] : '';
      if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
      }
    }
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
  const [tab, setTab] = useState(localStorage.getItem('mk-learner-tab') || 'courses');
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
  const [activeVideoId, setActiveVideoId] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const data = await apiRequest('/user/courses');
        const nextCourses = data.courses || [];
        setCourses(nextCourses);
        const savedCourseId = Number(localStorage.getItem('mk-learner-course-id'));
        if (savedCourseId) {
          const savedCourse = nextCourses.find((item) => item.id === savedCourseId);
          if (savedCourse) {
            setSelectedCourse(savedCourse);
            const firstModuleVideo = savedCourse.modules?.[0]?.videos?.[0];
            const firstVideo = firstModuleVideo || savedCourse.videos?.[0] || null;
            setSelectedVideo(firstVideo);
            setActiveVideoId(firstVideo?.id || null);
          }
        }
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
    localStorage.setItem('mk-learner-tab', tab);
  }, [tab]);
  useEffect(() => {
    if (selectedCourse?.id) {
      localStorage.setItem('mk-learner-course-id', String(selectedCourse.id));
    } else {
      localStorage.removeItem('mk-learner-course-id');
    }
  }, [selectedCourse]);

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
          <button type="button" className="secondary-button" onClick={handleLogout}>Logout</button>
        </aside>
        <main>
          <div className="top-profile">
            {auth?.user?.profileImage ? <img src={auth.user.profileImage} alt={auth.user.fullName || auth.user.username} className="top-avatar" /> : null}
            <span>{auth?.user?.fullName || auth?.user?.username || 'Learner'}</span>
          </div>
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
                          const firstModuleVideo = course.modules?.[0]?.videos?.[0];
                          const firstVideo = firstModuleVideo || course.videos?.[0] || null;
                          setSelectedVideo(firstVideo);
                          setActiveVideoId(firstVideo?.id || null);
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
                  {(selectedCourse.documents || []).length ? (
                    <div className="video-list">
                      <strong>Documents</strong>
                      {(selectedCourse.documents || []).map((doc) => (
                        <button key={doc.id} type="button" onClick={() => setPreviewDoc(doc)} className="video-link">
                          {doc.name}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <div className="course-video-layout">
                    <div className="course-video-nav">
                      {(selectedCourse.modules || []).map((moduleItem) => (
                        <div key={moduleItem.id} className="module-block">
                          <strong>{moduleItem.title}</strong>
                          {(moduleItem.videos || []).map((video) => (
                            <button type="button" key={video.id} className={`video-link ${activeVideoId === video.id ? 'video-active' : ''}`} onClick={() => { setSelectedVideo(video); setActiveVideoId(video.id); }}>
                              {video.title}
                            </button>
                          ))}
                        </div>
                      ))}
                      {(selectedCourse.videos || []).map((video) => (
                        <button type="button" key={video.id} className={`video-link ${activeVideoId === video.id ? 'video-active' : ''}`} onClick={() => { setSelectedVideo(video); setActiveVideoId(video.id); }}>
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

          {tab === 'settings' ? (
            <section className="portal-card">
              <h2>User Settings</h2>
              <form className="stack-form" onSubmit={(event) => event.preventDefault()}>
                <label>Full Name</label>
                <input type="text" value={settingsForm.fullName} onChange={(event) => setSettingsForm({ ...settingsForm, fullName: event.target.value })} placeholder="Full name" />
                <label>Username</label>
                <input type="text" value={settingsForm.username} onChange={(event) => setSettingsForm({ ...settingsForm, username: event.target.value })} placeholder="Username" />
                <label>Email</label>
                <input type="email" value={auth?.user?.email || ''} disabled />
                <label>Profile Image</label>
                <input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setSettingsForm({ ...settingsForm, profileImage: await fileToDataUrl(file) }); }} />
                <label>Current Password</label>
                <input type="password" value={settingsForm.currentPassword} onChange={(event) => setSettingsForm({ ...settingsForm, currentPassword: event.target.value })} placeholder="Current password" />
                <label>New Password</label>
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
