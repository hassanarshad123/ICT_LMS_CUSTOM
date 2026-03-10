'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Send, AlertTriangle, Eye, EyeOff, Key, ChevronDown, ChevronRight, ExternalLink, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CodeBlock from './code-block';
import { ENDPOINT_GROUPS, getAllEndpoints, type EndpointDef } from './api-data';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

interface RequestHistoryEntry {
  id: string;
  method: string;
  path: string;
  status: number | null;
  time: number;
  endpointId: string;
  body?: string;
  pathParamValues?: Record<string, string>;
  queryParamValues?: Record<string, string>;
}

interface ApiConsoleProps {
  preselectedEndpointId?: string | null;
  onPreselectedConsumed?: () => void;
}

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PATCH: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

export default function ApiConsole({ preselectedEndpointId, onPreselectedConsumed }: ApiConsoleProps) {
  const { id: userId } = useAuth();
  const allEndpoints = getAllEndpoints();

  // API key — memory only, never persisted
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Endpoint selection
  const [selectedEndpointId, setSelectedEndpointId] = useState(allEndpoints[0]?.id || '');
  const selectedEndpoint = allEndpoints.find(e => e.id === selectedEndpointId) || allEndpoints[0];

  // Request params
  const [pathParamValues, setPathParamValues] = useState<Record<string, string>>({});
  const [queryParamValues, setQueryParamValues] = useState<Record<string, string>>({});
  const [requestBody, setRequestBody] = useState('');

  // Response
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseBody, setResponseBody] = useState<string | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);

  // Request history (volatile)
  const [history, setHistory] = useState<RequestHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Cleanup on unmount
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;
  useEffect(() => {
    return () => {
      // Clear sensitive data
      apiKeyRef.current = '';
    };
  }, []);

  // Handle preselected endpoint
  useEffect(() => {
    if (preselectedEndpointId) {
      const ep = allEndpoints.find(e => e.id === preselectedEndpointId);
      if (ep) {
        setSelectedEndpointId(ep.id);
        resetFormForEndpoint(ep);
      }
      onPreselectedConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectedEndpointId]);

  const resetFormForEndpoint = useCallback((ep: EndpointDef) => {
    setPathParamValues({});
    setQueryParamValues({});
    setRequestBody(ep.requestBody ? JSON.stringify(ep.requestBody.example, null, 2) : '');
    setResponseStatus(null);
    setResponseBody(null);
    setResponseTime(null);
    setResponseHeaders(null);
  }, []);

  const handleEndpointChange = (endpointId: string) => {
    setSelectedEndpointId(endpointId);
    const ep = allEndpoints.find(e => e.id === endpointId);
    if (ep) resetFormForEndpoint(ep);
  };

  const buildUrl = (): string => {
    let path = selectedEndpoint.path;
    // Replace path params
    for (const [key, value] of Object.entries(pathParamValues)) {
      path = path.replace(`{${key}}`, encodeURIComponent(value));
    }
    // Build query string
    const queryEntries = Object.entries(queryParamValues).filter(([, v]) => v.trim() !== '');
    const queryString = queryEntries.length > 0
      ? '?' + queryEntries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
      : '';
    return `/api/v1/public${path}${queryString}`;
  };

  const sendRequest = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your API key');
      return;
    }

    // Check for unfilled path params
    if (selectedEndpoint.pathParams) {
      for (const p of selectedEndpoint.pathParams) {
        if (!pathParamValues[p.name]?.trim()) {
          toast.error(`Please fill in path parameter: ${p.name}`);
          return;
        }
      }
    }

    setLoading(true);
    setResponseStatus(null);
    setResponseBody(null);
    setResponseTime(null);
    setResponseHeaders(null);

    const url = buildUrl();
    const start = performance.now();

    try {
      const fetchOptions: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          'X-API-Key': apiKey,
          ...(selectedEndpoint.method !== 'GET' && requestBody ? { 'Content-Type': 'application/json' } : {}),
        },
      };

      if (selectedEndpoint.method !== 'GET' && requestBody.trim()) {
        // Validate JSON
        try {
          JSON.parse(requestBody);
        } catch {
          toast.error('Invalid JSON in request body');
          setLoading(false);
          return;
        }
        fetchOptions.body = requestBody;
      }

      const response = await fetch(url, fetchOptions);
      const elapsed = Math.round(performance.now() - start);

      // Extract headers
      const hdrs: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        hdrs[key] = value;
      });

      let body = '';
      const text = await response.text();
      try {
        body = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        body = text;
      }

      setResponseStatus(response.status);
      setResponseBody(body);
      setResponseTime(elapsed);
      setResponseHeaders(hdrs);

      // Add to history
      setHistory(prev => [{
        id: crypto.randomUUID(),
        method: selectedEndpoint.method,
        path: selectedEndpoint.path,
        status: response.status,
        time: elapsed,
        endpointId: selectedEndpoint.id,
        body: requestBody || undefined,
        pathParamValues: Object.keys(pathParamValues).length > 0 ? { ...pathParamValues } : undefined,
        queryParamValues: Object.keys(queryParamValues).length > 0 ? { ...queryParamValues } : undefined,
      }, ...prev].slice(0, 10));

    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setResponseStatus(0);
      setResponseBody(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setResponseTime(elapsed);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => {
    if (selectedEndpoint.method !== 'GET') {
      setShowConfirm(true);
    } else {
      sendRequest();
    }
  };

  const loadFromHistory = (entry: RequestHistoryEntry) => {
    setSelectedEndpointId(entry.endpointId);
    const ep = allEndpoints.find(e => e.id === entry.endpointId);
    if (ep) {
      setPathParamValues(entry.pathParamValues || {});
      setQueryParamValues(entry.queryParamValues || {});
      setRequestBody(entry.body || (ep.requestBody ? JSON.stringify(ep.requestBody.example, null, 2) : ''));
    }
    // Never restore the API key
  };

  return (
    <div className="space-y-6">
      {/* Production warning banner */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm">
        <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
        <div>
          <strong>Production API</strong> — This console sends real requests to your production API. Changes from POST, PATCH, and DELETE requests affect live data.
        </div>
      </div>

      {/* API Key Input */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2">
          <Key size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-700">API Key</h3>
        </div>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Paste your API key (ict_pk_...)"
            className="w-full px-3 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            autoComplete="off"
          />
          <button
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Your API key is held in memory only and cleared when you leave this page.</p>
          <Link
            href={`/${userId}/integrations`}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            Manage API keys <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      {/* Request Builder */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        {/* Endpoint selector */}
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-2">Endpoint</label>
          <select
            value={selectedEndpointId}
            onChange={e => handleEndpointChange(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            {ENDPOINT_GROUPS.map(group => (
              <optgroup key={group.name} label={group.name}>
                {group.endpoints.map(ep => (
                  <option key={ep.id} value={ep.id}>
                    {ep.method} {ep.path} — {ep.summary}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Selected endpoint info */}
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${METHOD_STYLES[selectedEndpoint.method]}`}>
            {selectedEndpoint.method}
          </span>
          <span className="font-mono text-sm text-gray-800">/api/v1/public{selectedEndpoint.path}</span>
        </div>

        {/* Path params */}
        {selectedEndpoint.pathParams && selectedEndpoint.pathParams.length > 0 && (
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Path Parameters</label>
            <div className="space-y-2">
              {selectedEndpoint.pathParams.map(p => (
                <div key={p.name} className="flex items-center gap-3">
                  <label className="text-xs font-mono text-gray-600 w-32 flex-shrink-0">{p.name}</label>
                  <input
                    type="text"
                    value={pathParamValues[p.name] || ''}
                    onChange={e => setPathParamValues(prev => ({ ...prev, [p.name]: e.target.value }))}
                    placeholder={`${p.type} — ${p.description}`}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Query params */}
        {selectedEndpoint.queryParams && selectedEndpoint.queryParams.length > 0 && (
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Query Parameters</label>
            <div className="space-y-2">
              {selectedEndpoint.queryParams.map(p => (
                <div key={p.name} className="flex items-center gap-3">
                  <label className="text-xs font-mono text-gray-600 w-32 flex-shrink-0">
                    {p.name}
                    {p.default && <span className="text-gray-400 ml-1">(={p.default})</span>}
                  </label>
                  <input
                    type="text"
                    value={queryParamValues[p.name] || ''}
                    onChange={e => setQueryParamValues(prev => ({ ...prev, [p.name]: e.target.value }))}
                    placeholder={p.description}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Request body */}
        {selectedEndpoint.requestBody && (
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-2">Request Body (JSON)</label>
            <textarea
              value={requestBody}
              onChange={e => setRequestBody(e.target.value)}
              rows={8}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
              spellCheck={false}
            />
          </div>
        )}

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!apiKey.trim() || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send size={14} />
          {loading ? 'Sending...' : 'Send Request'}
        </button>
      </div>

      {/* Confirmation dialog for write operations */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm {selectedEndpoint.method} Request</AlertDialogTitle>
            <AlertDialogDescription>
              This will send a <strong>{selectedEndpoint.method}</strong> request to <code className="bg-gray-100 px-1 rounded">{selectedEndpoint.path}</code>.
              This action affects your <strong>production data</strong>. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirm(false);
                sendRequest();
              }}
              className="bg-primary text-white hover:bg-primary/80"
            >
              Send Request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Response display */}
      {(responseStatus !== null || loading) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h3 className="text-sm font-semibold text-gray-700">Response</h3>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Sending request...
            </div>
          ) : (
            <>
              {/* Status + time */}
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                  responseStatus === 0 ? 'bg-gray-100 text-gray-700' :
                  responseStatus! < 300 ? 'bg-green-100 text-green-700' :
                  responseStatus! < 500 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {responseStatus === 0 ? 'Error' : responseStatus}
                </span>
                {responseTime !== null && (
                  <span className="text-xs text-gray-500">{responseTime}ms</span>
                )}
              </div>

              {/* Response headers (collapsible) */}
              {responseHeaders && (
                <div>
                  <button
                    onClick={() => setShowHeaders(!showHeaders)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    {showHeaders ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    Response Headers ({Object.keys(responseHeaders).length})
                  </button>
                  {showHeaders && (
                    <div className="mt-2 text-xs font-mono bg-gray-50 rounded-lg p-3 overflow-x-auto">
                      {Object.entries(responseHeaders).map(([k, v]) => (
                        <div key={k}><span className="text-gray-500">{k}:</span> {v}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Response body */}
              {responseBody !== null && (
                <CodeBlock code={responseBody} language="json" />
              )}
            </>
          )}
        </div>
      )}

      {/* Request history */}
      {history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-700"
            >
              {showHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              Recent Requests ({history.length})
            </button>
            <button
              onClick={() => setHistory([])}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              <Trash2 size={12} /> Clear
            </button>
          </div>

          {showHistory && (
            <div className="space-y-1">
              {history.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => loadFromHistory(entry)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors text-left"
                >
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${METHOD_STYLES[entry.method]}`}>
                    {entry.method}
                  </span>
                  <span className="font-mono text-xs text-gray-700 flex-1 truncate">{entry.path}</span>
                  {entry.status !== null && (
                    <span className={`text-xs font-mono ${
                      entry.status < 300 ? 'text-green-600' : entry.status < 500 ? 'text-amber-600' : 'text-red-600'
                    }`}>
                      {entry.status}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{entry.time}ms</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
