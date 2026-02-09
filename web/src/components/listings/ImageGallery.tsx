'use client';

import { useState } from 'react';

interface ImageGalleryProps {
  images: string[];
  title: string;
}

export function ImageGallery({ images, title }: ImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <>
      <div className="relative">
        <div
          className="aspect-[16/9] bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
          onClick={() => setLightboxOpen(true)}
        >
          <img
            src={images[selectedIndex]}
            alt={`${title} - Photo ${selectedIndex + 1}`}
            className="w-full h-full object-cover"
          />
        </div>
        {images.length > 1 && (
          <>
            <button
              onClick={() => setSelectedIndex(i => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedIndex(i => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-1.5 rounded-full hover:bg-black/70"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
              {selectedIndex + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-1 mt-2 overflow-x-auto pb-1">
          {images.slice(0, 20).map((img, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={`shrink-0 w-16 h-12 rounded overflow-hidden border-2 ${
                i === selectedIndex ? 'border-blue-500' : 'border-transparent'
              }`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={images[selectedIndex]}
            alt={title}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={e => e.stopPropagation()}
          />
          {images.length > 1 && (
            <>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setSelectedIndex(i => (i - 1 + images.length) % images.length);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  setSelectedIndex(i => (i + 1) % images.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2"
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
