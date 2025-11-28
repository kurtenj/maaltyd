import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary';
import './index.css'
import HomePage from './pages/HomePage.tsx';
import RecipeDetailPage from './pages/RecipeDetailPage.tsx';
import AddRecipePage from './pages/AddRecipePage.tsx';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key");
}

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
        <RouterProvider router={router} />
      </ClerkProvider>
    </ErrorBoundary>
  </React.StrictMode>,
)
