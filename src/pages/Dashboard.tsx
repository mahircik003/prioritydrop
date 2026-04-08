import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  MessageSquare, CheckCircle2, Clock, DollarSign, ExternalLink,
  Copy, Settings, Inbox, Link2, Save, Edit3
} from 'lucide-react';
import { formatDistanceToNow, differenceInHours } from 'date-fns';

export default function Dashboard({ user }: { user: User }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', displayName: '', bio: '', messagePrice: 20 });
  const [savingProfile, setSavingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState('inbox');

  useEffect(() => {
    const uid = user.uid;

    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile(data);
          setEditForm({
            username: data.username || '',
            displayName: data.displayName || '',
            bio: data.bio || '',
            messagePrice: data.messagePrice || 20,
          });
        } else {
          const newProfile = {
            uid,
            username: user.email?.split('@')[0] || 'user',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            bio: '',
            messagePrice: 20,
            stripeOnboardingComplete: false,
          };
          await setDoc(doc(db, 'users', uid), newProfile);
          setProfile(newProfile);
          setEditForm({
            username: newProfile.username,
            displayName: newProfile.displayName,
            bio: '',
            messagePrice: 20,
          });
          setEditingProfile(true);
          setActiveTab('settings');
        }
      } catch (error: any) {
        toast.error('Failed to load profile');
        setLoading(false);
      }
    };
    fetchProfile();

    const q = query(collection(db, 'messages'), where('creatorUid', '==', uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs.sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const profileLink = profile?.username ? `${window.location.origin}/${profile.username}` : '';

  const copyLink = () => {
    navigator.clipboard.writeText(profileLink);
    toast.success('Link copied to clipboard!');
  };

  const handleSaveProfile = async () => {
    if (!editForm.username.trim()) {
      toast.error('Username is required');
      return;
    }
    if (editForm.username.length < 3) {
      toast.error('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(editForm.username)) {
      toast.error('Username can only contain letters, numbers, hyphens, and underscores');
      return;
    }
    if (editForm.messagePrice < 5 || editForm.messagePrice > 500) {
      toast.error('Price must be between $5 and $500');
      return;
    }

    setSavingProfile(true);
    try {
      const updates = {
        uid: user.uid,
        username: editForm.username.toLowerCase().trim(),
        displayName: editForm.displayName.trim(),
        bio: editForm.bio.trim(),
        messagePrice: Number(editForm.messagePrice),
        photoURL: user.photoURL || '',
      };
      await Promise.race([
        updateDoc(doc(db, 'users', user.uid), updates),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Save timed out. Check your connection.')), 10000)),
      ]);
      setProfile((prev: any) => ({ ...prev, ...updates }));
      setEditingProfile(false);
      toast.success('Profile saved!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleStripeOnboarding = async () => {
    try {
      const res = await fetch('/api/stripe/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await updateDoc(doc(db, 'users', user.uid), {
        stripeAccountId: data.accountId,
      });
      window.location.href = data.url;
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleReply = async (message: any) => {
    if (replyContent.length < 100) {
      toast.error('Reply must be at least 100 characters');
      return;
    }

    try {
      const res = await fetch('/api/stripe/capture-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentIntentId: message.paymentIntentId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.status === 'succeeded') {
        await updateDoc(doc(db, 'messages', message.id), {
          status: 'replied',
          replyContent,
          repliedAt: serverTimestamp(),
        });
        toast.success('Reply sent & payment collected!');
        setReplyingTo(null);
        setReplyContent('');
      } else {
        toast.error('Payment capture failed');
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getTimeRemaining = (createdAt: any) => {
    if (!createdAt) return '48h';
    const created = createdAt.toDate();
    const hoursLeft = 48 - differenceInHours(new Date(), created);
    if (hoursLeft <= 0) return 'Expired';
    if (hoursLeft < 1) return '<1h left';
    return `${Math.floor(hoursLeft)}h left`;
  };

  const pendingMessages = messages.filter(m => m.status === 'pending');
  const repliedMessages = messages.filter(m => m.status === 'replied');
  const totalEarned = repliedMessages.reduce((sum, m) => sum + (m.amount || 0), 0) / 100;

  if (loading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-400 text-sm">Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header with link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-neutral-500 text-sm mt-1">
            {profile?.displayName ? `Welcome back, ${profile.displayName}` : 'Set up your profile to get started'}
          </p>
        </div>
        {profileLink && (
          <button
            onClick={copyLink}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors group"
          >
            <Link2 className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-neutral-700 truncate max-w-[200px]">
              {profileLink.replace('http://', '').replace('https://', '')}
            </span>
            <Copy className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600" />
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold mt-1">{pendingMessages.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Replied</p>
          <p className="text-2xl font-bold mt-1">{repliedMessages.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Earned</p>
          <p className="text-2xl font-bold mt-1 text-green-600">${totalEarned}</p>
        </div>
      </div>

      {/* Stripe warning */}
      {!profile?.stripeOnboardingComplete && (
        <div className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <DollarSign className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Connect Stripe to get paid</p>
            <p className="text-xs text-amber-700 mt-0.5">Link your bank account so you can receive payments when you reply.</p>
          </div>
          <Button size="sm" onClick={handleStripeOnboarding} className="bg-amber-600 hover:bg-amber-700 shrink-0 gap-1.5">
            Connect <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 mb-6">
          <TabsTrigger value="inbox" className="gap-1.5 text-xs sm:text-sm">
            <Inbox className="w-4 h-4" />
            Inbox ({pendingMessages.length})
          </TabsTrigger>
          <TabsTrigger value="replied" className="gap-1.5 text-xs sm:text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Replied ({repliedMessages.length})
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox" className="space-y-3">
          {pendingMessages.length === 0 ? (
            <div className="text-center py-16 space-y-4">
              <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto">
                <Inbox className="w-8 h-8 text-neutral-300" />
              </div>
              <div>
                <p className="font-semibold text-neutral-600">No messages yet</p>
                <p className="text-sm text-neutral-400 mt-1">Share your link to start receiving paid messages</p>
              </div>
              {profileLink && (
                <Button variant="outline" size="sm" onClick={copyLink} className="gap-2 mt-2">
                  <Copy className="w-3.5 h-3.5" /> Copy your link
                </Button>
              )}
            </div>
          ) : (
            pendingMessages.map(msg => {
              const timeLeft = getTimeRemaining(msg.createdAt);
              const isExpired = timeLeft === 'Expired';
              return (
                <Card key={msg.id} className={`overflow-hidden ${isExpired ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between px-4 py-3 bg-neutral-50 border-b">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                        <MessageSquare className="w-4 h-4 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{msg.senderEmail}</p>
                        <p className="text-xs text-neutral-400">
                          {msg.createdAt && formatDistanceToNow(msg.createdAt.toDate(), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="bg-green-50 text-green-700 text-xs">
                        ${msg.amount / 100}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-xs ${isExpired ? 'text-red-600 border-red-200' : 'text-orange-600 border-orange-200'}`}
                      >
                        <Clock className="w-3 h-3 mr-1" />{timeLeft}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <p className="text-neutral-700 leading-relaxed whitespace-pre-wrap text-sm">{msg.content}</p>

                    {replyingTo === msg.id ? (
                      <div className="space-y-3 pt-3 border-t">
                        <Textarea
                          placeholder="Write your reply (min 100 characters)..."
                          className="min-h-[120px] text-sm"
                          value={replyContent}
                          onChange={(e) => setReplyContent(e.target.value)}
                          autoFocus
                        />
                        <div className="flex justify-between items-center">
                          <span className={`text-xs ${replyContent.length < 100 ? 'text-red-500' : 'text-green-600'}`}>
                            {replyContent.length}/100 min
                          </span>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setReplyingTo(null); setReplyContent(''); }}>
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleReply(msg)}
                              disabled={replyContent.length < 100}
                              className="bg-orange-500 hover:bg-orange-600 gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" /> Reply & Collect ${msg.amount / 100}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button
                        onClick={() => setReplyingTo(msg.id)}
                        disabled={isExpired}
                        className="w-full"
                        variant={isExpired ? 'outline' : 'default'}
                      >
                        {isExpired ? 'Expired' : 'Reply to Message'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Replied Tab */}
        <TabsContent value="replied" className="space-y-3">
          {repliedMessages.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-neutral-300" />
              </div>
              <p className="font-semibold text-neutral-600">No replies yet</p>
              <p className="text-sm text-neutral-400">Reply to messages in your inbox to see them here</p>
            </div>
          ) : (
            repliedMessages.map(msg => (
              <Card key={msg.id}>
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold">{msg.senderEmail}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-50 text-green-700 text-xs">
                      +${msg.amount / 100}
                    </Badge>
                    <span className="text-xs text-neutral-400">
                      {msg.repliedAt && formatDistanceToNow(msg.repliedAt.toDate(), { addSuffix: true })}
                    </span>
                  </div>
                </div>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">Message</p>
                    <p className="text-sm text-neutral-600">{msg.content}</p>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-lg border">
                    <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">Your Reply</p>
                    <p className="text-sm text-neutral-800">{msg.replyContent}</p>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Profile Settings</CardTitle>
                  <CardDescription className="mt-1">
                    Configure your public profile and pricing
                  </CardDescription>
                </div>
                {!editingProfile && (
                  <Button variant="outline" size="sm" onClick={() => setEditingProfile(true)} className="gap-1.5">
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-400 shrink-0">{window.location.host}/</span>
                  <Input
                    id="username"
                    placeholder="yourname"
                    value={editForm.username}
                    onChange={(e) => setEditForm(f => ({ ...f, username: e.target.value }))}
                    disabled={!editingProfile}
                    className="lowercase"
                  />
                </div>
                <p className="text-xs text-neutral-400">This is your public link. Only letters, numbers, hyphens, underscores.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  placeholder="Your Name"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm(f => ({ ...f, displayName: e.target.value }))}
                  disabled={!editingProfile}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="Tell people what you do and what kind of messages you'd like to receive..."
                  value={editForm.bio}
                  onChange={(e) => setEditForm(f => ({ ...f, bio: e.target.value }))}
                  disabled={!editingProfile}
                  className="min-h-[80px] resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="price">Message Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  min={5}
                  max={500}
                  value={editForm.messagePrice}
                  onChange={(e) => setEditForm(f => ({ ...f, messagePrice: parseInt(e.target.value) || 5 }))}
                  disabled={!editingProfile}
                  className="max-w-[120px]"
                />
                <p className="text-xs text-neutral-400">People pay this amount to send you a message ($5–$500)</p>
              </div>

              {editingProfile && (
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveProfile} disabled={savingProfile} className="bg-orange-500 hover:bg-orange-600 gap-1.5">
                    <Save className="w-3.5 h-3.5" />
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditingProfile(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Payments</CardTitle>
              <CardDescription>Manage your Stripe connection for receiving payouts</CardDescription>
            </CardHeader>
            <CardContent>
              {profile?.stripeOnboardingComplete ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-green-900">Stripe Connected</p>
                    <p className="text-xs text-green-700">You're all set to receive payments</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-neutral-600">
                    Connect your Stripe account to start receiving payments when you reply to messages.
                  </p>
                  <Button onClick={handleStripeOnboarding} className="gap-1.5">
                    <DollarSign className="w-4 h-4" /> Connect Stripe <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Share Your Link</CardTitle>
              <CardDescription>Send this link to anyone who wants to reach you</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Input value={profileLink} readOnly className="bg-neutral-50 font-mono text-sm" />
                <Button variant="outline" onClick={copyLink} className="shrink-0 gap-1.5">
                  <Copy className="w-4 h-4" /> Copy
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
