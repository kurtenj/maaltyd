import React, { useState, useEffect } from 'react';

function ApiTestPage() {
  const [apiData, setApiData] = useState<any>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    setApiError(null);
    fetch('/api/recipes')
      .then(response => {
        console.log('[ApiTestPage] Response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Try to parse as JSON first
        return response.json(); 
      })
      .then(data => {
        console.log('[ApiTestPage] Response data (JSON):', data);
        setApiData(data);
      })
      .catch(async (error) => {
        console.error('[ApiTestPage] Fetch error:', error);
        // If JSON parse fails, try to get text response
        let responseText = 'Could not read response body.';
        try {
          const response = await fetch('/api/recipes'); // Re-fetch to get body as text
          responseText = await response.text();
          console.log('[ApiTestPage] Response data (Text):', responseText);
        } catch (textError) {
          console.error('[ApiTestPage] Error fetching response as text:', textError);
        }
        setApiError(`Fetch failed: ${error.message}. Response Body: ${responseText}`);
        setApiData(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div>
      <h1>API Test Page</h1>
      {loading && <p>Loading...</p>}
      {apiError && (
        <div>
          <h2>Error:</h2>
          <pre style={{ color: 'red', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{apiError}</pre>
        </div>
      )}
      {apiData && (
        <div>
          <h2>Data:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {JSON.stringify(apiData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default ApiTestPage; 