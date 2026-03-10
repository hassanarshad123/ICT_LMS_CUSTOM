'use client';

import { useState } from 'react';
import { Webhook, AlertTriangle, ChevronRight, ChevronDown, ExternalLink, Clock, Shield } from 'lucide-react';
import Link from 'next/link';
import CodeBlock from './code-block';
import { WEBHOOK_EVENT_GROUPS } from './api-data';
import { useAuth } from '@/lib/auth-context';

const RETRY_SCHEDULE = [
  { attempt: 'Initial', delay: 'Immediate', cumulative: '0' },
  { attempt: 'Retry 1', delay: '+1 minute', cumulative: '1 min' },
  { attempt: 'Retry 2', delay: '+5 minutes', cumulative: '6 min' },
  { attempt: 'Retry 3', delay: '+30 minutes', cumulative: '36 min' },
  { attempt: 'Retry 4', delay: '+2 hours', cumulative: '2 hr 36 min' },
  { attempt: 'Retry 5', delay: '+12 hours', cumulative: '14 hr 36 min' },
];

const HMAC_PYTHON = `import hashlib
import hmac
import time

def verify_webhook(payload_body: bytes, signature_header: str,
                   timestamp_header: str, secret: str) -> bool:
    """Verify webhook HMAC signature with replay protection."""
    # 1. Check timestamp (reject events older than 5 minutes)
    current_time = int(time.time())
    webhook_time = int(timestamp_header)
    if abs(current_time - webhook_time) > 300:
        raise ValueError("Webhook timestamp too old — possible replay attack")

    # 2. Compute expected signature
    message = f"{timestamp_header}.{payload_body.decode('utf-8')}"
    expected = hmac.new(
        secret.encode(), message.encode(), hashlib.sha256
    ).hexdigest()

    # 3. Constant-time comparison (CRITICAL for security)
    received = signature_header.removeprefix("sha256=")
    if not hmac.compare_digest(expected, received):
        raise ValueError("Invalid webhook signature")

    return True`;

const HMAC_NODE = `import crypto from 'crypto';

function verifyWebhook(payloadBody, signatureHeader, timestampHeader, secret) {
  // 1. Check timestamp (reject events older than 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const webhookTime = parseInt(timestampHeader, 10);
  if (Math.abs(currentTime - webhookTime) > 300) {
    throw new Error("Webhook timestamp too old — possible replay attack");
  }

  // 2. Compute expected signature
  const message = \`\${timestampHeader}.\${payloadBody}\`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(message)
    .digest("hex");

  // 3. Constant-time comparison (CRITICAL for security)
  const received = signatureHeader.replace("sha256=", "");
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(received, "utf8");
  if (expectedBuf.length !== receivedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    throw new Error("Invalid webhook signature");
  }

  return true;
}`;

const HMAC_GO = `package main

import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "fmt"
    "math"
    "strconv"
    "time"
)

func verifyWebhook(payloadBody, signatureHeader, timestampHeader, secret string) error {
    // 1. Check timestamp (reject events older than 5 minutes)
    webhookTime, _ := strconv.ParseInt(timestampHeader, 10, 64)
    diff := math.Abs(float64(time.Now().Unix() - webhookTime))
    if diff > 300 {
        return fmt.Errorf("webhook timestamp too old")
    }

    // 2. Compute expected signature
    message := fmt.Sprintf("%s.%s", timestampHeader, payloadBody)
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write([]byte(message))
    expected := hex.EncodeToString(mac.Sum(nil))

    // 3. Constant-time comparison (CRITICAL for security)
    received := signatureHeader[len("sha256="):]
    if !hmac.Equal([]byte(expected), []byte(received)) {
        return fmt.Errorf("invalid webhook signature")
    }

    return nil
}`;

