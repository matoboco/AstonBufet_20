import { useEffect, useRef, useState, useCallback } from 'react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export const BarcodeScanner = ({ onScan, onClose }: BarcodeScannerProps) => {
  const [error, setError] = useState<string | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const hasScannedRef = useRef(false);

  // Stabilize onScan callback
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const handleScanResult = useCallback((code: string) => {
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;

    // Stop scanning immediately
    codeReaderRef.current?.reset();

    // Call onScan after a small delay to ensure cleanup
    setTimeout(() => {
      onScanRef.current(code);
    }, 50);
  }, []);

  useEffect(() => {
    const codeReader = new BrowserMultiFormatReader();
    codeReaderRef.current = codeReader;
    hasScannedRef.current = false;

    const startScanning = async () => {
      try {
        const videoInputDevices = await codeReader.listVideoInputDevices();

        if (videoInputDevices.length === 0) {
          setError('Nebola nájdená žiadna kamera');
          return;
        }

        // Prefer back camera
        const backCamera = videoInputDevices.find(
          (device) =>
            device.label.toLowerCase().includes('back') ||
            device.label.toLowerCase().includes('rear')
        );
        const deviceId = backCamera?.deviceId || videoInputDevices[0].deviceId;

        codeReader.decodeFromVideoDevice(
          deviceId,
          'barcode-video',
          (result, err) => {
            if (result && !hasScannedRef.current) {
              handleScanResult(result.getText());
            }
            if (err && !(err instanceof NotFoundException)) {
              console.error('Scan error:', err);
            }
          }
        );
      } catch (err) {
        console.error('Camera error:', err);
        setError('Nepodarilo sa spustiť kameru');
      }
    };

    startScanning();

    return () => {
      codeReader.reset();
    };
  }, [handleScanResult]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <h2 className="text-lg font-semibold">Skenovanie čiarového kódu</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <div className="text-center text-white">
            <p className="text-red-400 mb-4">{error}</p>
            <button className="btn btn-primary" onClick={onClose}>
              Zavrieť
            </button>
          </div>
        ) : (
          <div className="relative w-full max-w-md">
            <video
              id="barcode-video"
              className="w-full rounded-lg"
              style={{ aspectRatio: '4/3' }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-1/2 border-2 border-primary-400 rounded-lg">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary-500 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary-500 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary-500 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary-500 rounded-br-lg" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 text-center text-white text-sm">
        Nasmerujte kameru na čiarový kód produktu
      </div>
    </div>
  );
};
