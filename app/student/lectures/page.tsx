'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { lectures } from '@/lib/mock-data';
import { PlayCircle, Clock, X } from 'lucide-react';

const studentLectures = lectures.filter((l) => l.batchId === 'b3');

export default function StudentLectures() {
  const [selectedLecture, setSelectedLecture] = useState<string | null>(null);
  const activeLecture = studentLectures.find((l) => l.id === selectedLecture);

  return (
    <DashboardLayout role="student" userName="Muhammad Imran">
      <DashboardHeader greeting="Recorded Lectures" subtitle="Watch your course lectures anytime" />

      {activeLecture && (
        <div className="bg-[#1A1A1A] rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">{activeLecture.title}</h3>
            <button onClick={() => setSelectedLecture(null)} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
              <X size={16} className="text-white" />
            </button>
          </div>
          <div className="aspect-video bg-gray-800 rounded-xl flex items-center justify-center mb-4">
            <div className="text-center">
              <PlayCircle size={64} className="text-[#C5D86D] mx-auto mb-3" />
              <p className="text-white text-sm">Video Player</p>
              <p className="text-gray-400 text-xs mt-1">Video will play here when connected to backend</p>
            </div>
          </div>
          <p className="text-gray-300 text-sm">{activeLecture.description}</p>
          <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
            <Clock size={12} />
            {activeLecture.duration}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {studentLectures.map((lecture, index) => (
          <button
            key={lecture.id}
            onClick={() => setSelectedLecture(lecture.id)}
            className={`bg-white rounded-2xl p-5 card-shadow hover:card-shadow-hover transition-all duration-200 text-left ${
              selectedLecture === lecture.id ? 'ring-2 ring-[#1A1A1A]' : ''
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-[#C5D86D] bg-opacity-30 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-[#1A1A1A]">{index + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-[#1A1A1A] text-sm">{lecture.title}</h4>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{lecture.description}</p>
                <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
                  <Clock size={12} />
                  {lecture.duration}
                  <span className="text-gray-300">|</span>
                  Uploaded {lecture.uploadDate}
                </div>
              </div>
              <PlayCircle size={24} className="text-gray-300 flex-shrink-0 mt-1" />
            </div>
          </button>
        ))}
      </div>
    </DashboardLayout>
  );
}
