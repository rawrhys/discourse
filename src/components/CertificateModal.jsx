import React, { useState } from 'react';
import certificateService from '../services/CertificateService';

const CertificateModal = ({ 
  isOpen, 
  onClose, 
  courseData, 
  studentData, 
  sessionId 
}) => {
  const [email, setEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleGenerateCertificate = async () => {
    setIsGenerating(true);
    setError('');

    try {
      // Generate certificate
      const certificate = certificateService.generateCertificate(
        sessionId, 
        courseData, 
        studentData
      );

      // Generate HTML
      const html = certificateService.generateCertificateHTML(certificate);

      // Create blob and download
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Certificate_${courseData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${studentData.username || 'Anonymous'}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsGenerating(false);
    } catch (error) {
      setError('Failed to generate certificate. Please try again.');
      setIsGenerating(false);
    }
  };

  const handleEmailCertificate = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsEmailing(true);
    setError('');

    try {
      // Generate certificate if not already generated
      let certificate = certificateService.getCertificate(sessionId);
      if (!certificate) {
        certificate = certificateService.generateCertificate(
          sessionId, 
          courseData, 
          studentData
        );
      }

      // Generate HTML
      const html = certificateService.generateCertificateHTML(certificate);

      // Send email (this would be implemented on the server)
      const response = await fetch('/api/certificates/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          email,
          courseTitle: courseData.title,
          studentName: studentData.username || 'Anonymous',
          certificateHtml: html
        })
      });

      if (response.ok) {
        certificateService.markCertificateEmailed(sessionId, email);
        setEmailSent(true);
      } else {
        throw new Error('Failed to send email');
      }

      setIsEmailing(false);
    } catch (error) {
      setError('Failed to send certificate email. Please try again.');
      setIsEmailing(false);
    }
  };

  return (
    <div className="certificate-modal-overlay">
      <div className="certificate-modal">
        <div className="certificate-modal-header">
          <h2>🎉 Congratulations!</h2>
          <p>You've successfully completed "{courseData.title}"</p>
        </div>

        <div className="certificate-modal-content">
          <div className="certificate-preview">
            <div className="certificate-preview-content">
              <div className="logo">D</div>
              <h3>Certificate of Completion</h3>
              <p>This is to certify that</p>
              <div className="student-name">{studentData.username || 'Anonymous'}</div>
              <p>has successfully completed the course</p>
              <div className="course-title">"{courseData.title}"</div>
              <p>Completed on {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div className="certificate-actions">
            <button
              onClick={handleGenerateCertificate}
              disabled={isGenerating}
              className="btn-download"
            >
              {isGenerating ? 'Generating...' : '📄 Download Certificate'}
            </button>

            <div className="email-section">
              <h4>Or receive it via email:</h4>
              <div className="email-input-group">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  disabled={isEmailing || emailSent}
                />
                <button
                  onClick={handleEmailCertificate}
                  disabled={isEmailing || emailSent || !email.trim()}
                  className="btn-email"
                >
                  {isEmailing ? 'Sending...' : emailSent ? '✅ Sent!' : '📧 Email Certificate'}
                </button>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {emailSent && (
              <div className="success-message">
                Certificate sent to {email}! Check your inbox.
              </div>
            )}
          </div>
        </div>

        <div className="certificate-modal-footer">
          <button onClick={onClose} className="btn-close">
            Close
          </button>
        </div>

        <style jsx>{`
          .certificate-modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .certificate-modal {
            background: white;
            border-radius: 16px;
            max-width: 600px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
          }

          .certificate-modal-header {
            text-align: center;
            padding: 30px 30px 20px;
            border-bottom: 1px solid #e5e7eb;
          }

          .certificate-modal-header h2 {
            color: #1f2937;
            margin: 0 0 10px 0;
            font-size: 28px;
          }

          .certificate-modal-header p {
            color: #6b7280;
            margin: 0;
            font-size: 16px;
          }

          .certificate-modal-content {
            padding: 30px;
          }

          .certificate-preview {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 30px;
            margin-bottom: 30px;
            text-align: center;
            color: white;
          }

          .certificate-preview-content .logo {
            width: 60px;
            height: 60px;
            background: white;
            border-radius: 50%;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: #667eea;
            font-weight: bold;
          }

          .certificate-preview-content h3 {
            margin: 0 0 15px 0;
            font-size: 24px;
          }

          .certificate-preview-content p {
            margin: 10px 0;
            font-size: 16px;
          }

          .certificate-preview-content .student-name {
            font-size: 28px;
            font-weight: bold;
            margin: 15px 0;
            text-decoration: underline;
          }

          .certificate-preview-content .course-title {
            font-size: 18px;
            font-style: italic;
            margin: 15px 0;
          }

          .certificate-actions {
            text-align: center;
          }

          .btn-download, .btn-email, .btn-close {
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
            margin: 5px;
          }

          .btn-download {
            background: #3b82f6;
            color: white;
            display: block;
            width: 100%;
            margin-bottom: 20px;
          }

          .btn-download:hover:not(:disabled) {
            background: #2563eb;
          }

          .btn-download:disabled {
            background: #9ca3af;
            cursor: not-allowed;
          }

          .email-section {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
          }

          .email-section h4 {
            margin: 0 0 15px 0;
            color: #374151;
            font-size: 18px;
          }

          .email-input-group {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
          }

          .email-input-group input {
            flex: 1;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            font-size: 16px;
          }

          .email-input-group input:focus {
            outline: none;
            border-color: #3b82f6;
          }

          .btn-email {
            background: #10b981;
            color: white;
            white-space: nowrap;
          }

          .btn-email:hover:not(:disabled) {
            background: #059669;
          }

          .btn-email:disabled {
            background: #9ca3af;
            cursor: not-allowed;
          }

          .error-message {
            color: #ef4444;
            font-size: 14px;
            margin-top: 10px;
          }

          .success-message {
            color: #10b981;
            font-size: 14px;
            margin-top: 10px;
            font-weight: 600;
          }

          .certificate-modal-footer {
            padding: 20px 30px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
          }

          .btn-close {
            background: #6b7280;
            color: white;
          }

          .btn-close:hover {
            background: #4b5563;
          }
        `}</style>
      </div>
    </div>
  );
};

export default CertificateModal;