export default function WebhookGuide() {
  const { id } = useAuth();
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});
  const [hmacTab, setHmacTab] = useState<'python' | 'node' | 'go'>('python');

  const toggleEvent = (event: string) => {
    setExpandedEvents(prev => ({ ...prev, [event]: !prev[event] }));
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2">
          <Webhook size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Webhooks Overview</h2>
        </div>
        <p className="text-sm text-gray-600">
          Webhooks notify your application in real-time when events happen in the LMS. Instead of polling the API,
          configure a webhook endpoint URL and we&apos;ll send HTTP POST requests with event data whenever something changes.
        </p>
        <Link
          href={`/${id}/integrations`}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Configure webhooks in Integrations <ExternalLink size={14} />
        </Link>
      </div>

      {/* Event Types */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h2 className="text-lg font-semibold text-gray-900">Event Types</h2>
        <p className="text-sm text-gray-500">Subscribe to specific events when creating a webhook. Events are grouped by category.</p>

        <div className="space-y-5">
          {WEBHOOK_EVENT_GROUPS.map(group => (
            <div key={group.name}>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">{group.name}</h3>
              <div className="space-y-1">
                {group.events.map(evt => (
                  <div key={evt.event} className="border border-gray-100 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleEvent(evt.event)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                    >
                      {expandedEvents[evt.event] ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
                      <code className="text-xs font-mono text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{evt.event}</code>
                      <span className="text-xs text-gray-500 flex-1 truncate">{evt.description}</span>
                    </button>
                    {expandedEvents[evt.event] && (
                      <div className="px-3 pb-3">
                        <CodeBlock code={JSON.stringify(evt.examplePayload, null, 2)} language="json" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payload Format */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h2 className="text-lg font-semibold text-gray-900">Payload Format</h2>
        <p className="text-sm text-gray-600">Every webhook delivery sends an HTTP POST with a JSON body and custom headers.</p>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Request Body</h3>
          <CodeBlock
            code={JSON.stringify({ event: 'user.created', timestamp: '2026-03-11T10:30:00.000000+00:00', data: { '...': 'event-specific fields' } }, null, 2)}
            language="json"
          />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Headers</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs border-b border-gray-200">
                  <th className="pb-2 pr-4 font-medium">Header</th>
                  <th className="pb-2 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-mono text-gray-800">X-Webhook-Signature</td><td className="py-2 text-gray-600">HMAC-SHA256 signature: <code className="bg-gray-100 px-1 rounded">sha256=&#123;hex&#125;</code></td></tr>
                <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-mono text-gray-800">X-Webhook-Timestamp</td><td className="py-2 text-gray-600">Unix timestamp when the signature was generated</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-mono text-gray-800">X-Webhook-Event</td><td className="py-2 text-gray-600">Event type (e.g. <code className="bg-gray-100 px-1 rounded">user.created</code>)</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-mono text-gray-800">X-Webhook-Delivery-Id</td><td className="py-2 text-gray-600">Unique delivery UUID (use for idempotency)</td></tr>
                <tr className="border-b border-gray-100"><td className="py-2 pr-4 font-mono text-gray-800">Content-Type</td><td className="py-2 text-gray-600">Always <code className="bg-gray-100 px-1 rounded">application/json</code></td></tr>
                <tr><td className="py-2 pr-4 font-mono text-gray-800">User-Agent</td><td className="py-2 text-gray-600"><code className="bg-gray-100 px-1 rounded">ICT-LMS-Webhook/1.0</code></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* HMAC Verification */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Signature Verification</h2>
        </div>
        <p className="text-sm text-gray-600">
          Every webhook request is signed with your webhook&apos;s secret using HMAC-SHA256.
          You should always verify the signature before processing the event.
        </p>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Algorithm</h3>
          <p className="text-sm text-gray-600 mb-2">The signature is computed as:</p>
          <CodeBlock code={`HMAC-SHA256(secret, "{timestamp}.{body}")`} language="text" />
          <p className="text-sm text-gray-500 mt-2">
            Where <code className="bg-gray-100 px-1 rounded text-xs">timestamp</code> is the <code className="bg-gray-100 px-1 rounded text-xs">X-Webhook-Timestamp</code> header value
            and <code className="bg-gray-100 px-1 rounded text-xs">body</code> is the raw request body string.
          </p>
        </div>

        {/* Security warnings */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm bg-red-50 text-red-700 px-3 py-2.5 rounded-lg border border-red-200">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <div><strong>Always use constant-time comparison</strong> to prevent timing attacks. Never use <code className="bg-red-100 px-1 rounded text-xs">==</code> or <code className="bg-red-100 px-1 rounded text-xs">===</code> to compare signatures.</div>
          </div>
          <div className="flex items-start gap-2 text-sm bg-red-50 text-red-700 px-3 py-2.5 rounded-lg border border-red-200">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <div><strong>Validate the timestamp</strong> to prevent replay attacks. Reject events where the timestamp is more than 5 minutes old.</div>
          </div>
        </div>

        {/* Language tabs */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Verification Examples</h3>
          <div className="flex gap-1 mb-3">
            {[
              { id: 'python' as const, label: 'Python' },
              { id: 'node' as const, label: 'Node.js' },
              { id: 'go' as const, label: 'Go' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setHmacTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  hmacTab === tab.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <CodeBlock
            code={hmacTab === 'python' ? HMAC_PYTHON : hmacTab === 'node' ? HMAC_NODE : HMAC_GO}
            language={hmacTab === 'go' ? 'go' : hmacTab}
            showLineNumbers
          />
        </div>
      </div>

      {/* Delivery & Retries */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Delivery & Retries</h2>
        </div>
        <p className="text-sm text-gray-600">
          Failed deliveries are automatically retried with exponential backoff. Your endpoint must return a <strong>2xx status code</strong> within <strong>10 seconds</strong> to be considered successful.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs border-b border-gray-200">
                <th className="pb-2 pr-4 font-medium">Attempt</th>
                <th className="pb-2 pr-4 font-medium">Delay</th>
                <th className="pb-2 font-medium">Cumulative Time</th>
              </tr>
            </thead>
            <tbody>
              {RETRY_SCHEDULE.map(r => (
                <tr key={r.attempt} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-4 text-xs font-medium text-gray-800">{r.attempt}</td>
                  <td className="py-2 pr-4 text-xs text-gray-600">{r.delay}</td>
                  <td className="py-2 text-xs text-gray-500">{r.cumulative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Delivery Statuses</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { status: 'pending', desc: 'Awaiting first delivery attempt', color: 'bg-gray-100 text-gray-700' },
              { status: 'retrying', desc: 'Failed, awaiting next retry', color: 'bg-amber-100 text-amber-700' },
              { status: 'success', desc: 'Delivered successfully (2xx)', color: 'bg-green-100 text-green-700' },
              { status: 'failed', desc: 'All retries exhausted', color: 'bg-red-100 text-red-700' },
            ].map(s => (
              <div key={s.status} className="text-center p-3 rounded-lg bg-gray-50">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${s.color}`}>{s.status}</span>
                <p className="text-xs text-gray-500 mt-1.5">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <h2 className="text-lg font-semibold text-gray-900">Best Practices</h2>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold mt-0.5">1.</span>
            <span><strong>Return 2xx quickly.</strong> Your endpoint should respond within 10 seconds. Process the event asynchronously if it takes longer.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold mt-0.5">2.</span>
            <span><strong>Use the delivery ID for idempotency.</strong> Store <code className="bg-gray-100 px-1 rounded text-xs">X-Webhook-Delivery-Id</code> and check for duplicates before processing — retries may deliver the same event twice.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold mt-0.5">3.</span>
            <span><strong>Verify the HMAC signature.</strong> Always validate the signature before trusting the payload. Use constant-time comparison.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold mt-0.5">4.</span>
            <span><strong>Handle retries gracefully.</strong> Your endpoint may receive the same event multiple times. Design your processing logic to be idempotent.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold mt-0.5">5.</span>
            <span><strong>Validate timestamps.</strong> Reject events older than 5 minutes to prevent replay attacks.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold mt-0.5">6.</span>
            <span><strong>Monitor deliveries.</strong> Check delivery status from the Integrations page to catch issues early.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
