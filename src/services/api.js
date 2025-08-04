import useApi from '../hooks/useApi';

export const useApiWrapper = () => {
    const apiFetch = useApi();

    const getLesson = (moduleId, lessonId) => 
        apiFetch(`/api/lessons/${moduleId}/${lessonId}`);

    const getModule = (moduleId) => 
        apiFetch(`/api/modules/${moduleId}`);

    const getCourse = (courseId) => 
        apiFetch(`/api/courses/id/${courseId}`);

    const saveCourse = (course) => 
        apiFetch('/api/courses', {
            method: 'POST',
            body: JSON.stringify(course),
        });

    const getQuizScoresForModule = (moduleId) => 
        apiFetch(`/api/modules/${moduleId}/quiz-scores`);
    
    const generateCourse = (topic, difficulty, numModules, numLessonsPerModule) =>
        apiFetch('/api/courses/generate', {
            method: 'POST',
            body: JSON.stringify({ topic, difficulty, numModules, numLessonsPerModule }),
        });
    
    const getSavedCourses = () =>
        apiFetch('/api/courses/saved');
        
    const deleteCourse = (courseId) =>
        apiFetch(`/api/courses/${courseId}`, { method: 'DELETE' });

    const publishCourse = (courseId) =>
        apiFetch(`/api/courses/${courseId}/publish`, { method: 'POST' });

    const getCurrentUser = () =>
        apiFetch('/api/auth/me');

    return {
        getLesson,
        getModule,
        getCourse,
        saveCourse,
        getQuizScoresForModule,
        generateCourse,
        getSavedCourses,
        deleteCourse,
        publishCourse,
        getCurrentUser,
    };
}; 