// frontend/lib/api/email-templates.ts
import { apiClient } from './client';

export interface TemplateVariable {
  [key: string]: string;
}

export interface EmailTemplateItem {
  key: string;
  label: string;
  category: string;
  subject: string;
  bodyHtml: string;
  isCustom: boolean;
  variables: TemplateVariable;
  updatedAt: string | null;
}

export interface EmailTemplateDetail extends EmailTemplateItem {
  defaultSubject: string;
  defaultBody: string;
}

export interface PreviewResponse {
  subject: string;
  html: string;
}

export async function listEmailTemplates(): Promise<EmailTemplateItem[]> {
  return apiClient('/email-templates');
}

export async function getEmailTemplate(key: string): Promise<EmailTemplateDetail> {
  return apiClient(`/email-templates/${key}`);
}

export async function updateEmailTemplate(
  key: string,
  subject: string,
  bodyHtml: string,
): Promise<EmailTemplateDetail> {
  return apiClient(`/email-templates/${key}`, {
    method: 'PATCH',
    body: JSON.stringify({ subject, body_html: bodyHtml }),
  });
}

export async function resetEmailTemplate(key: string): Promise<EmailTemplateDetail> {
  return apiClient(`/email-templates/${key}`, { method: 'DELETE' });
}

export async function previewEmailTemplate(
  templateKey: string,
  subject: string,
  bodyHtml: string,
): Promise<PreviewResponse> {
  return apiClient('/email-templates/preview', {
    method: 'POST',
    body: JSON.stringify({ template_key: templateKey, subject, body_html: bodyHtml }),
  });
}
