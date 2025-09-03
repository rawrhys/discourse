import React from 'react';
import HelpMenu from './HelpMenu';

const HelpSection = () => {
  return (
    <div className="help-section">
      <div className="help-section-header">
        <h3>📚 Quick Help Guide</h3>
        <p>Need help getting started? Check out these guides below.</p>
      </div>

      <HelpMenu title="How to Generate Your First Course" defaultOpen={true}>
        <div className="help-content">
          <p>Creating a custom course with Discourse AI is simple:</p>
          <ol>
            <li><strong>Click "Generate New Course"</strong> - Located at the top of your dashboard</li>
            <li><strong>Describe what you want to learn</strong> - Be specific about your interests and goals</li>
            <li><strong>Choose your preferences</strong> - Select difficulty level and course structure</li>
            <li><strong>Wait for generation</strong> - Our AI will create your course in 2-5 minutes</li>
            <li><strong>Start learning!</strong> - Your course will appear on your dashboard</li>
          </ol>
          
          <div className="help-tips">
            <h4>💡 Tips for Better Results:</h4>
            <ul>
              <li>Be specific about your interests and goals</li>
              <li>Mention any prerequisites or background knowledge</li>
              <li>Include examples of what you want to learn</li>
              <li>Specify if you prefer practical or theoretical content</li>
            </ul>
          </div>
        </div>
      </HelpMenu>

      <HelpMenu title="Course Generation Examples">
        <div className="help-content">
          <p>Here are some example prompts to get you started:</p>
          
          <div className="example-prompts">
            <div className="example-category">
              <h4>📚 Academic Subjects</h4>
              <ul>
                <li>"Create a course about the history of ancient Rome from 753 BCE to 476 CE"</li>
                <li>"Teach me about machine learning basics for beginners"</li>
                <li>"Generate a course on organic chemistry fundamentals"</li>
              </ul>
            </div>
            
            <div className="example-category">
              <h4>🎨 Creative Skills</h4>
              <ul>
                <li>"I want to learn how to write science fiction stories"</li>
                <li>"Create a course on digital photography techniques"</li>
                <li>"Teach me about graphic design principles"</li>
              </ul>
            </div>
            
            <div className="example-category">
              <h4>💼 Professional Development</h4>
              <ul>
                <li>"Generate a course on project management fundamentals"</li>
                <li>"Teach me about effective leadership strategies"</li>
                <li>"Create a course on public speaking skills"</li>
              </ul>
            </div>
          </div>
        </div>
      </HelpMenu>

      <HelpMenu title="Navigating Your Courses">
        <div className="help-content">
          <p>Once you have courses, here's how to make the most of them:</p>
          
          <div className="navigation-tips">
            <div className="tip-item">
              <h4>📖 Reading Lessons</h4>
              <p>Click on any lesson to start reading. Use the navigation arrows to move between lessons.</p>
            </div>
            
            <div className="tip-item">
              <h4>🧠 Taking Quizzes</h4>
              <p>Complete quizzes at the end of each lesson to test your knowledge and reinforce learning.</p>
            </div>
            
            <div className="tip-item">
              <h4>📊 Tracking Progress</h4>
              <p>Your progress is automatically saved. Return to any course anytime to continue where you left off.</p>
            </div>
            
            <div className="tip-item">
              <h4>🔄 Course Management</h4>
              <p>Use the course actions menu to edit, duplicate, or delete courses as needed.</p>
            </div>
          </div>
        </div>
      </HelpMenu>

      <HelpMenu title="Advanced Features">
        <div className="help-content">
          <p>Explore these advanced features to enhance your learning experience:</p>
          
          <div className="advanced-features">
            <div className="feature-item">
              <h4>📤 Publishing Courses</h4>
              <p>Make your courses public so others can learn from them. Great for sharing knowledge!</p>
            </div>
            
            <div className="feature-item">
              <h4>📊 Student Analytics</h4>
              <p>For published courses, track student progress and engagement with detailed analytics.</p>
            </div>
            
            <div className="feature-item">
              <h4>🏆 Certificates</h4>
              <p>Students can earn certificates upon completing your published courses.</p>
            </div>
            
            <div className="feature-item">
              <h4>🔄 Course Duplication</h4>
              <p>Duplicate existing courses to create variations or build upon successful content.</p>
            </div>
          </div>
        </div>
      </HelpMenu>

      <style jsx>{`
        .help-section {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 24px;
        }

        .help-section-header {
          text-align: center;
          margin-bottom: 24px;
        }

        .help-section-header h3 {
          margin: 0 0 8px 0;
          color: #1e293b;
          font-size: 24px;
        }

        .help-section-header p {
          margin: 0;
          color: #64748b;
          font-size: 16px;
        }

        .help-content {
          color: #374151;
          line-height: 1.6;
        }

        .help-content ol, .help-content ul {
          margin: 16px 0;
          padding-left: 24px;
        }

        .help-content li {
          margin-bottom: 8px;
        }

        .help-tips {
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 8px;
          padding: 16px;
          margin-top: 16px;
        }

        .help-tips h4 {
          margin: 0 0 12px 0;
          color: #92400e;
        }

        .help-tips ul {
          margin: 0;
        }

        .example-prompts {
          display: grid;
          gap: 20px;
          margin-top: 16px;
        }

        .example-category {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
        }

        .example-category h4 {
          margin: 0 0 12px 0;
          color: #374151;
          font-size: 16px;
        }

        .example-category ul {
          margin: 0;
        }

        .example-category li {
          font-size: 14px;
          color: #6b7280;
          margin-bottom: 6px;
          font-style: italic;
        }

        .navigation-tips, .advanced-features {
          display: grid;
          gap: 16px;
          margin-top: 16px;
        }

        .tip-item, .feature-item {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
        }

        .tip-item h4, .feature-item h4 {
          margin: 0 0 8px 0;
          color: #374151;
          font-size: 16px;
        }

        .tip-item p, .feature-item p {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }
      `}</style>
    </div>
  );
};

export default HelpSection;


