import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-01-27' as any,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Stripe: Create Connect Account
  app.post('/api/stripe/create-account', async (req, res) => {
    try {
      const { email } = req.body;
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });

      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.APP_URL}/dashboard?stripe=refresh`,
        return_url: `${process.env.APP_URL}/dashboard?stripe=success`,
        type: 'account_onboarding',
      });

      res.json({ url: accountLink.url, accountId: account.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe: Create Payment Intent (Pre-auth)
  app.post('/api/stripe/create-payment-intent', async (req, res) => {
    try {
      const { amount, creatorAccountId, senderEmail, messageId } = req.body;
      
      // Amount is in cents. 15% rake.
      // We use manual capture to hold the funds.
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        payment_method_types: ['card'],
        capture_method: 'manual',
        application_fee_amount: Math.round(amount * 0.15),
        transfer_data: {
          destination: creatorAccountId,
        },
        metadata: {
          messageId,
          senderEmail,
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe: Capture Payment
  app.post('/api/stripe/capture-payment', async (req, res) => {
    try {
      const { paymentIntentId } = req.body;
      const intent = await stripe.paymentIntents.capture(paymentIntentId);
      res.json({ status: intent.status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe: Cancel Payment
  app.post('/api/stripe/cancel-payment', async (req, res) => {
    try {
      const { paymentIntentId } = req.body;
      const intent = await stripe.paymentIntents.cancel(paymentIntentId);
      res.json({ status: intent.status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
