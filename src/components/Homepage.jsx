import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import './Homepage.css';

const Homepage = () => {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll();
  
  // Animation triggers
  const heroRef = useRef(null);
  const differenceRef = useRef(null);
  const featuresRef = useRef(null);
  const howItWorksRef = useRef(null);
  const ctaRef = useRef(null);
  
  const heroInView = useInView(heroRef, { once: true, amount: 0.3 });
  const differenceInView = useInView(differenceRef, { once: true, amount: 0.2 });
  const featuresInView = useInView(featuresRef, { once: true, amount: 0.2 });
  const howItWorksInView = useInView(howItWorksRef, { once: true, amount: 0.2 });
  const ctaInView = useInView(ctaRef, { once: true, amount: 0.3 });

  // Parallax effects
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const logoY = useTransform(scrollYProgress, [0, 1], [0, -50]);

  const handleSignIn = () => {
    navigate('/login');
  };

  const differences = [
    {
      icon: "🎯",
      title: "Structured Learning Paths",
      description: "Unlike ChatGPT's conversational approach, we create complete, structured courses with clear learning objectives, progress tracking, and assessment tools.",
      comparison: "ChatGPT: Random conversations"
    },
    {
      icon: "📈",
      title: "Personalized Progress Tracking",
      description: "Our AI adapts to your learning pace and style, providing detailed analytics and personalized recommendations to optimize your learning journey.",
      comparison: "ChatGPT: No progress tracking"
    },
    {
      icon: "🎨",
      title: "Interactive Multimedia Content",
      description: "Experience rich, interactive lessons with images, quizzes, and multimedia elements designed specifically for effective learning retention.",
      comparison: "ChatGPT: Text-only responses"
    },
    {
      icon: "🏆",
      title: "Achievement & Certification System",
      description: "Earn certificates, badges, and achievements as you complete courses, providing tangible proof of your learning accomplishments.",
      comparison: "ChatGPT: No certification system"
    }
  ];

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
    <div className="homepage" ref={containerRef}>
      {/* Navigation */}
      <nav className="navbar">
        <motion.div 
          className="nav-logo"
          style={{ y: logoY }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <img src="/assets/images/discourse-logo.png" alt="Discourse" className="logo-icon-large" />
        </motion.div>
        
        <motion.button
          className="nav-signin-btn"
          onClick={handleSignIn}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Sign In
        </motion.button>
      </nav>

      {/* Hero Section */}
      <section className="hero-section" ref={heroRef}>
        <motion.div 
          className="hero-content"
          style={{ y: heroY }}
          initial={{ opacity: 0, y: 50 }}
          animate={heroInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <motion.h1 
            className="hero-title"
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            The Future of
            <span className="gradient-text"> Learning</span>
          </motion.h1>
          
          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            Experience AI-powered education that adapts to you. Generate personalized courses, 
            track your progress, and master new skills with our intelligent learning platform.
          </motion.p>
          
          <motion.div 
            className="hero-buttons"
            initial={{ opacity: 0, y: 30 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.6 }}
          >
            <motion.button
              className="cta-button primary"
              onClick={handleSignIn}
              whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)" }}
              whileTap={{ scale: 0.95 }}
            >
              Get Started
            </motion.button>
            <motion.button
              className="cta-button secondary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Learn More
            </motion.button>
          </motion.div>
        </motion.div>
        
        <motion.div 
          className="hero-visual"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={heroInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 1, delay: 0.4 }}
        >
          <div className="floating-cards">
            <motion.div 
              className="card card-1"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <div className="card-content">
                <div className="card-icon">📚</div>
                <div className="card-text">AI Courses</div>
              </div>
            </motion.div>
            
            <motion.div 
              className="card card-2"
              animate={{ y: [0, 10, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            >
              <div className="card-content">
                <div className="card-icon">🎯</div>
                <div className="card-text">Smart Quizzes</div>
              </div>
            </motion.div>
            
            <motion.div 
              className="card card-3"
              animate={{ y: [0, -15, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2 }}
            >
              <div className="card-content">
                <div className="card-icon">📊</div>
                <div className="card-text">Analytics</div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* Point of Difference Section */}
      <section className="difference-section" ref={differenceRef}>
        <motion.div 
          className="section-header"
          initial={{ opacity: 0, y: 30 }}
          animate={differenceInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="section-title">
            Why Choose Discourse Over <span className="gradient-text">ChatGPT?</span>
          </h2>
          <p className="section-subtitle">
            While ChatGPT excels at conversation, we specialize in structured, measurable learning experiences
          </p>
          <div className="difference-intro">
            <p className="difference-intro-text">
              The new "Why Choose Discourse Over ChatGPT?" section strategically positions your learning platform as the superior choice for structured education. This compelling comparison section directly addresses why users should choose your specialized learning platform over the popular but general-purpose ChatGPT. The section features four key differentiators that make the value proposition immediately obvious to visitors, transforming your homepage from a generic AI platform into a specialized educational solution that directly competes with and differentiates from the market leader.
            </p>
          </div>
        </motion.div>
        
        <div className="differences-grid">
          {differences.map((difference, index) => (
            <motion.div
              key={index}
              className="difference-card"
              initial={{ opacity: 0, y: 30 }}
              animate={differenceInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
            >
              <div className="difference-icon">{difference.icon}</div>
              <h3 className="difference-title">{difference.title}</h3>
              <p className="difference-description">{difference.description}</p>
              <div className="comparison-badge">
                <span className="comparison-label">vs</span>
                <span className="comparison-text">{difference.comparison}</span>
              </div>
            </motion.div>
          ))}
        </div>
        
        <motion.div 
          className="difference-cta"
          initial={{ opacity: 0, y: 30 }}
          animate={differenceInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.6 }}
        >
          <p className="difference-cta-text">
            Ready to experience the difference? Join thousands of learners who've made the switch.
          </p>
          <motion.button
            className="cta-button primary"
            onClick={handleSignIn}
            whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            Start Your Learning Journey
          </motion.button>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="features-section" ref={featuresRef}>
        <motion.div 
          className="section-header"
          initial={{ opacity: 0, y: 30 }}
          animate={featuresInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="section-title">Why Choose Discourse?</h2>
          <p className="section-subtitle">
            Discover the features that make learning more effective and enjoyable
          </p>
        </motion.div>
        
        <div className="features-grid">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="feature-card"
              initial={{ opacity: 0, y: 30 }}
              animate={featuresInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
            >
              <div className="feature-icon">{feature.icon}</div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section" ref={howItWorksRef}>
        <motion.div 
          className="section-header"
          initial={{ opacity: 0, y: 30 }}
          animate={howItWorksInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="section-title">How It Works</h2>
          <p className="section-subtitle">
            Get started in three simple steps
          </p>
        </motion.div>
        
        <div className="steps-container">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="step-item"
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              animate={howItWorksInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, delay: index * 0.2 }}
            >
              <div className="step-number">{step.number}</div>
              <div className="step-content">
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
              {index < steps.length - 1 && (
                <motion.div 
                  className="step-connector"
                  initial={{ scaleY: 0 }}
                  animate={howItWorksInView ? { scaleY: 1 } : {}}
                  transition={{ duration: 0.6, delay: index * 0.2 + 0.4 }}
                />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section" ref={ctaRef}>
        <motion.div 
          className="cta-content"
          initial={{ opacity: 0, y: 30 }}
          animate={ctaInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="cta-title">Ready to Transform Your Learning?</h2>
          <p className="cta-subtitle">
            Join thousands of learners who are already experiencing the future of education
          </p>
          <motion.button
            className="cta-button primary large"
            onClick={handleSignIn}
            whileHover={{ scale: 1.05, boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)" }}
            whileTap={{ scale: 0.95 }}
          >
            Start Learning Today
          </motion.button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-logo">
            <img src="/assets/images/discourse-logo.png" alt="Discourse" className="logo-icon-large" />
          </div>
          <p className="footer-text">
            © {new Date().getFullYear()} Discourse. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;
