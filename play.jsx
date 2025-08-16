warning: in the working copy of 'src/components/CourseDisplay.jsx', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/src/components/CourseDisplay.jsx b/src/components/CourseDisplay.jsx[m
[1mindex 888f74e..923f3f2 100644[m
[1m--- a/src/components/CourseDisplay.jsx[m
[1m+++ b/src/components/CourseDisplay.jsx[m
[36m@@ -411,7 +411,7 @@[m [mconst CourseDisplay = () => {[m
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>[m
           </button>[m
           <div className="text-center flex-1">[m
[31m-            {currentLesson && <h1 className="text-2xl font-bold text-gray-900 truncate">{currentLesson.title} 😊 TEST DEPLOYMENT</h1>}[m
[32m+[m[32m            {currentLesson && <h1 className="text-2xl font-bold text-gray-900 truncate">{currentLesson.title}</h1>}[m
           </div>[m
           <div className="flex-1 flex justify-end">[m
             <NewCourseButton />[m
