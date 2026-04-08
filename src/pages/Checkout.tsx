import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { ShieldCheck, Lock } from 'lucide-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''); // Set VITE_STRIPE_PUBLISHABLE_KEY in .env

function CheckoutForm({ message, clientSecret }: { message: any, clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    const cardElement = elements.getElement(CardElement);

    const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: cardElement!,
        billing_details: {
          email: message.senderEmail,
        },
      },
      setup_future_usage: 'off_session',
    });

    if (error) {
      toast.error(error.message);
      setProcessing(false);
    } else if (paymentIntent.status === 'requires_capture') {
      // Update message with payment intent ID
      await updateDoc(doc(db, 'messages', message.id), {
        paymentIntentId: paymentIntent.id,
        status: 'pending', // Already pending, but good to confirm
      });
      toast.success('Payment pre-authorized!');
      navigate(`/${message.creatorUsername || ''}`); // Redirect back to creator or success page
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 border rounded-lg bg-white">
        <CardElement options={{
          style: {
            base: {
              fontSize: '16px',
              color: '#424770',
              '::placeholder': { color: '#aab7c4' },
            },
            invalid: { color: '#9e2146' },
          },
        }} />
      </div>
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <Lock className="w-3 h-3" />
        Secure payment processed by Stripe
      </div>
      <Button 
        type="submit" 
        disabled={!stripe || processing}
        className="w-full h-12 bg-orange-500 hover:bg-orange-600"
      >
        {processing ? 'Processing...' : `Pre-authorize $${message.amount / 100}`}
      </Button>
    </form>
  );
}

export default function Checkout() {
  const { messageId } = useParams();
  const [message, setMessage] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initCheckout = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'messages', messageId!));
        if (docSnap.exists()) {
          const msgData: any = { id: docSnap.id, ...docSnap.data() };
          setMessage(msgData);

          // Get creator's stripe account ID
          const creatorSnap = await getDoc(doc(db, 'users', msgData.creatorUid));
          const creatorData = creatorSnap.data();

          // Create payment intent on server
          const res = await fetch('/api/stripe/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: msgData.amount,
              creatorAccountId: creatorData?.stripeAccountId,
              senderEmail: msgData.senderEmail,
              messageId: msgData.id,
            }),
          });
          const { clientSecret } = await res.json();
          setClientSecret(clientSecret);
        }
      } catch (error: any) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    };
    initCheckout();
  }, [messageId]);

  if (loading) return <div className="text-center py-20">Initializing checkout...</div>;
  if (!message) return <div className="text-center py-20">Message not found.</div>;

  return (
    <div className="max-w-md mx-auto py-12 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Secure Checkout</h1>
        <p className="text-neutral-500">Pre-authorize your payment to send the message.</p>
      </div>

      <Card className="border-none shadow-xl">
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex justify-between items-center">
            <span>Priority Message</span>
            <span className="text-orange-500">${message.amount / 100}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Elements stripe={stripePromise}>
            <CheckoutForm message={message} clientSecret={clientSecret} />
          </Elements>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl border border-green-100 text-sm text-green-800">
        <ShieldCheck className="w-5 h-5 shrink-0" />
        <p>Your card will not be charged unless the creator replies within 48 hours. If they don't reply, the hold is automatically released.</p>
      </div>
    </div>
  );
}
