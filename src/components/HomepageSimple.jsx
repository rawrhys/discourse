import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Homepage.css';

const HomepageSimple = () => {
  const navigate = useNavigate();

  const handleSignIn = () => {
    navigate('/login');
  };

  const features = [
    {
      icon: "🎓",
      title: "AI-Powered Learning",
      description: "Personalized course generation with advanced AI that adapts to your learning style and pace."
    },
    {
      icon: "📚",
      title: "Interactive Content",
      description: "Engage with dynamic lessons, quizzes, and multimedia content that makes learning enjoyable."
    },
    {
      icon: "📊",
      title: "Progress Tracking",
      description: "Monitor your learning journey with detailed analytics and performance insights."
    },
    {
      icon: "🔒",
      title: "Secure & Private",
      description: "Your data is protected with enterprise-grade security and privacy controls."
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Sign Up & Choose",
      description: "Create your account and select from our vast library of courses or generate custom content."
    },
    {
      number: "02",
      title: "Learn & Interact",
      description: "Engage with AI-generated lessons, take quizzes, and track your progress in real-time."
    },
    {
      number: "03",
      title: "Master & Advance",
      description: "Complete courses, earn achievements, and unlock new learning paths as you grow."
    }
  ];

  return (
    <div className="homepage">
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-logo animate-fade-in-left">
          <img src="/assets/images/discourse-logo.png" alt="Discourse" className="logo-icon" />
          <span className="logo-text">Discourse</span>
        </div>
        
        <button
          className="nav-signin-btn animate-fade-in-right"
          onClick={handleSignIn}
        >
          Sign In
        </button>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content animate-fade-in-up">
          <h1 className="hero-title">
            The Future of
            <span className="gradient-text"> Learning</span>
          </h1>
          
          <p className="hero-subtitle">
            Experience AI-powered education that adapts to you. Generate personalized courses, 
            track your progress, and master new skills with our intelligent learning platform.
          </p>
          
          <div className="hero-buttons">
            <button
              className="cta-button primary"
              onClick={handleSignIn}
            >
              Get Started
            </button>
            <button className="cta-button secondary">
              Learn More
            </button>
          </div>
        </div>
        
        <div className="hero-visual animate-fade-in-up-delayed">
          <div className="floating-cards">
            <div className="card card-1 animate-float">
              <div className="card-content">
                <div className="card-icon">📚</div>
                <div className="card-text">AI Courses</div>
              </div>
            </div>
            
            <div className="card card-2 animate-float-delayed">
              <div className="card-content">
                <div className="card-icon">🎯</div>
                <div className="card-text">Smart Quizzes</div>
              </div>
            </div>
            
            <div className="card card-3 animate-float-delayed-2">
              <div className="card-content">
                <div className="card-icon">📊</div>
                <div className="card-text">Analytics</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-header animate-fade-in-up">
          <h2 className="section-title">Why Choose Discourse?</h2>
          <p className="section-subtitle">
            Discover the features that make learning more effective and enjoyable
          </p>
        </div>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <div
              key={index}
              className="feature-card animate-fade-in-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <div className="section-header animate-fade-in-up">
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            Get started in three simple steps
          </p>
        </div>
        
        <div className="steps-container">
          {steps.map((step, index) => (
            <div
              key={index}
              className="step-item animate-fade-in-up"
              style={{ animationDelay: `${index * 0.2}s` }}
            >
              <div className="step-number">{step.number}</div>
              <div className="step-content">
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <div className="step-connector animate-connector" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content animate-fade-in-up">
          <h2 className="cta-title">Ready to Transform Your Learning?</h2>
          <p className="cta-subtitle">
            Join thousands of learners who are already experiencing the future of education
          </p>
          <button
            className="cta-button primary large"
            onClick={handleSignIn}
          >
            Start Learning Today
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">
            <img src="/assets/images/discourse-logo.png" alt="Discourse" className="logo-icon" />
            <span className="logo-text">Discourse</span>
          </div>
          <p className="footer-text">
            © {new Date().getFullYear()} Discourse. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomepageSimple;
