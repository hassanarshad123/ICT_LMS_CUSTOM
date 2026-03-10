'use client';

import { useRef } from 'react';
import { Shield } from 'lucide-react';
import EndpointCard from './endpoint-card';
import CodeBlock from './code-block';
import { ENDPOINT_GROUPS, ERROR_CODES } from './api-data';

interface ApiReferenceProps {
  baseUrl: string;
  onTryInConsole?: (endpointId: string) => void;
}

export default function ApiReference({ baseUrl, onTryInConsole }: ApiReferenceProps) {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToSection = (name: string) => {
    sectionRefs.current[name]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      {/* Authentication overview */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-gray-900">Authentication</h2>
        </div>

        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <h3 className="font-medium text-gray-800 mb-1">API Key Authentication</h3>
            <p>All requests require an <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">X-API-Key</code> header with a valid API key. Create and manage keys from the <strong>Integrations</strong> page.</p>
            <div className="mt-3">
              <CodeBlock code={`curl -H "X-API-Key: ict_pk_abc123..." ${baseUrl}/api/v1/public/students`} language="bash" />
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">Rate Limiting</h3>
            <p>All endpoints are rate-limited to <strong>1,000 requests per minute</strong> per API key. Exceeding this limit returns a <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">429</code> status.</p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">Pagination</h3>
            <p>List endpoints return paginated results with this format:</p>
            <div className="mt-2">
              <CodeBlock
                code={JSON.stringify({ data: ['...items'], total: 42, page: 1, per_page: 20, total_pages: 3 }, null, 2)}
                language="json"
              />
            </div>
            <p className="mt-2">
              Use <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">page</code> (default: 1) and <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">per_page</code> (default: 20, max: 100) query parameters.
            </p>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">Error Responses</h3>
            <p>Errors return a JSON body with a <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">detail</code> field:</p>
            <div className="mt-2">
              <CodeBlock code={JSON.stringify({ detail: 'Student not found' }, null, 2)} language="json" />
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-800 mb-1">Status Codes</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs border-b border-gray-200">
                    <th className="pb-2 pr-4 font-medium">Code</th>
                    <th className="pb-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {ERROR_CODES.map(e => (
                    <tr key={e.code} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 pr-4 font-mono text-xs">
                        <span className={`px-1.5 py-0.5 rounded ${e.code < 300 ? 'bg-green-50 text-green-700' : e.code < 500 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                          {e.code}
                        </span>
                      </td>
                      <td className="py-1.5 text-xs text-gray-600">{e.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Resource navigation pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {ENDPOINT_GROUPS.map(group => (
          <button
            key={group.name}
            onClick={() => scrollToSection(group.name)}
            className="px-3 py-1.5 text-sm font-medium rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors whitespace-nowrap flex-shrink-0"
          >
            {group.name} ({group.endpoints.length})
          </button>
        ))}
      </div>

      {/* Endpoint sections */}
      {ENDPOINT_GROUPS.map(group => (
        <div
          key={group.name}
          ref={el => { sectionRefs.current[group.name] = el; }}
          className="space-y-3 scroll-mt-4"
        >
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{group.name}</h2>
            <p className="text-sm text-gray-500">{group.description}</p>
          </div>
          <div className="space-y-2">
            {group.endpoints.map(ep => (
              <EndpointCard
                key={ep.id}
                endpoint={ep}
                baseUrl={baseUrl}
                onTryInConsole={onTryInConsole}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
