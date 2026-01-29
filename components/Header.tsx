'use client';
import React from 'react';
import { FileText, Shield, Book } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  selectedTemplate: string;
  onTemplateChange: (template: string) => void;
}

const Header: React.FC<HeaderProps> = ({ selectedTemplate, onTemplateChange }) => {
  const templates = [
    { value: 'default', label: '通用模式' },
    { value: '网文签约', label: '网文签约' },
    { value: '程序外包', label: '程序外包' },
    { value: '劳动合同', label: '劳动合同' },
  ];

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-primary-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {process.env.NEXT_PUBLIC_APP_NAME}
              </h1>
              <p className="text-xs text-gray-500">
                版本: {process.env.NEXT_PUBLIC_APP_VERSION}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/legal-library"
              className="flex items-center space-x-1 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
            >
              <Book size={16} />
              <span>法律文库</span>
            </Link>
            <div className="relative">
              <label htmlFor="template" className="sr-only">
                行业模板
              </label>
              <select
                id="template"
                value={selectedTemplate}
                onChange={(e) => onTemplateChange(e.target.value)}
                className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm rounded-md bg-white"
              >
                {templates.map((template) => (
                  <option key={template.value} value={template.value}>
                    {template.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;