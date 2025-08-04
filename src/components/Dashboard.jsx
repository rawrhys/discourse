import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import ChatInterface from './ChatInterface';
import { useApiWrapper } from '../services/api';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gaapqvkjblqvpokmhlmh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhYXBxdmtqYmxxdnBva21obG1oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQzMDg5NzksImV4cCI6MjA2OTg4NDk3OX0.aAtqS5H0JhNHgatPEjJ8iJRFnZumyaRYxlSA9dkkfQE';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4002';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [savedCourses, setSavedCourses] = useState([]);
  const [showNewCourseForm, setShowNewCourseForm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [courseToDelete, setCourseToDelete] = useState(null);
  const api = useApiWrapper();
  const [isBuying, setIsBuying] = useState(false);
  const [credits, setCredits] = useState(user?.courseCredits || 0);

  // Get the user's name from Supabase metadata
  const userName = user?.user_metadata?.name || user?.email || 'Guest';

  // Early return if user is not ready
  if (!user) {
    return <div className="text-center mt-10 text-gray-500">Loading user...</div>;
  }

  const fetchSavedCourses = useCallback(async () => {
    try {
      const courses = await api.getSavedCourses();
      setSavedCourses(Array.isArray(courses) ? courses : []);
      setError(null);
    } catch (error) {
      setError(error.message || 'Failed to fetch courses');
      setSavedCourses([]);
    }
  }, [api]);

  const handleGenerateCourse = useCallback(async (courseParams) => {
    setIsGenerating(true);
    setError(null);
    try {
      const { prompt, ...rest } = courseParams;
      const newCourse = await api.generateCourse(prompt, ...Object.values(rest));
      await fetchSavedCourses();
      setShowNewCourseForm(false);
      navigate(`/course/${newCourse.id}`);
    } catch (error) {
      setError(error.message || 'Failed to generate course');
    } finally {
      setIsGenerating(false);
    }
  }, [api, navigate, fetchSavedCourses]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleDeleteCourse = useCallback(async (courseId) => {
    try {
      await api.deleteCourse(courseId);
      await fetchSavedCourses();
      setCourseToDelete(null);
    } catch (error) {
      setError(error.message || 'Failed to delete course');
    }
  }, [api, fetchSavedCourses]);

  useEffect(() => {
    // Only fetch courses if the user is properly authenticated.
    // With Supabase, we just need to check if user exists
    if (user) {
      fetchSavedCourses();
      // If returning from Stripe payment, refresh user info
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('payment') === 'success') {
        api.getCurrentUser().then((freshUser) => {
          setCredits(freshUser.courseCredits || 0);
          // Update localStorage for user
          const updatedUser = { ...user, courseCredits: freshUser.courseCredits };
          localStorage.setItem('user', JSON.stringify(updatedUser));
        });
      }
    }
    // Removed the else clause that was causing infinite redirects
  }, [user, fetchSavedCourses, api]);

  useEffect(() => {
    // Keep credits in sync with user object
    setCredits(user?.courseCredits || 0);
  }, [user]);

  // Helper to refresh user credits after payment
  const refreshUser = async () => {
    // Re-fetch user info from backend (if you have such endpoint)
    // For now, reload from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setCredits(JSON.parse(storedUser).courseCredits || 0);
    }
  };

  const handleBuyMore = async () => {
    setIsBuying(true);
    try {
      // Direct Stripe Checkout (you'll need to set up a Stripe account)
      const stripe = window.Stripe('your_publishable_key');
      const { error } = await stripe.redirectToCheckout({
        lineItems: [{
          price: 'price_your_price_id', // Your Stripe price ID
          quantity: 1,
        }],
        mode: 'payment',
        successUrl: window.location.origin + '/dashboard?payment=success',
        cancelUrl: window.location.origin + '/dashboard?payment=cancel',
      });
      
      if (error) {
        alert('Error starting checkout: ' + error.message);
      }
    } catch (err) {
      alert('Error starting checkout: ' + err.message);
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">Course Dashboard</h1>
            </div>
            <div className="flex items-center">
              <span className="mr-4">Welcome, {userName}!</span>
              <button
                onClick={handleLogout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Credits and Buy More */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-lg font-semibold text-gray-700">
            Credits: <span className={credits === 0 ? 'text-red-500' : 'text-green-600'}>{credits}</span>
          </div>
          <button
            onClick={handleBuyMore}
            disabled={isBuying}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isBuying ? 'Redirecting...' : 'Buy More'}
          </button>
        </div>
        {credits === 0 && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
            You have no course credits left. Please buy more to generate new courses.
          </div>
        )}
        {!showNewCourseForm ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Your Courses</h2>
              <button
                onClick={() => setShowNewCourseForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={credits === 0}
              >
                Generate New Course
              </button>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}

            {savedCourses.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="mt-2 text-sm font-medium text-gray-900">No courses yet</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by generating a new course.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {savedCourses.map((course) => {
                  // Ensure course has a unique ID, fallback to a generated one if needed for React key only.
                  const courseId = course.id || `course_${Date.now()}_${Math.random()}`;
                  const canPublish = !!course.id && !course.published;
                  return (
                    <div
                      key={courseId}
                      className="bg-white overflow-hidden shadow rounded-lg relative group"
                    >
                      <div className="px-4 py-5 sm:p-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="text-lg font-medium text-gray-900">{course.title}</h3>
                            <p className="mt-1 text-sm text-gray-500">{course.description}</p>
                          </div>
                          <button
                            onClick={() => setCourseToDelete(course)}
                            className="ml-4 text-gray-400 hover:text-red-500 transition-colors duration-200"
                            title="Delete course"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => {
                              localStorage.setItem('currentCourseId', course.id);
                              navigate(`/course/${course.id}`);
                            }}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                          >
                            Continue Learning →
                          </button>
                          <button
                            onClick={async () => {
                              if (!course.id) {
                                alert('This course cannot be published because it has no ID.');
                                return;
                              }
                              console.log('Attempting to publish course:', course.id, course);
                              try {
                                const updated = await api.publishCourse(course.id);
                                await fetchSavedCourses();
                                alert('Course published!');
                              } catch (err) {
                                alert('Failed to publish course: ' + (err.message || 'Unknown error'));
                              }
                            }}
                            disabled={!canPublish}
                            className={`text-sm font-medium rounded px-3 py-1 ml-2 ${course.published ? 'bg-green-200 text-green-700 cursor-not-allowed' : !course.id ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                            title={course.published ? 'Already published' : !course.id ? 'Cannot publish: missing course ID' : 'Publish this course to share publicly'}
                          >
                            {course.published ? 'Published' : 'Publish'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white shadow sm:rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Generate New Course
              </h3>
              <div className="mt-4">
                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                  </div>
                )}
                <ChatInterface
                  onGenerateCourse={handleGenerateCourse}
                  onCancel={() => setShowNewCourseForm(false)}
                  isGenerating={isGenerating}
                />
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {courseToDelete && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Course</h3>
              <p className="text-sm text-gray-500 mb-4">
                Are you sure you want to delete "{courseToDelete.title}"? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setCourseToDelete(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteCourse(courseToDelete.id)}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;