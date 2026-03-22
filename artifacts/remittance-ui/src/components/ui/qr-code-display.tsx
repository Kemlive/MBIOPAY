import React from "react";
import QRCode from "react-qr-code";
import { Card } from "./card";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

export function QRCodeDisplay({ value, size = 200 }: QRCodeDisplayProps) {
  return (
    <Card className="p-4 inline-block bg-white/5 border-white/10 mx-auto">
      <div className="bg-white p-3 rounded-xl shadow-inner">
        <QRCode
          value={value}
          size={size}
          style={{ height: "auto", maxWidth: "100%", width: "100%" }}
          viewBox={`0 0 ${size} ${size}`}
          level="H"
          fgColor="#0f172a" 
          bgColor="#ffffff"
        />
      </div>
    </Card>
  );
}
