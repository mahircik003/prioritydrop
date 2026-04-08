# PriorityDrop

A monetized inbox for creators. Senders pay to send you a message — you reply within 48 hours and get paid. If you don't reply, the payment is never captured.

## How it works

1. Creators sign up and get a public link (`yourdomain.com/yourname`)
2. Senders visit the link, write a message, and pre-authorize a payment via Stripe
3. Creator replies from their dashboard — payment is captured on reply
4. No reply within 48h = payment automatically released

## Stack

- React + TypeScript + Vite
- Firebase (Auth + Firestore)
- Stripe Connect (escrow payments)
- Tailwind CSS + shadcn/ui
- Express server

## Running locally

1. `npm install`
2. Copy `.env.example` to `.env` and fill in your keys
3. `npm run dev`
