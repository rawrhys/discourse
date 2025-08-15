/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // Layout & Positioning
    'min-h-screen', 'flex', 'items-center', 'justify-center', 'relative', 'absolute', 'fixed',
    
    // Spacing & Sizing
    'max-w-md', 'w-full', 'space-y-8', 'space-y-6', 'space-y-4', 'mt-6', 'mt-8', 'mt-2', 'mb-4',
    'py-12', 'py-2', 'px-4', 'px-3', 'p-4', 'sm:px-6', 'lg:px-8',
    
    // Colors - Gray
    'bg-gray-50', 'bg-gray-100', 'text-gray-900', 'text-gray-600', 'text-gray-700', 'border-gray-300',
    'placeholder-gray-500',
    
    // Colors - Indigo  
    'text-indigo-600', 'bg-indigo-600', 'hover:text-indigo-500', 'hover:bg-indigo-700',
    'focus:ring-indigo-500', 'focus:border-indigo-500',
    
    // Colors - Green
    'bg-green-50', 'border-green-200', 'text-green-800', 'text-green-700', 'hover:text-green-900',
    'text-green-400',
    
    // Colors - Red
    'bg-red-50', 'text-red-700',
    
    // Typography
    'text-center', 'text-3xl', 'font-extrabold', 'font-medium', 'font-bold', 'text-sm', 'text-lg',
    
    // Borders & Rounded
    'border', 'border-transparent', 'rounded-md', 'rounded-t-md', 'rounded-b-md', 'shadow-sm',
    
    // Form Elements
    'appearance-none', 'block', 'focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2',
    'focus:z-10', 'sr-only',
    
    // Interactive States
    'hover:bg-indigo-700', 'disabled:opacity-50', 'disabled:cursor-not-allowed',
    
    // Flexbox & Grid
    'flex-shrink-0', 'ml-3',
    
    // Misc
    'group', 'transition-colors', 'cursor-pointer'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};