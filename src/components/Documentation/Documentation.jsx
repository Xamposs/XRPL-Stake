import React from 'react';
import { documentationContent } from '../../data/documentationContent';

const Documentation = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-200">How XRP Staking Works</h1>

      <div className="space-y-10">
        {documentationContent.map((section, index) => (
          <div key={index} className="bg-[#0a0b0e] bg-opacity-70 border border-gray-800/30 rounded-xl p-6 shadow-lg backdrop-blur-sm">
            <h2 className="text-2xl font-semibold mb-4 text-[#00d1ff]">{section.title}</h2>

            <div className="prose prose-invert max-w-none">
              {section.paragraphs.map((paragraph, pIndex) => (
                <p key={pIndex} className="mb-4 text-gray-300 leading-relaxed">
                  {paragraph}
                </p>
              ))}

              {section.bulletPoints && (
                <ul className="list-disc pl-5 mt-4 space-y-2">
                  {section.bulletPoints.map((point, bIndex) => (
                    <li key={bIndex} className="text-gray-300">{point}</li>
                  ))}
                </ul>
              )}

              {section.note && (
                <div className="mt-4 p-4 bg-[#0076FF]/10 border border-[#0076FF]/20 rounded-md">
                  <p className="text-[#00d1ff] font-medium">Note: {section.note}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Documentation;
