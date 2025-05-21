import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App.tsx' // Restore App import
import './index.css'
import HomePage from './pages/HomePage.tsx'; // Restore page imports
import RecipeDetailPage from './pages/RecipeDetailPage.tsx';
import AddRecipePage from './pages/AddRecipePage.tsx';
import MealPlanPage from './pages/MealPlanPage.tsx'; // Add MealPlanPage import
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
      {
        path: '/meal-plan',
        element: <MealPlanPage />,
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}
