import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { toast } from 'sonner';
import { MessageSquare, ShieldCheck, Clock } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const featuresRef = useRef<HTMLDivElement>(null);

  const handleGetStarted = async () => {
    if (auth.currentUser) {
      navigate('/dashboard');
      return;
    }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="flex flex-col items-center text-center py-12 space-y-16">
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
          Monetize your <span className="text-orange-500">Attention.</span>
        </h1>
        <p className="text-xl text-neutral-500 leading-relaxed">
          The link-in-bio inbox that pays you for your time. Senders pre-authorize payments. You reply, you get paid. Simple.
        </p>
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Button size="lg" className="bg-orange-500 hover:bg-orange-600 text-lg px-8 py-6 h-auto" onClick={handleGetStarted}>
            Get Started as a Creator
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-6 h-auto" onClick={() => featuresRef.current?.scrollIntoView({ behavior: 'smooth' })}>
            How it Works
          </Button>
        </div>
      </div>

      <div ref={featuresRef} className="grid md:grid-cols-3 gap-8 w-full">
        <div className="p-6 bg-white rounded-2xl border space-y-4 text-left">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-orange-600" />
          </div>
          <h3 className="font-bold text-xl">Paywalled Inbox</h3>
          <p className="text-neutral-500">Stop getting ghosted or spammed. Senders must pay your set price to reach you.</p>
        </div>
        <div className="p-6 bg-white rounded-2xl border space-y-4 text-left">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-bold text-xl">Guaranteed Response</h3>
          <p className="text-neutral-500">Funds are held in escrow. If you don't reply within 48 hours, the sender is never charged.</p>
        </div>
        <div className="p-6 bg-white rounded-2xl border space-y-4 text-left">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-bold text-xl">48h Deadline</h3>
          <p className="text-neutral-500">A clean inbox with countdown timers keeps you focused on high-value conversations.</p>
        </div>
      </div>
    </div>
  );
}
