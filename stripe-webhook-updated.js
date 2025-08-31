import { serve } from "https://deno.land/std@0.203.0/http/mod.ts";
import Stripe from "npm:stripe@14.21.0";

const stripe = Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

async function verifyRequest(req) {
  const payload = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  try {
    return stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (e) {
    console.error("⚠️ Stripe signature verification failed:", e);
    return null;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  
  const event = await verifyRequest(req);
  if (!event) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  function extractInfo(e) {
    if (e.type === "payment_intent.succeeded") {
      const pi = e.data.object;
      return {
        email: pi.metadata?.email,
        password: pi.metadata?.password,
        paymentIntentId: pi.id
      };
    }
    if (e.type === "checkout.session.completed") {
      const sess = e.data.object;
      return {
        email: sess.metadata?.email,
        password: sess.metadata?.password,
        paymentIntentId: sess.payment_intent
      };
    }
    return null;
  }
  
  const payload = extractInfo(event);
  if (!payload) {
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  const { email, password, paymentIntentId } = payload;
  
  if (!email || !password || !paymentIntentId) {
    console.warn("⚠️ Missing metadata on Stripe event", payload);
    return new Response(JSON.stringify({ error: "Missing email/password metadata" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  // Call your local backend instead of Supabase
  try {
    const response = await fetch('https://thediscourse.ai/api/auth/create-user-from-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get("WEBHOOK_SECRET")}`
      },
      body: JSON.stringify({
        email,
        password,
        paymentIntentId,
        source: 'stripe_webhook'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Backend user creation failed:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Backend user creation failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const result = await response.json();
    console.log("✅ User created successfully:", result);
    
  } catch (e) {
    console.error("❌ Failed to call backend:", e);
    return new Response(JSON.stringify({ error: "Backend communication failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
});
