'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown, Play, Webhook } from 'lucide-react';
import CodeBlock from './code-block';
import { type EndpointDef, generateCurlExample, generatePythonExample, generateNodeExample } from './api-data';

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PATCH: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
};

interface EndpointCardProps {
  endpoint: EndpointDef;
  baseUrl: string;
  onTryInConsole?: (endpointId: string) => void;
}

export default function EndpointCard({ endpoint, baseUrl, onTryInConsole }: EndpointCardProps) {
  const [open, setOpen] = useState(false);
  const [codeTab, setCodeTab] = useState<'curl' | 'python' | 'node'>('curl');

  const codeTabs = [
    { id: 'curl' as const, label: 'cURL' },
    { id: 'python' as const, label: 'Python' },
    { id: 'node' as const, label: 'Node.js' },
  ];

  const codeExamples = {
    curl: generateCurlExample(endpoint, baseUrl),
    python: generatePythonExample(endpoint, baseUrl),
    node: generateNodeExample(endpoint, baseUrl),
  };

  const isDeleteNoBody = endpoint.method === 'DELETE' && !endpoint.requestBody;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Collapsed header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
      >
        <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${METHOD_STYLES[endpoint.method]}`}>
          {endpoint.method}
        </span>
        <span className="font-mono text-sm text-gray-800">{endpoint.path}</span>
        <span className="text-sm text-gray-500 flex-1 truncate">{endpoint.summary}</span>
        {open ? <ChevronDown size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />}
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-4 space-y-5 bg-gray-50/50">
          {/* Description */}
          <p className="text-sm text-gray-600">{endpoint.description}</p>

          {/* Auth info */}
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="bg-gray-100 px-2 py-1 rounded font-mono">X-API-Key</span>
            <span>Required</span>
            <span className="text-gray-300">|</span>
            <span>Rate limit: 1,000 req/min</span>
          </div>

          {/* Path params */}
          {endpoint.pathParams && endpoint.pathParams.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Path Parameters</h4>
              <ParamTable params={endpoint.pathParams} />
            </div>
          )}

          {/* Query params */}
          {endpoint.queryParams && endpoint.queryParams.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Query Parameters</h4>
              <ParamTable params={endpoint.queryParams} />
            </div>
          )}

          {/* Request body */}
          {endpoint.requestBody && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Request Body</h4>
              <FieldTable fields={endpoint.requestBody.fields} />
              <div className="mt-3">
                <CodeBlock code={JSON.stringify(endpoint.requestBody.example, null, 2)} language="json" />
              </div>
            </div>
          )}

          {/* Response */}
          {endpoint.responseSchema.fields.length > 0 ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">
                Response {endpoint.method === 'POST' && !endpoint.path.includes('/approve') && !endpoint.path.includes('/revoke') ? '(201)' : '(200)'}
              </h4>
              <FieldTable fields={endpoint.responseSchema.fields} />
              <div className="mt-3">
                <CodeBlock code={JSON.stringify(endpoint.responseSchema.example, null, 2)} language="json" />
              </div>
            </div>
          ) : isDeleteNoBody ? (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Response (204)</h4>
              <p className="text-sm text-gray-500">No content — empty response body on success.</p>
            </div>
          ) : (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Response</h4>
              <div className="mt-3">
                <CodeBlock code={JSON.stringify(endpoint.responseSchema.example, null, 2)} language="json" />
              </div>
            </div>
          )}

          {/* Webhook event note */}
          {endpoint.webhookEvent && (
            <div className="flex items-center gap-2 text-sm bg-purple-50 text-purple-700 px-3 py-2 rounded-lg">
              <Webhook size={14} />
              Fires <code className="bg-purple-100 px-1.5 py-0.5 rounded font-mono text-xs">{endpoint.webhookEvent}</code> webhook event
            </div>
          )}

          {/* Code examples */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Code Examples</h4>
            <div className="flex gap-1 mb-3">
              {codeTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setCodeTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    codeTab === tab.id
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <CodeBlock
              code={codeExamples[codeTab]}
              language={codeTab === 'curl' ? 'bash' : codeTab === 'python' ? 'python' : 'javascript'}
            />
          </div>

          {/* Try in console button */}
          {onTryInConsole && (
            <button
              onClick={() => onTryInConsole(endpoint.id)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary bg-primary/10 rounded-xl hover:bg-primary/20 transition-colors"
            >
              <Play size={14} />
              Try in Console
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function ParamTable({ params }: { params: { name: string; type: string; required: boolean; description: string; default?: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 text-xs border-b border-gray-200">
            <th className="pb-2 pr-4 font-medium">Name</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 pr-4 font-medium">Required</th>
            <th className="pb-2 pr-4 font-medium">Default</th>
            <th className="pb-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map(p => (
            <tr key={p.name} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-4 font-mono text-xs text-gray-800">{p.name}</td>
              <td className="py-2 pr-4 text-xs text-gray-500">{p.type}</td>
              <td className="py-2 pr-4 text-xs">{p.required ? <span className="text-red-500">Yes</span> : <span className="text-gray-400">No</span>}</td>
              <td className="py-2 pr-4 text-xs text-gray-500 font-mono">{p.default || '—'}</td>
              <td className="py-2 text-xs text-gray-600">{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldTable({ fields }: { fields: { name: string; type: string; description: string; required?: boolean }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 text-xs border-b border-gray-200">
            <th className="pb-2 pr-4 font-medium">Field</th>
            <th className="pb-2 pr-4 font-medium">Type</th>
            <th className="pb-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(f => (
            <tr key={f.name} className="border-b border-gray-100 last:border-0">
              <td className="py-2 pr-4 font-mono text-xs text-gray-800">
                {f.name}
                {f.required && <span className="text-red-400 ml-1">*</span>}
              </td>
              <td className="py-2 pr-4 text-xs text-gray-500">{f.type}</td>
              <td className="py-2 text-xs text-gray-600">{f.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
