import { Link } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { Button } from './ui/button';
import { LogIn, LogOut, LayoutDashboard, Zap } from 'lucide-react';
import { toast } from 'sonner';

export default function Navbar({ user }: { user: any }) {
  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully');
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error(error.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-4xl">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <Zap className="w-6 h-6 text-orange-500 fill-orange-500" />
          <span>PriorityDrop</span>
        </Link>
        
        <div className="flex items-center gap-4">
          {user ? (
            <>
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={handleLogin} className="gap-2 bg-orange-500 hover:bg-orange-600">
              <LogIn className="w-4 h-4" />
              Creator Login
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
