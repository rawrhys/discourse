/**
 * Certificate Generation Service
 * Generates PDF certificates for completed courses
 */

class CertificateService {
  constructor() {
    this.certificates = new Map(); // sessionId -> certificate data
  }

  /**
   * Generate certificate data
   */
  generateCertificate(sessionId, courseData, studentData) {
    const certificateId = `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const certificate = {
      id: certificateId,
      sessionId,
      courseTitle: courseData.title,
      courseDescription: courseData.description,
      studentName: studentData.username || 'Anonymous',
      completionDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      generatedAt: new Date(),
      emailSent: false,
      emailAddress: null
    };

    this.certificates.set(sessionId, certificate);
    return certificate;
  }

  /**
   * Generate PDF certificate HTML
   */
  generateCertificateHTML(certificate) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificate of Completion - ${certificate.courseTitle}</title>
    <style>
        @page {
            size: A4;
            margin: 0;
        }
        
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .certificate {
            background: white;
            width: 800px;
            height: 600px;
            padding: 60px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            position: relative;
            text-align: center;
        }
        
        .certificate::before {
            content: '';
            position: absolute;
            top: 20px;
            left: 20px;
            right: 20px;
            bottom: 20px;
            border: 3px solid #667eea;
            border-radius: 10px;
        }
        
        .logo {
            width: 80px;
            height: 80px;
            background: #667eea;
            border-radius: 50%;
            margin: 0 auto 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            color: white;
            font-weight: bold;
        }
        
        .title {
            font-size: 36px;
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        
        .subtitle {
            font-size: 18px;
            color: #4a5568;
            margin-bottom: 40px;
        }
        
        .award-text {
            font-size: 24px;
            color: #2d3748;
            margin-bottom: 30px;
            line-height: 1.4;
        }
        
        .student-name {
            font-size: 32px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 30px;
            text-decoration: underline;
            text-decoration-color: #667eea;
            text-decoration-thickness: 3px;
        }
        
        .course-title {
            font-size: 20px;
            color: #4a5568;
            margin-bottom: 40px;
            font-style: italic;
        }
        
        .completion-date {
            font-size: 16px;
            color: #718096;
            margin-bottom: 30px;
        }
        
        .footer {
            position: absolute;
            bottom: 30px;
            left: 60px;
            right: 60px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .signature {
            text-align: center;
        }
        
        .signature-line {
            border-top: 2px solid #2d3748;
            width: 200px;
            margin: 0 auto 10px;
        }
        
        .signature-text {
            font-size: 14px;
            color: #4a5568;
        }
        
        .certificate-id {
            font-size: 12px;
            color: #a0aec0;
            text-align: right;
        }
    </style>
</head>
<body>
    <div class="certificate">
        <div class="logo">D</div>
        
        <h1 class="title">Certificate of Completion</h1>
        
        <p class="subtitle">This is to certify that</p>
        
        <p class="award-text">has successfully completed the course</p>
        
        <div class="student-name">${certificate.studentName}</div>
        
        <div class="course-title">"${certificate.courseTitle}"</div>
        
        <p class="completion-date">Completed on ${certificate.completionDate}</p>
        
        <div class="footer">
            <div class="signature">
                <div class="signature-line"></div>
                <div class="signature-text">Discourse AI</div>
            </div>
            
            <div class="certificate-id">
                Certificate ID: ${certificate.id}
            </div>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * Get certificate data
   */
  getCertificate(sessionId) {
    return this.certificates.get(sessionId);
  }

  /**
   * Mark certificate as emailed
   */
  markCertificateEmailed(sessionId, emailAddress) {
    const certificate = this.certificates.get(sessionId);
    if (!certificate) return false;

    certificate.emailSent = true;
    certificate.emailAddress = emailAddress;
    certificate.emailSentAt = new Date();

    return true;
  }

  /**
   * Get all certificates (for admin purposes)
   */
  getAllCertificates() {
    return Array.from(this.certificates.values());
  }

  /**
   * Remove certificate (cleanup)
   */
  removeCertificate(sessionId) {
    return this.certificates.delete(sessionId);
  }
}

// Create singleton instance
const certificateService = new CertificateService();

export default certificateService;
