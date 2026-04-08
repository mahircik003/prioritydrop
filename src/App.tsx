import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from './firebase';
import { toast } from 'sonner';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import CreatorProfile from './pages/CreatorProfile';
import Dashboard from './pages/Dashboard';
import Checkout from './pages/Checkout';
import { Toaster } from './components/ui/sonner';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Handle redirect result first (fires after Google redirect login)
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        toast.success('Logged in successfully');
      }
    }).catch((error) => {
      if (error.code !== 'auth/no-auth-event') {
        toast.error(error.message);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <Router>
      <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900">
        <Navbar user={user} />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/:username" element={<CreatorProfile />} />
            <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/" />} />
            <Route path="/checkout/:messageId" element={<Checkout />} />
          </Routes>
        </main>
        <Toaster />
      </div>
    </Router>
  );
}
