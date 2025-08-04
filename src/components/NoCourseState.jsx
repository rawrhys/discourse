import React from 'react';
import PropTypes from 'prop-types';

const NoCourseState = ({ onCreateNewCourse }) => (
  <div className="text-center p-8">
    <h2 className="text-xl font-bold text-gray-800 mb-4">No Course Available</h2>
    <p className="text-gray-600 mb-4">Create a new course to get started.</p>
    <button
      onClick={onCreateNewCourse}
      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
    >
      Create New Course
    </button>
  </div>
);

NoCourseState.propTypes = {
  onCreateNewCourse: PropTypes.func.isRequired
};

export default NoCourseState; 