import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { Star, Clock, DollarSign, Shield } from 'lucide-react';

export default function CreatorProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [creator, setCreator] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchCreator = async () => {
      try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setCreator(querySnapshot.docs[0].data());
        } else {
          toast.error('Creator not found');
        }
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCreator();
  }, [username]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message || !email) {
      toast.error('Please fill in all fields');
      return;
    }
    if (message.length > 1000) {
      toast.error('Message too long (max 1000 characters)');
      return;
    }

    setSending(true);
    try {
      // Create a pending message document
      const docRef = await addDoc(collection(db, 'messages'), {
        creatorUid: creator.uid,
        senderEmail: email,
        content: message,
        amount: creator.messagePrice * 100, // in cents
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Redirect to checkout
      navigate(`/checkout/${docRef.id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="text-center py-20">Loading profile...</div>;
  if (!creator) return <div className="text-center py-20">Creator not found.</div>;

  return (
    <div className="grid md:grid-cols-3 gap-8">
      <div className="md:col-span-1 space-y-6">
        <Card className="overflow-hidden border-none shadow-xl bg-white">
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center space-y-4">
            <Avatar className="w-32 h-32 border-4 border-orange-500/10">
              <AvatarImage src={creator.photoURL} />
              <AvatarFallback className="text-3xl bg-orange-50">
                {creator.displayName?.[0] || creator.username?.[0]}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold tracking-tight">{creator.displayName || `@${creator.username}`}</h2>
              <p className="text-neutral-500">@{creator.username}</p>
            </div>
            
            <div className="flex flex-wrap justify-center gap-2 pt-2">
              <Badge variant="secondary" className="gap-1 bg-orange-50 text-orange-700 border-orange-100">
                <Star className="w-3 h-3 fill-orange-700" />
                {creator.helpfulRating || 100}% Helpful
              </Badge>
              <Badge variant="secondary" className="gap-1 bg-blue-50 text-blue-700 border-blue-100">
                <Clock className="w-3 h-3" />
                ~{creator.avgResponseTime || 24}h response
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-neutral-600 leading-relaxed">
              {creator.bio || "This creator hasn't written a bio yet."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-2">
        <Card className="border-none shadow-2xl bg-white">
          <CardHeader className="bg-neutral-900 text-white rounded-t-xl">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-orange-500" />
                Send a Priority Message
              </CardTitle>
              <span className="text-2xl font-bold text-orange-500">${creator.messagePrice}</span>
            </div>
          </CardHeader>
          <CardContent className="pt-8 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Your Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-12"
                />
                <p className="text-xs text-neutral-400">We'll send the creator's reply to this email.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Your Message</Label>
                <Textarea 
                  id="message" 
                  placeholder="Ask a question, pitch an idea, or just say hi..." 
                  className="min-h-[200px] resize-none text-lg p-4"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1000}
                  required
                />
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Guaranteed response within 48 hours</span>
                  <span>{message.length}/1000</span>
                </div>
              </div>

              <div className="bg-neutral-50 p-4 rounded-xl border border-neutral-100 space-y-3">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-neutral-900">Buyer Protection</p>
                    <p className="text-neutral-500">Your card will be pre-authorized. You are only charged if the creator replies with at least 100 characters within 48 hours.</p>
                  </div>
                </div>
              </div>

              <Button 
                type="submit" 
                className="w-full h-14 text-lg font-bold bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20"
                disabled={sending}
              >
                {sending ? 'Processing...' : `Pre-authorize $${creator.messagePrice}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
