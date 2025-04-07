import { Outlet } from 'react-router-dom';
import Header from './components/Header';

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-stone-100">
      <Header />
      <main className="flex-grow container mx-auto p-4">
        <Outlet />
      </main>
      {/* Consistent Footer Style (Commented Out) 
      <footer className="bg-stone-100 p-4 text-center text-sm text-stone-600">Footer Content</footer>
      */}
    </div>
  )
}

export default App
