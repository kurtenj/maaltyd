import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App.tsx'
import './index.css'
import HomePage from './pages/HomePage.tsx';
import RecipeDetailPage from './pages/RecipeDetailPage.tsx';
import AddRecipePage from './pages/AddRecipePage.tsx';

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
    <RouterProvider router={router} />
  </React.StrictMode>,
)
