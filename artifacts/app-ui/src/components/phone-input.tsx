import { useEffect, useRef } from "react";
import intlTelInput from "intl-tel-input";
import "intl-tel-input/build/css/intlTelInput.css";

interface PhoneInputProps {
  onChange: (e164: string | null) => void;
  placeholder?: string;
}

export function PhoneInput({ onChange, placeholder = "+256700000000" }: PhoneInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itiRef = useRef<ReturnType<typeof intlTelInput> | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;

    const iti = intlTelInput(inputRef.current, {
      initialCountry: "auto",
      geoIpLookup: (callback) => {
        fetch("https://ipapi.co/json")
          .then((res) => res.json())
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .then((data) => callback((data.country_code as string)?.toLowerCase() as any))
          .catch(() => callback("ug" as any));
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — utils.js has no type declarations but is valid at runtime
      loadUtils: () => import("intl-tel-input/build/js/utils.js"),
    });

    itiRef.current = iti;

    const notify = () => {
      if (iti.isValidNumber()) {
        onChange(iti.getNumber());
      } else {
        onChange(null);
      }
    };

    inputRef.current.addEventListener("input", notify);
    inputRef.current.addEventListener("countrychange", notify);

    return () => {
      iti.destroy();
    };
  }, []);

  return (
    <div className="iti-dark-wrapper">
      <input
        ref={inputRef}
        type="tel"
        placeholder={placeholder}
        className="iti-input"
      />
    </div>
  );
}
