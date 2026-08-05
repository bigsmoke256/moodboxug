import { useCallback, useState } from "react";

export interface GeoResult {
  address: string;
  lat: number;
  lng: number;
}

type Status = "idle" | "locating" | "error";

/**
 * Browser geolocation + free reverse geocoding (OpenStreetMap Nominatim).
 * Purely a convenience: any failure resolves to null and the caller keeps
 * the plain text address field usable.
 */
export function useGeolocate() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const locate = useCallback(async (): Promise<GeoResult | null> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("error");
      setMessage("Location isn't available on this device — type your address instead.");
      return null;
    }
    setStatus("locating");
    setMessage(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 60000,
        });
      });
      const { latitude, longitude } = pos.coords;
      let address = "";
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
          { headers: { Accept: "application/json" } },
        );
        if (res.ok) {
          const json = (await res.json()) as { display_name?: string };
          address = json.display_name ?? "";
        }
      } catch {
        /* geocoding is best-effort */
      }
      setStatus("idle");
      if (!address) {
        setMessage("We got your pin but couldn't name the street — please add details.");
      }
      return { address, lat: latitude, lng: longitude };
    } catch {
      setStatus("error");
      setMessage("Couldn't get your location — just type your address.");
      return null;
    }
  }, []);

  return { locate, status, message, isLocating: status === "locating" };
}
