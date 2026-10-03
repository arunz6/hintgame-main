import { useEffect, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

function QRScanner() {
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "qr-reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      false
    );

    scanner.render(
      (decodedText) => {
        console.log("QR Code:", decodedText);
      },
      (errorMessage) => {
        // Scanning errors happen continuously, so don't log them normally
      }
    );

    scannerRef.current = scanner;

    return () => {
      scanner.clear().catch((error) => {
        console.error("Failed to clear scanner:", error);
      });
    };
  }, []);

  return (
    <div>
      <h2>Scan QR Code</h2>

      <div id="qr-reader" style={{ width: "100%" }}></div>
    </div>
  );
}

export default QRScanner;
