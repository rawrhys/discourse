import React, { useState } from 'react';
import SimpleImageService from '../services/SimpleImageService';

const ImageTest = () => {
  const [testResult, setTestResult] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const testServerConnection = async () => {
    setLoading(true);
    try {
      const connected = await SimpleImageService.testServerConnection();
      setTestResult(connected ? '✅ Server connected!' : '❌ Server not accessible');
    } catch (error) {
      setTestResult(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const testImageSearch = async () => {
    setLoading(true);
    try {
      const result = await SimpleImageService.search('Ancient Rome', 'History of ancient Rome');
      setSearchResult(result);
      setTestResult('✅ Image search successful!');
    } catch (error) {
      setTestResult(`❌ Image search failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Image Service Test</h1>
      
      <div className="space-y-4">
        <div>
          <button 
            onClick={testServerConnection}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Test Server Connection
          </button>
        </div>
        
        <div>
          <button 
            onClick={testImageSearch}
            disabled={loading}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            Test Image Search
          </button>
        </div>
        
        <div className="p-4 bg-gray-100 rounded">
          <h3 className="font-semibold">Test Result:</h3>
          <p>{testResult || 'No test run yet'}</p>
        </div>
        
        {searchResult && (
          <div className="p-4 bg-gray-100 rounded">
            <h3 className="font-semibold">Search Result:</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(searchResult, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageTest; 