import React, { useEffect, useRef, useMemo } from 'react';
import { BELGIUM_COORDS } from '../utils/constants';

function cleanName(name) {
  return name ? String(name).replace(/\*{2,}/g, '').trim() : '';
}

function getColorByValue(value, maxVal) {
  if (!maxVal || maxVal <= 0) return '#10b981';
  const ratio = value / maxVal;
  if (ratio <= 0.33) return '#22c55e';
  if (ratio <= 0.66) return '#f59e0b';
  return '#ef4444';
}

function LeafletMap({ locations }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    const loadLeaflet = () =>
      new Promise((resolve) => {
        if (window.L) {
          resolve(window.L);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.crossOrigin = '';
        script.onload = () => resolve(window.L);
        document.head.appendChild(script);
      });

    loadLeaflet().then((L) => {
      if (!mapRef.current) return;

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapRef.current, {
          center: [50.85, 4.35],
          zoom: 8,
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          attribution: '© OSM © CARTO',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current);
      }

      const map = mapInstanceRef.current;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (!locations?.length) return;

      const maxBookings = Math.max(...locations.map((l) => l.bookings));

      locations.forEach((loc) => {
        const coords = BELGIUM_COORDS[loc.name];
        if (!coords) return;

        const ratio = maxBookings > 0 ? loc.bookings / maxBookings : 0;
        const radius = Math.max(14, 14 + ratio * 28);
        const color = getColorByValue(loc.bookings, maxBookings);

        const labelHtml = `<span style="font-size:11px;font-weight:700;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.8);">${loc.bookings}</span>`;
        const divIcon = L.divIcon({
          className: 'map-marker-with-label',
          html: `<div style="
            width:${radius * 2}px;height:${radius * 2}px;border-radius:50%;
            background:${color};border:2px solid #1a1a1a;display:flex;align-items:center;justify-content:center;
            box-shadow:0 2px 8px rgba(0,0,0,0.4);
          ">${labelHtml}</div>`,
          iconSize: [radius * 2, radius * 2],
          iconAnchor: [radius, radius],
        });
        const marker = L.marker([coords.lat, coords.lng], { icon: divIcon }).addTo(map);
        marker.bindPopup(
          `<div style="font-family:system-ui;min-width:180px;color:#1e293b;">
            <div style="font-weight:700;font-size:14px;margin-bottom:8px;">${loc.name}</div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Bookings</span><span style="font-weight:600;">${loc.bookings}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">PAX</span><span style="font-weight:600;">${loc.pax}</span></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:#64748b;">Revenue</span><span style="font-weight:600;">€${new Intl.NumberFormat().format(Math.round(loc.revenue || 0))}</span></div>
          </div>`
        );
        markersRef.current.push(marker);
      });
    });

    return () => {};
  }, [locations]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return <div ref={mapRef} className="map-container" />;
}

export function MapView({ data }) {
  const locations = useMemo(() => {
    if (!data?.length) return [];
    return data
      .map((row) => ({
        name: cleanName(row.destination || row.label || ''),
        bookings: Number(row.bookings) || 0,
        pax: Number(row.pax) || 0,
        revenue: Number(row.revenue) || 0,
      }))
      .filter((l) => l.name && BELGIUM_COORDS[l.name]);
  }, [data]);

  return (
    <div className="view-content">
      <section className="section">
        <div className="section-header">
          <h2>Departure places</h2>
          <span className="section-badge">
            Marker size & color by booking count · green (low) → orange → red (high)
          </span>
        </div>
        {locations.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 0' }}>
            <span>No location data — apply filters or ensure destinations have coordinates.</span>
          </div>
        ) : (
          <LeafletMap locations={locations} />
        )}
      </section>
    </div>
  );
}
