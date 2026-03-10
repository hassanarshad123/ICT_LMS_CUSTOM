'use client';

import { useState, useCallback } from 'react';
import { ArrowLeft, Copy, Check, BookOpen, Code, Webhook, Play } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import DashboardLayout from '@/components/layout/dashboard-layout';
import ApiReference from './api-reference';
import WebhookGuide from './webhook-guide';
import ApiConsole from './api-console';

export default function ApiDocsPage() {
  const { id } = useAuth();
  const [activeTab, setActiveTab] = useState('reference');
  const [preselectedEndpoint, setPreselectedEndpoint] = useState<string | null>(null);
  const [baseUrlCopied, setBaseUrlCopied] = useState(false);

  // Use window.location to derive the base URL for examples
  const baseUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://your-domain.com';

  const handleTryInConsole = useCallback((endpointId: string) => {
    setPreselectedEndpoint(endpointId);
    setActiveTab('console');
  }, []);

  const handlePreselectedConsumed = useCallback(() => {
    setPreselectedEndpoint(null);
  }, []);

  const copyBaseUrl = async () => {
    await navigator.clipboard.writeText(`${baseUrl}/api/v1/public`);
    setBaseUrlCopied(true);
    setTimeout(() => setBaseUrlCopied(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              href={`/${id}/integrations`}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-2"
            >
              <ArrowLeft size={14} /> Back to Integrations
            </Link>
            <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
              <BookOpen size={24} />
              API Documentation
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Reference documentation, webhook guides, and a testing console for the Public REST API.
            </p>
          </div>

          {/* Base URL display */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <span className="text-xs text-gray-500">Base URL:</span>
            <code className="text-xs font-mono text-gray-800">{baseUrl}/api/v1/public</code>
            <button onClick={copyBaseUrl} className="text-gray-400 hover:text-gray-600 ml-1">
              {baseUrlCopied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-gray-100/80 p-1 rounded-xl">
            <TabsTrigger value="reference" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
              <Code size={16} />
              API Reference
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
              <Webhook size={16} />
              Webhooks
            </TabsTrigger>
            <TabsTrigger value="console" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm gap-2">
              <Play size={16} />
              API Console
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reference">
            <ApiReference baseUrl={baseUrl} onTryInConsole={handleTryInConsole} />
          </TabsContent>

          <TabsContent value="webhooks">
            <WebhookGuide />
          </TabsContent>

          <TabsContent value="console">
            <ApiConsole
              preselectedEndpointId={preselectedEndpoint}
              onPreselectedConsumed={handlePreselectedConsumed}
            />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
