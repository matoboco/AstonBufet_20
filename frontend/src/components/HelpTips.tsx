import { useState, useEffect } from 'react';

const tips = [
  'Najjednoduchšie si kúpiš niečo z bufetu tak, že dáš "Skenovať" a oskenueš EAN kód produktu.',
  'Zaplatiť dlh nemusíš v presnej sume. Môžeš si vložiť aj viac a rozdiel sa ti ukáže ako kladný zostatok na účte.',
  'Ak si po upozornení na manko spomenieš, že si si zabudol pípnuť nejaký nákup, môžeš pri platení dlhu vložiť viac a povedať Office asistentke, že chceš časťou preplatku prispieť na vyrovnanie manka.',
  'V zozname produktov funguje vyhľadávanie podľa názvu, ale aj pomocou skenovania EAN kódu.',
];

export const HelpTips = () => {
  const [showModal, setShowModal] = useState(false);
  const [currentTip, setCurrentTip] = useState(0);

  // Randomize starting tip
  useEffect(() => {
    setCurrentTip(Math.floor(Math.random() * tips.length));
  }, []);

  const nextTip = () => {
    setCurrentTip((prev) => (prev + 1) % tips.length);
  };

  const prevTip = () => {
    setCurrentTip((prev) => (prev - 1 + tips.length) % tips.length);
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="p-2 -mr-2 text-gray-500 hover:text-primary-600 transition-colors"
        aria-label="Nápoveda"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-4">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 text-primary-600 mb-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </span>
              <h2 className="text-lg font-bold text-gray-900">Vedel si, že...</h2>
            </div>

            <p className="text-gray-700 text-center mb-6 min-h-[80px] flex items-center justify-center">
              {tips[currentTip]}
            </p>

            <div className="flex items-center justify-between">
              <button
                onClick={prevTip}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex gap-1.5">
                {tips.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTip(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentTip ? 'bg-primary-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={nextTip}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <button
              onClick={() => setShowModal(false)}
              className="btn btn-primary w-full mt-6"
            >
              Rozumiem
            </button>
          </div>
        </div>
      )}
    </>
  );
};
