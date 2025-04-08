import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App.tsx' // Restore App import
import './index.css'
import HomePage from './pages/HomePage.tsx'; // Restore page imports
import RecipeDetailPage from './pages/RecipeDetailPage.tsx';
import AddRecipePage from './pages/AddRecipePage.tsx';
// import ApiTestPage from './pages/ApiTestPage.tsx'; // Remove test page import

// Restore original router
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: '/recipe/:recipeId',
        element: <RecipeDetailPage />,
      },
      {
        path: '/add-recipe',
        element: <AddRecipePage />,
      },
    ],
  },
]);

/* // Simplified router commented out or removed
const router = createBrowserRouter([
  {
    path: '/',
    element: <ApiTestPage />,
  },
]);
*/

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
