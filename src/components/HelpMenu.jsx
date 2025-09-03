import React, { useState } from 'react';

const HelpMenu = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="help-menu">
      <div 
        className="help-menu-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="help-menu-title">
          <span className="help-icon">💡</span>
          <span className="help-title">{title}</span>
        </div>
        <div className="help-menu-toggle">
          {isOpen ? '−' : '+'}
        </div>
      </div>
      
      {isOpen && (
        <div className="help-menu-content">
          {children}
        </div>
      )}

      <style jsx>{`
        .help-menu {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .help-menu-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .help-menu-header:hover {
          background-color: #f9fafb;
        }

        .help-menu-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .help-icon {
          font-size: 18px;
        }

        .help-title {
          font-weight: 600;
          color: #374151;
          font-size: 16px;
        }

        .help-menu-toggle {
          font-size: 20px;
          font-weight: bold;
          color: #6b7280;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .help-menu-toggle:hover {
          background-color: #e5e7eb;
        }

        .help-menu-content {
          padding: 0 20px 20px 20px;
          border-top: 1px solid #f3f4f6;
          background-color: #fafafa;
        }
      `}</style>
    </div>
  );
};

export default HelpMenu;


