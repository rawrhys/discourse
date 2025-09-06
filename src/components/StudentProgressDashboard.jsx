import React, { useState, useEffect } from 'react';

const StudentProgressDashboard = ({ courseId, courseTitle }) => {
  const [students, setStudents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    loadStudentData();
  }, [courseId]);

  const loadStudentData = async () => {
    setLoading(true);
    
    try {
      // Try authenticated endpoint first
      let response = await fetch(`/api/courses/${courseId}/student-progress`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      // If authenticated endpoint fails, try public endpoint
      if (!response.ok && response.status === 401) {
        console.log('[StudentProgressDashboard] Authenticated endpoint failed, trying public endpoint');
        response = await fetch(`/api/courses/${courseId}/student-progress`);
      }
      
      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
        setStats(data.stats || null);
        console.log(`[StudentProgressDashboard] Loaded ${data.students?.length || 0} students for course ${courseId}`);
      } else {
        console.error('[StudentProgressDashboard] Failed to load student data:', response.status);
        setStudents([]);
        setStats(null);
      }
    } catch (error) {
      console.error('[StudentProgressDashboard] Error loading student data:', error);
      setStudents([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes) => {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getProgressPercentage = (completed, total) => {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  };

  const getCompletionStatus = (student) => {
    if (student.isCompleted) {
      return { status: 'completed', color: '#10b981', text: 'Completed' };
    } else if (student.completedLessons > 0) {
      return { status: 'in-progress', color: '#3b82f6', text: 'In Progress' };
    } else {
      return { status: 'not-started', color: '#6b7280', text: 'Not Started' };
    }
  };

  if (loading) {
    return (
      <div className="student-progress-dashboard">
        <div className="loading">Loading student progress...</div>
      </div>
    );
  }

  return (
    <div className="student-progress-dashboard">
      <div className="dashboard-header">
        <h2>Student Progress Dashboard</h2>
        <p>Course: {courseTitle}</p>
        <button onClick={loadStudentData} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-number">{stats.totalStudents}</div>
            <div className="stat-label">Total Students</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.completedStudents}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.completionRate}%</div>
            <div className="stat-label">Completion Rate</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.totalCorrectQuizzes}/{stats.totalQuizzes}</div>
            <div className="stat-label">Quiz Performance</div>
          </div>
        </div>
      )}

      <div className="students-section">
        <h3>Student List ({students.length} students)</h3>
        
        {students.length === 0 ? (
          <div className="no-students">
            <p>No students have started this course yet.</p>
          </div>
        ) : (
          <div className="students-table">
            <div className="table-header">
              <div className="col-username">Username</div>
              <div className="col-progress">Progress</div>
              <div className="col-status">Status</div>
              <div className="col-score">Quiz Score</div>
              <div className="col-activity">Last Activity</div>
              <div className="col-actions">Actions</div>
            </div>
            
            {students.map((student) => {
              const completionStatus = getCompletionStatus(student);
              const progressPercentage = getProgressPercentage(student.completedLessons, student.totalLessons);
              
              return (
                <div key={student.sessionId} className="table-row">
                  <div className="col-username">
                    <div className="username">{student.username}</div>
                    <div className="session-id">ID: {student.sessionId.slice(-8)}</div>
                  </div>
                  
                  <div className="col-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${progressPercentage}%` }}
                      ></div>
                    </div>
                    <div className="progress-text">
                      {student.completedLessons}/{student.totalLessons} lessons
                    </div>
                  </div>
                  
                  <div className="col-status">
                    <span 
                      className="status-badge" 
                      style={{ backgroundColor: completionStatus.color }}
                    >
                      {completionStatus.text}
                    </span>
                  </div>
                  
                  <div className="col-score">
                    {student.totalQuizzes > 0 ? `${student.correctQuizzes}/${student.totalQuizzes}` : 'N/A'}
                  </div>
                  
                  <div className="col-activity">
                    {formatDate(student.lastActivity)}
                  </div>
                  
                  <div className="col-actions">
                    <button 
                      onClick={() => setSelectedStudent(student)}
                      className="view-details-btn"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedStudent && (
        <div className="student-details-modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Student Details: {selectedStudent.username}</h3>
              <button onClick={() => setSelectedStudent(null)} className="close-btn">
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Username:</label>
                  <span>{selectedStudent.username}</span>
                </div>
                <div className="detail-item">
                  <label>Session ID:</label>
                  <span>{selectedStudent.sessionId}</span>
                </div>
                <div className="detail-item">
                  <label>Start Time:</label>
                  <span>{formatDate(selectedStudent.startTime)}</span>
                </div>
                <div className="detail-item">
                  <label>Last Activity:</label>
                  <span>{formatDate(selectedStudent.lastActivity)}</span>
                </div>
                <div className="detail-item">
                  <label>Progress:</label>
                  <span>{selectedStudent.completedLessons}/{selectedStudent.totalLessons} lessons</span>
                </div>
                <div className="detail-item">
                  <label>Modules Completed:</label>
                  <span>{selectedStudent.completedModules}/{selectedStudent.totalModules}</span>
                </div>
                <div className="detail-item">
                  <label>Average Quiz Score:</label>
                  <span>{selectedStudent.averageQuizScore}%</span>
                </div>
                <div className="detail-item">
                  <label>Course Completed:</label>
                  <span>{selectedStudent.isCompleted ? 'Yes' : 'No'}</span>
                </div>
                {selectedStudent.isCompleted && (
                  <div className="detail-item">
                    <label>Completion Time:</label>
                    <span>{formatDate(selectedStudent.completionTime)}</span>
                  </div>
                )}
                <div className="detail-item">
                  <label>Certificate Generated:</label>
                  <span>{selectedStudent.certificateGenerated ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .student-progress-dashboard {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e5e7eb;
        }

        .dashboard-header h2 {
          margin: 0;
          color: #1f2937;
        }

        .dashboard-header p {
          margin: 5px 0 0 0;
          color: #6b7280;
        }

        .refresh-btn {
          padding: 8px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }

        .refresh-btn:hover {
          background: #2563eb;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }

        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .stat-number {
          font-size: 32px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 5px;
        }

        .stat-label {
          color: #6b7280;
          font-size: 14px;
        }

        .students-section h3 {
          margin-bottom: 20px;
          color: #1f2937;
        }

        .no-students {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }

        .students-table {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .table-header {
          display: grid;
          grid-template-columns: 2fr 2fr 1fr 1fr 1.5fr 1fr;
          gap: 20px;
          padding: 15px 20px;
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }

        .table-row {
          display: grid;
          grid-template-columns: 2fr 2fr 1fr 1fr 1.5fr 1fr;
          gap: 20px;
          padding: 15px 20px;
          border-bottom: 1px solid #e5e7eb;
          align-items: center;
        }

        .table-row:hover {
          background: #f9fafb;
        }

        .username {
          font-weight: 600;
          color: #1f2937;
        }

        .session-id {
          font-size: 12px;
          color: #6b7280;
          font-family: monospace;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 5px;
        }

        .progress-fill {
          height: 100%;
          background: #3b82f6;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 12px;
          color: #6b7280;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          color: white;
          font-size: 12px;
          font-weight: 600;
        }

        .view-details-btn {
          padding: 6px 12px;
          background: #6b7280;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        }

        .view-details-btn:hover {
          background: #4b5563;
        }

        .student-details-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 8px;
          max-width: 600px;
          width: 100%;
          max-height: 80vh;
          overflow-y: auto;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h3 {
          margin: 0;
          color: #1f2937;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #6b7280;
        }

        .modal-body {
          padding: 20px;
        }

        .detail-grid {
          display: grid;
          gap: 15px;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .detail-item label {
          font-weight: 600;
          color: #374151;
        }

        .detail-item span {
          color: #6b7280;
          font-family: monospace;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #6b7280;
        }
      `}</style>
    </div>
  );
};

export default StudentProgressDashboard;
